import React, { useState, useEffect, useCallback } from 'react';
import Sidebar          from '../components/Sidebar';
import UploadZone       from '../components/UploadZone';
import RiskScoreCard    from '../components/RiskScoreCard';
import ThreatFeed       from '../components/ThreatFeed';
import AiPanel          from '../components/AiPanel';
import ExecutiveSummary from '../components/ExecutiveSummary';
import ThreatChart      from '../charts/ThreatChart';
import ThreatTimeline   from '../components/ThreatTimeline';
import { useToast }     from '../components/Toast';
import {
  uploadLogFile, runAiAnalysis, downloadReport,
  checkOllamaHealth, checkBackendHealth,
  getScanData,
} from '../services/api';

const STAGE = { IDLE: 'idle', UPLOADING: 'uploading', ANALYZING: 'analyzing', AI: 'ai', DONE: 'done', ERROR: 'error' };

/* ── Icons ───────────────────────────────────────────────────── */
function Ico({ d, size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
      <path d={d} />
    </svg>
  );
}
const I = {
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  refresh:  'M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0114.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0020.49 15',
  search:   'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0',
  shield:   'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  alert:    'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01',
  activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  check:    'M22 11.08V12a10 10 0 11-5.93-9.14 M22 4L12 14.01l-3-3',
  info:     'M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z M12 8v4 M12 16h.01',
  upload:   'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  file:     'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8',
  bars:     'M18 20V10 M12 20V4 M6 20v-6 M2 20h20',
  home:     'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10',
  timeline: 'M3 12h18 M3 6h18 M3 18h18',
};

/* ── Risk helpers ────────────────────────────────────────────── */
function riskColor(s) {
  if (s >= 75) return '#ef4444';
  if (s >= 50) return '#f97316';
  if (s >= 25) return '#eab308';
  return '#10b981';
}
function riskLabel(s) {
  if (s >= 75) return 'CRITICAL';
  if (s >= 50) return 'HIGH';
  if (s >= 25) return 'MEDIUM';
  return 'LOW';
}

/* ── Step progress bar ───────────────────────────────────────── */
function StepBar({ stage }) {
  const steps  = [
    { id: 'upload', label: 'Upload',   stages: [STAGE.UPLOADING] },
    { id: 'detect', label: 'Detect',   stages: [STAGE.ANALYZING] },
    { id: 'ai',     label: 'AI',       stages: [STAGE.AI] },
    { id: 'done',   label: 'Results',  stages: [STAGE.DONE] },
  ];
  const order  = [STAGE.IDLE, STAGE.UPLOADING, STAGE.ANALYZING, STAGE.AI, STAGE.DONE];
  const cur    = order.indexOf(stage);
  return (
    <div className="step-bar">
      {steps.map((step, i) => {
        const isDone = cur > i + 1;
        const isAct  = step.stages.includes(stage) || (stage === STAGE.DONE && i === 3);
        return (
          <React.Fragment key={step.id}>
            <div className={`step-item ${isDone ? 'done' : isAct ? 'active' : ''}`}>
              <div className="step-num">{isDone ? '✓' : i + 1}</div>
              <span>{step.label}</span>
            </div>
            {i < steps.length - 1 && <div className="step-connector" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Metric card ─────────────────────────────────────────────── */
function MetricCard({ label, value, sub, accent, iconBg, iconColor, iconPath }) {
  return (
    <div className="metric-card" style={{ '--card-accent': accent, '--card-icon-bg': iconBg, '--card-icon-color': iconColor, '--card-value-color': iconColor }}>
      <div className="metric-icon-wrap"><Ico d={iconPath} size={17} /></div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

/* ── HOME PAGE ───────────────────────────────────────────────── */
function HomePage({ onNavigate, scanResult }) {
  return (
    <div className="anim-fade-up">
      <div style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.07) 0%, rgba(139,92,246,0.05) 100%)',
        border: '1px solid rgba(59,130,246,0.14)',
        borderRadius: 16, padding: '40px 36px', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -60, top: -60, width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(59,130,246,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: -30, top: -30, width: 200, height: 200, borderRadius: '50%', border: '1px solid rgba(59,130,246,0.1)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 20, padding: '4px 12px', marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--blue)' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
              AI-POWERED SECURITY ANALYSIS
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)', lineHeight: 1.2, marginBottom: 12 }}>
              Welcome to WatchTower
            </h1>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 500 }}>
              Upload web server log files to automatically detect SQL injection, XSS, brute force, and path traversal attacks — then generate a full AI-powered incident report.
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-lg" onClick={() => onNavigate('upload')}>
                <Ico d={I.upload} size={15} />Analyze a Log File
              </button>
              {scanResult && (
                <button className="btn btn-ghost btn-lg" onClick={() => onNavigate('dashboard')}>
                  <Ico d={I.bars} size={15} />View Last Scan
                </button>
              )}
            </div>
          </div>
          {scanResult && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', minWidth: 200 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>Last Scan</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180, marginBottom: 12 }}>{scanResult.filename}</div>
              <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'var(--font-mono)', color: riskColor(scanResult.overallRiskScore), letterSpacing: '-0.04em', lineHeight: 1 }}>{scanResult.overallRiskScore ?? 0}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>Risk score · {riskLabel(scanResult.overallRiskScore ?? 0)}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { icon: '💉', label: 'SQL Injection',       desc: 'UNION SELECT, boolean-based blind, DROP TABLE',   bg: 'rgba(239,68,68,0.12)',  col: '#f87171' },
          { icon: '⚡', label: 'Cross-Site Scripting', desc: '<script>, onerror=, document.cookie exfil',       bg: 'rgba(249,115,22,0.12)', col: '#fb923c' },
          { icon: '🔨', label: 'Brute Force',          desc: 'Repeated login failures, credential stuffing',    bg: 'rgba(234,179,8,0.12)',  col: '#fbbf24' },
          { icon: '🗂️', label: 'Path Traversal',       desc: '../ sequences, /etc/passwd, cmd.exe access',      bg: 'rgba(59,130,246,0.12)', col: '#60a5fa' },
        ].map(c => (
          <div key={c.label} className="feature-card" style={{ cursor: 'default' }}>
            <div className="feature-icon-box" style={{ background: c.bg }}>{c.icon}</div>
            <div className="feature-name" style={{ color: c.col }}>{c.label}</div>
            <div className="feature-desc">{c.desc}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title"><Ico d={I.info} size={13} />How It Works</div>
        </div>
        <div className="card-inner">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { step: '01', title: 'Upload Log',      desc: 'Drop a .log or .txt file — or paste raw log text directly.', color: 'var(--blue)' },
              { step: '02', title: 'Parse & Detect',  desc: 'The engine parses every log line and runs 4 threat detectors.', color: 'var(--purple)' },
              { step: '03', title: 'AI Analysis',     desc: 'A local LLM (Ollama) generates an expert threat narrative.', color: 'var(--cyan)' },
              { step: '04', title: 'Report & History',desc: 'Export a PDF report — all scans saved to history automatically.', color: 'var(--green)' },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', gap: 14 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 800, color: s.color, opacity: 0.4, lineHeight: 1, flexShrink: 0, paddingTop: 2 }}>{s.step}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 5, color: 'var(--text-primary)' }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.65 }}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── UPLOAD PAGE ─────────────────────────────────────────────── */
function UploadPage({ file, setFile, stage, error, uploadPct, onAnalyze, onReport, onReset, scanResult, aiResult, downloading }) {
  const isLoading = stage === STAGE.UPLOADING || stage === STAGE.ANALYZING || stage === STAGE.AI;

  return (
    <div className="anim-fade-up">
      <div className="card card-glow-blue" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div className="card-title"><Ico d={I.upload} size={13} />Log File Analysis</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {stage !== STAGE.IDLE && stage !== STAGE.ERROR && <StepBar stage={stage} />}
            {stage === STAGE.DONE  && <span className="status-pill complete"><span style={{ width:6,height:6,borderRadius:'50%',background:'currentColor',display:'inline-block' }} />Complete</span>}
            {isLoading && <span className="status-pill scanning"><div className="spinner" style={{width:8,height:8,borderWidth:1.5}} />Scanning...</span>}
          </div>
        </div>
        <div className="card-inner">
          <UploadZone onFileSelected={setFile} selectedFile={file} onClear={onReset} disabled={isLoading} />

          {file && stage === STAGE.IDLE && (
            <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-lg" onClick={onAnalyze}>
                <Ico d={I.search} size={15} />Run Security Analysis
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Detects threats and generates AI analysis automatically</span>
            </div>
          )}

          {isLoading && (
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="spinner" style={{ color: 'var(--cyan)', width: 16, height: 16 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--cyan)' }}>
                  {stage === STAGE.UPLOADING ? `Uploading & parsing... ${uploadPct}%`
                    : stage === STAGE.ANALYZING ? 'Running threat detectors...'
                    : 'Querying AI model — this may take 30–60 s...'}
                </span>
              </div>
              {stage === STAGE.UPLOADING && (
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${uploadPct}%`, background: 'linear-gradient(90deg, var(--blue), var(--purple))' }} />
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="alert alert-error" style={{ marginTop: 14 }}>
              <Ico d={I.alert} size={15} />
              <div><div style={{ fontWeight: 700, marginBottom: 3 }}>Analysis Failed</div><div style={{ fontSize: 12, opacity: 0.85 }}>{error}</div></div>
            </div>
          )}

          {stage === STAGE.DONE && (
            <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-success btn-lg" onClick={onReport} disabled={downloading}>
                {downloading ? <><div className="spinner" />Generating...</> : <><Ico d={I.download} size={14} />Download PDF Report</>}
              </button>
              <button className="btn btn-ghost" onClick={onReset}><Ico d={I.refresh} size={14} />Analyze Another File</button>
            </div>
          )}
        </div>
      </div>

      <div className="alert alert-info">
        <Ico d={I.info} size={15} />
        <div>
          <strong>Supported formats:</strong> Apache, Nginx, syslog, and generic log files in <code>.log</code> or <code>.txt</code> format, up to 10 MB.
          You can also use the <strong>Paste Text</strong> tab to analyze log content directly without a file.
        </div>
      </div>
    </div>
  );
}

/* ── DASHBOARD / RESULTS PAGE ────────────────────────────────── */
function DashboardPage({ scanResult, aiResult, aiError, stage, downloading, onReport, onReset }) {
  if (!scanResult) {
    return (
      <div className="anim-fade-up">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center', gap: 16 }}>
          <div style={{ width: 72, height: 72, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ico d={I.shield} size={30} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>No scan results yet</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 360 }}>
            Upload a log file or load a previous scan from the history panel to view your security dashboard.
          </div>
        </div>
      </div>
    );
  }

  const score = scanResult.overallRiskScore ?? 0;

  return (
    <div className="anim-fade-up">
      {/* Metric row */}
      <div className="metrics-row" style={{ marginBottom: 20 }}>
        <MetricCard label="Risk Score"    value={score}                    sub={`${riskLabel(score)} severity`} accent={riskColor(score)} iconBg={`${riskColor(score)}15`} iconColor={riskColor(score)} iconPath={I.shield} />
        <MetricCard label="Total Threats" value={scanResult.totalThreats ?? 0} sub="Detected events"            accent="#f97316"           iconBg="rgba(249,115,22,0.1)"   iconColor="#f97316"            iconPath={I.alert} />
        <MetricCard label="Total Events"  value={scanResult.totalEvents  ?? 0} sub="Log lines parsed"          accent="var(--blue)"       iconBg="rgba(59,130,246,0.1)"   iconColor="var(--blue)"        iconPath={I.activity} />
        <MetricCard label="Scan Status"   value="Done"                     sub={scanResult.filename}            accent="var(--green)"      iconBg="rgba(16,185,129,0.1)"   iconColor="var(--green)"       iconPath={I.check} />
      </div>

      {/* Timeline */}
      {(scanResult.threats?.length ?? 0) > 0 && (
        <div className="card card-glow-blue" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
              </svg>
              Attack Timeline
            </div>
            <span className="card-badge">{scanResult.threats.length} events</span>
          </div>
          <div className="card-inner">
            <ThreatTimeline threats={scanResult.threats} />
          </div>
        </div>
      )}

      {/* Two-column */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 16 }}>
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card card-glow-blue">
            <div className="card-header">
              <div className="card-title"><Ico d={I.alert} size={13} />Detected Threats</div>
              <span className="card-badge">{scanResult.threats?.length ?? 0} events</span>
            </div>
            <ThreatFeed threats={scanResult.threats ?? []} />
          </div>

          <div className="card card-glow-purple">
            <div className="card-header">
              <div className="card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                </svg>
                AI Security Analysis
              </div>
              {aiResult?.model_used && (
                <span className="card-badge" style={{ color: 'var(--green)', borderColor: 'rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.08)' }}>
                  {aiResult.model_used === 'rule-based-fallback' ? 'Fallback' : aiResult.model_used}
                </span>
              )}
            </div>
            <div className="card-inner">
              <AiPanel analysis={aiResult} loading={stage === STAGE.AI && !aiResult} error={aiError} modelUsed={aiResult?.model_used} />
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <RiskScoreCard score={scanResult.overallRiskScore} totalThreats={scanResult.totalThreats} totalEvents={scanResult.totalEvents} filename={scanResult.filename} />

          <div className="card">
            <div className="card-header"><div className="card-title"><Ico d={I.bars} size={13} />Severity</div></div>
            <div className="card-inner">
              {[{ sev: 'CRITICAL', color: '#ef4444' }, { sev: 'HIGH', color: '#f97316' }, { sev: 'MEDIUM', color: '#eab308' }, { sev: 'LOW', color: '#3b82f6' }].map(({ sev, color }) => {
                const count = scanResult.summary?.bySeverity?.[sev] || 0;
                const pct   = (scanResult.totalThreats ?? 0) > 0 ? Math.round((count / scanResult.totalThreats) * 100) : 0;
                return (
                  <div key={sev} className="sev-row">
                    <span className="sev-label" style={{ color }}>{sev}</span>
                    <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}50` }} /></div>
                    <span className="sev-count">{count}</span>
                  </div>
                );
              })}
              {Object.keys(scanResult.summary?.byType || {}).length > 0 && (
                <>
                  <div className="divider" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {Object.entries(scanResult.summary?.byType || {}).map(([type, count]) => (
                      <div key={type} className="stat-mini">
                        <div className="stat-mini-label">{type.replace('Cross-Site Scripting ', 'XSS ').replace(' Attack', '')}</div>
                        <div className="stat-mini-value" style={{ fontSize: 18 }}>{count}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                  <rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/>
                </svg>
                Distribution
              </div>
            </div>
            <div className="card-inner"><ThreatChart byType={scanResult.summary?.byType || {}} /></div>
          </div>

          <div className="card card-glow-purple">
            <div className="card-header"><div className="card-title"><Ico d={I.file} size={13} />Executive Summary</div></div>
            <div className="card-inner">
              <ExecutiveSummary summary={aiResult?.executive_summary} loading={stage === STAGE.AI && !aiResult} />
            </div>
          </div>
        </div>
      </div>

      {stage === STAGE.DONE && (
        <div style={{ display: 'flex', gap: 12, padding: '16px 20px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-success btn-lg" onClick={onReport} disabled={downloading}>
            {downloading ? <><div className="spinner" />Generating...</> : <><Ico d={I.download} size={14} />Download Incident Report (PDF)</>}
          </button>
          <button className="btn btn-ghost" onClick={onReset}><Ico d={I.refresh} size={14} />New Scan</button>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}>
            {scanResult.filename} · {scanResult.totalThreats ?? 0} threats
          </span>
        </div>
      )}
    </div>
  );
}

/* ── THREATS PAGE ────────────────────────────────────────────── */
function ThreatsPage({ scanResult }) {
  if (!scanResult) {
    return (
      <div className="anim-fade-up">
        <div className="card"><div className="card-inner"><div className="empty-state">
          <div className="empty-icon"><Ico d={I.alert} size={20} /></div>
          <div className="empty-state-text">No threat data</div>
          <div className="empty-state-sub">Upload or load a scan to view threats</div>
        </div></div></div>
      </div>
    );
  }
  return (
    <div className="anim-fade-up">
      <div className="metrics-row" style={{ marginBottom: 16 }}>
        {[{ sev: 'CRITICAL', color: '#ef4444', icon: '🔴' }, { sev: 'HIGH', color: '#f97316', icon: '🟠' }, { sev: 'MEDIUM', color: '#eab308', icon: '🟡' }, { sev: 'LOW', color: '#3b82f6', icon: '🔵' }].map(({ sev, color, icon }) => (
          <div key={sev} className="metric-card" style={{ '--card-accent': color, '--card-value-color': color }}>
            <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
            <div className="metric-label">{sev}</div>
            <div className="metric-value">{scanResult.summary?.bySeverity?.[sev] || 0}</div>
            <div className="metric-sub">threats</div>
          </div>
        ))}
      </div>

      {(scanResult.threats?.length ?? 0) > 0 && (
        <div className="card card-glow-blue" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                <circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/>
              </svg>
              Attack Timeline
            </div>
          </div>
          <div className="card-inner"><ThreatTimeline threats={scanResult.threats} /></div>
        </div>
      )}

      <div className="card card-glow-blue">
        <div className="card-header">
          <div className="card-title"><Ico d={I.alert} size={13} />Full Threat Log</div>
          <span className="card-badge">{scanResult.threats?.length ?? 0} total</span>
        </div>
        <ThreatFeed threats={scanResult.threats ?? []} />
      </div>
    </div>
  );
}

/* ── REPORTS PAGE ────────────────────────────────────────────── */
function ReportsPage({ scanResult, aiResult, downloading, onReport, onReset }) {
  if (!scanResult) {
    return (
      <div className="anim-fade-up">
        <div className="card"><div className="card-inner"><div className="empty-state">
          <div className="empty-icon"><Ico d={I.file} size={20} /></div>
          <div className="empty-state-text">No reports generated yet</div>
          <div className="empty-state-sub">Upload and analyze a log file to generate a report</div>
        </div></div></div>
      </div>
    );
  }
  return (
    <div className="anim-fade-up">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div className="card card-glow-purple">
          <div className="card-header"><div className="card-title"><Ico d={I.file} size={13} />Executive Summary</div></div>
          <div className="card-inner"><ExecutiveSummary summary={aiResult?.executive_summary} loading={false} /></div>
        </div>
        <div className="card card-glow-blue">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
              </svg>
              AI Analysis
            </div>
          </div>
          <div className="card-inner"><AiPanel analysis={aiResult} loading={false} error={null} modelUsed={aiResult?.model_used} /></div>
        </div>
      </div>
      <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(59,130,246,0.04) 100%)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Full Incident Report Ready</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Includes threat log, risk score, AI narrative, and recommendations.</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-success btn-lg" onClick={onReport} disabled={downloading}>
            {downloading ? <><div className="spinner" />Generating...</> : <><Ico d={I.download} size={14} />Download PDF Report</>}
          </button>
          <button className="btn btn-ghost" onClick={onReset}><Ico d={I.refresh} size={14} />New Scan</button>
        </div>
      </div>
    </div>
  );
}

/* ── SETTINGS PAGE ───────────────────────────────────────────── */
function SettingsPage({ backendOnline, ollamaStatus }) {
  return (
    <div className="anim-fade-up">
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            Configuration
          </div>
        </div>
        <div className="card-inner">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Backend API',          desc: 'Express server on port 3001',                               status: backendOnline ? 'Connected' : 'Disconnected',              ok: backendOnline },
              { label: 'LLM Engine (Ollama)',  desc: 'Local language model for AI analysis',                     status: ollamaStatus === 'online' ? 'Connected' : ollamaStatus === 'checking' ? 'Checking...' : 'Offline — rule-based fallback active', ok: ollamaStatus === 'online' },
              { label: 'Database',             desc: 'SQLite via sql.js — stores scans, events, threats, AI',    status: 'Active',                                                  ok: true },
              { label: 'Upload Limit',         desc: 'Maximum file size for log uploads',                        status: '10 MB',                                                   ok: true },
              { label: 'Accepted Formats',     desc: 'File extensions accepted for analysis',                    status: '.log and .txt',                                           ok: true },
              { label: 'IP Geolocation',       desc: 'Enriches source IPs with country/city via ipwho.is',      status: 'Enabled (live API)',                                       ok: true },
              { label: 'Scan History',         desc: 'Previous scans loaded from SQLite via API',               status: 'Enabled',                                                 ok: true },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '14px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.desc}</div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: item.ok ? 'var(--green)' : 'var(--red)', background: item.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${item.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, padding: '4px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── MAIN COMPONENT ──────────────────────────────────────────── */
export default function Dashboard() {
  const toast = useToast();

  const [file,          setFile]          = useState(null);
  const [stage,         setStage]         = useState(STAGE.IDLE);
  const [error,         setError]         = useState(null);
  const [uploadPct,     setUploadPct]     = useState(0);
  const [scanResult,    setScanResult]    = useState(null);
  const [aiResult,      setAiResult]      = useState(null);
  const [aiError,       setAiError]       = useState(null);
  const [downloading,   setDownloading]   = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [ollamaStatus,  setOllamaStatus]  = useState('checking');
  const [activePage,    setActivePage]    = useState('home');

  useEffect(() => {
    checkBackendHealth().then(h => setBackendOnline(!!h));
    checkOllamaHealth().then(h => setOllamaStatus(h.available ? 'online' : 'offline'));
  }, []);

  const reset = useCallback(() => {
    setFile(null); setStage(STAGE.IDLE); setError(null);
    setScanResult(null); setAiResult(null); setAiError(null);
    setUploadPct(0); setDownloading(false);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!file) return;
    setError(null); setAiError(null); setScanResult(null); setAiResult(null);
    setStage(STAGE.UPLOADING);

    let uploadData;
    try {
      uploadData = await uploadLogFile(file, setUploadPct);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Upload failed';
      setError(msg);
      setStage(STAGE.ERROR);
      toast.error(`Upload failed: ${msg}`);
      return;
    }

    setScanResult(uploadData);
    setStage(STAGE.AI);
    toast.info(`Parsed ${uploadData.totalEvents} events, found ${uploadData.totalThreats} threats`);

    try {
      const aiData = await runAiAnalysis(
        uploadData.scanId, uploadData.threats,
        { filename: uploadData.filename, overall_risk_score: uploadData.overallRiskScore, total_events: uploadData.totalEvents }
      );
      setAiResult(aiData);
      toast.success('AI analysis complete');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'AI analysis failed';
      setAiError(msg);
      toast.warn('AI analysis unavailable — showing rule-based results');
    }

    setStage(STAGE.DONE);
    setActivePage('dashboard');
  }, [file, toast]);

  const handleReport = useCallback(async () => {
    if (!scanResult?.scanId) return;
    setDownloading(true);
    toast.info('Generating PDF report...');
    try {
      await downloadReport(scanResult.scanId);
      toast.success('Report downloaded successfully');
    } catch (err) {
      toast.error('Failed to generate report: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  }, [scanResult, toast]);

  const handleLoadScan = useCallback(async (scanId) => {
    toast.info('Loading scan from history...');
    try {
      const { scanResult: sr, aiResult: ar } = await getScanData(scanId);
      setScanResult(sr);
      setAiResult(ar);
      setAiError(null);
      setStage(STAGE.DONE);
      setFile(null);
      setError(null);
      setActivePage('dashboard');
      toast.success(`Loaded: ${sr.filename}`);
    } catch (err) {
      toast.error('Failed to load scan: ' + (err.message || 'Unknown error'));
    }
  }, [toast]);

  const handleNavigate = useCallback((page) => setActivePage(page), []);

  const PAGE_LABELS = { home: 'Home', dashboard: 'Dashboard', threats: 'Threat Feed', reports: 'Reports', upload: 'Upload Log', settings: 'Settings' };

  return (
    <div className="app-shell">
      <Sidebar
        backendOnline={backendOnline}
        ollamaStatus={ollamaStatus}
        activePage={activePage}
        onNavigate={handleNavigate}
        onLoadScan={handleLoadScan}
      />

      <div className="main-area">
        {/* Top bar */}
        <div className="top-bar">
          <div className="breadcrumb">
            <span>WatchTower</span>
            <span className="breadcrumb-sep">/</span>
            <span className="breadcrumb-current">{PAGE_LABELS[activePage] || activePage}</span>
          </div>
          <div className="top-bar-actions">
            {scanResult && activePage !== 'reports' && (
              <button className="topbar-btn" onClick={() => handleNavigate('reports')}>
                <Ico d={I.file} size={13} />View Report
              </button>
            )}
            {activePage !== 'home' && (
              <button className="topbar-btn" onClick={() => handleNavigate('home')}>
                <Ico d={I.home} size={13} />Home
              </button>
            )}
            <button className="topbar-btn primary" onClick={() => handleNavigate('upload')}>
              <Ico d={I.upload} size={13} />New Scan
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="page-content">
          {activePage === 'home'      && <HomePage    onNavigate={handleNavigate} scanResult={scanResult} />}
          {activePage === 'dashboard' && <DashboardPage scanResult={scanResult} aiResult={aiResult} aiError={aiError} stage={stage} downloading={downloading} onReport={handleReport} onReset={() => { reset(); handleNavigate('upload'); }} />}
          {activePage === 'threats'   && <ThreatsPage  scanResult={scanResult} />}
          {activePage === 'reports'   && <ReportsPage  scanResult={scanResult} aiResult={aiResult} downloading={downloading} onReport={handleReport} onReset={() => { reset(); handleNavigate('upload'); }} />}
          {activePage === 'upload'    && (
            <UploadPage
              file={file} setFile={setFile} stage={stage} error={error} uploadPct={uploadPct}
              scanResult={scanResult} aiResult={aiResult} downloading={downloading}
              onAnalyze={handleAnalyze} onReport={handleReport}
              onReset={reset}
            />
          )}
          {activePage === 'settings'  && <SettingsPage backendOnline={backendOnline} ollamaStatus={ollamaStatus} />}
        </div>

        <footer className="app-footer">
          <span>WatchTower · AI Security Analyst · v1.0.0</span>
          <span>On-device analysis · Privacy first</span>
        </footer>
      </div>
    </div>
  );
}
