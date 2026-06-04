import React, { useState, useEffect, useCallback } from 'react';
import UploadZone       from '../components/UploadZone';
import RiskScoreCard    from '../components/RiskScoreCard';
import ThreatFeed       from '../components/ThreatFeed';
import AiPanel          from '../components/AiPanel';
import ExecutiveSummary from '../components/ExecutiveSummary';
import ThreatChart      from '../charts/ThreatChart';
import AppHeader        from '../components/AppHeader';
import { uploadLogFile, runAiAnalysis, downloadReport, checkOllamaHealth, checkBackendHealth } from '../services/api';

const STAGE = {
  IDLE:       'idle',
  UPLOADING:  'uploading',
  ANALYZING:  'analyzing',
  AI:         'ai',
  DONE:       'done',
  ERROR:      'error',
};

function StepBar({ stage }) {
  const steps = [
    { id: 'upload',  label: 'Upload', stages: [STAGE.UPLOADING] },
    { id: 'detect',  label: 'Detect Threats', stages: [STAGE.ANALYZING] },
    { id: 'ai',      label: 'AI Analysis', stages: [STAGE.AI] },
    { id: 'results', label: 'Results', stages: [STAGE.DONE] },
  ];

  const stageOrder = [STAGE.IDLE, STAGE.UPLOADING, STAGE.ANALYZING, STAGE.AI, STAGE.DONE];
  const curIdx = stageOrder.indexOf(stage);

  return (
    <div className="step-bar">
      {steps.map((step, i) => {
        const stepIdx = i + 1;
        const isDone   = curIdx > stepIdx;
        const isActive = step.stages.includes(stage) || (stage === STAGE.DONE && i === 3);
        return (
          <React.Fragment key={step.id}>
            <div className={`step-item ${isDone ? 'done' : isActive ? 'active' : ''}`}>
              <div className="step-num">{isDone ? '✓' : stepIdx}</div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{step.label}</span>
            </div>
            {i < steps.length - 1 && <div className="step-connector" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [file,          setFile]         = useState(null);
  const [stage,         setStage]        = useState(STAGE.IDLE);
  const [error,         setError]        = useState(null);
  const [uploadPct,     setUploadPct]    = useState(0);
  const [scanResult,    setScanResult]   = useState(null);   // from /api/upload
  const [aiResult,      setAiResult]     = useState(null);   // from /api/analyze-ai
  const [aiError,       setAiError]      = useState(null);
  const [downloading,   setDownloading]  = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [ollamaStatus,  setOllamaStatus] = useState('checking');

  // Status checks on mount
  useEffect(() => {
    checkBackendHealth().then(h => setBackendOnline(!!h));
    checkOllamaHealth().then(h => {
      setOllamaStatus(h.available ? 'online' : 'offline');
    });
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setStage(STAGE.IDLE);
    setError(null);
    setScanResult(null);
    setAiResult(null);
    setAiError(null);
    setUploadPct(0);
    setDownloading(false);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!file) return;
    setError(null);
    setAiError(null);
    setScanResult(null);
    setAiResult(null);

    // ── Step 1: Upload + parse + detect ──────────────────────────────────────
    setStage(STAGE.UPLOADING);
    let uploadData;
    try {
      uploadData = await uploadLogFile(file, setUploadPct);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Upload failed');
      setStage(STAGE.ERROR);
      return;
    }

    setScanResult(uploadData);
    setStage(STAGE.AI);

    // ── Step 2: AI analysis ──────────────────────────────────────────────────
    try {
      const aiData = await runAiAnalysis(
        uploadData.scanId,
        uploadData.threats,
        {
          filename:           uploadData.filename,
          overall_risk_score: uploadData.overallRiskScore,
          total_events:       uploadData.totalEvents,
        }
      );
      setAiResult(aiData);
    } catch (err) {
      setAiError(err.response?.data?.error || err.message || 'AI analysis failed');
    }

    setStage(STAGE.DONE);
  }, [file]);

  const handleReport = useCallback(async () => {
    if (!scanResult?.scanId) return;
    setDownloading(true);
    try {
      await downloadReport(scanResult.scanId);
    } catch (err) {
      alert('Failed to generate report: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloading(false);
    }
  }, [scanResult]);

  const isLoading = stage === STAGE.UPLOADING || stage === STAGE.ANALYZING || stage === STAGE.AI;

  return (
    <div className="app-shell">
      <AppHeader backendOnline={backendOnline} ollamaStatus={ollamaStatus} />

      <main className="app-main">

        {/* ── Upload section ─────────────────────────────────────────────── */}
        <div className="card animate-fade-in" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div className="card-title">Log File Analysis</div>
            {stage !== STAGE.IDLE && stage !== STAGE.ERROR && (
              <StepBar stage={stage} />
            )}
          </div>

          <UploadZone
            onFileSelected={setFile}
            selectedFile={file}
            onClear={reset}
            disabled={isLoading}
          />

          {/* File selected – show action row */}
          {file && stage === STAGE.IDLE && (
            <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={handleAnalyze}
                disabled={isLoading}
              >
                🔍 Analyze File
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                File will be parsed, threats detected, and AI analysis run automatically
              </span>
            </div>
          )}

          {/* Progress status */}
          {isLoading && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div className="spinner" />
                <span style={{ fontSize: 13, color: 'var(--accent-cyan)' }}>
                  {stage === STAGE.UPLOADING ? `Uploading & parsing... ${uploadPct}%`
                   : stage === STAGE.ANALYZING ? 'Running threat detectors...'
                   : 'Running AI analysis — this may take 30–60 seconds...'}
                </span>
              </div>
              {stage === STAGE.UPLOADING && (
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width: `${uploadPct}%`,
                    background: 'var(--accent-blue)',
                  }} />
                </div>
              )}
            </div>
          )}

          {/* Errors */}
          {error && (
            <div className="alert alert-error" style={{ marginTop: 12 }}>
              <span>❌</span>
              <div>
                <div style={{ fontWeight: 600 }}>Analysis Failed</div>
                <div style={{ fontSize: 12, marginTop: 2 }}>{error}</div>
              </div>
            </div>
          )}

          {/* Reset after done */}
          {stage === STAGE.DONE && (
            <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-success"
                onClick={handleReport}
                disabled={downloading}
              >
                {downloading ? <><div className="spinner" /> Generating...</> : '📥 Generate Incident Report (PDF)'}
              </button>
              <button className="btn btn-ghost" onClick={reset}>
                🔄 Analyze Another File
              </button>
            </div>
          )}
        </div>

        {/* ── Results Dashboard ──────────────────────────────────────────── */}
        {scanResult && (
          <div className="animate-fade-in">

            {/* Row 1: Risk score + Severity bars + Threat distribution */}
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gap: 16, marginBottom: 16 }}>

              <RiskScoreCard
                score={scanResult.overallRiskScore}
                totalThreats={scanResult.totalThreats}
                totalEvents={scanResult.totalEvents}
                filename={scanResult.filename}
              />

              {/* Severity Breakdown */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Severity Breakdown</span>
                </div>
                <div style={{ marginBottom: 16 }}>
                  {[
                    { sev: 'CRITICAL', color: 'var(--severity-critical)' },
                    { sev: 'HIGH',     color: 'var(--severity-high)' },
                    { sev: 'MEDIUM',   color: 'var(--severity-medium)' },
                    { sev: 'LOW',      color: 'var(--severity-low)' },
                  ].map(({ sev, color }) => {
                    const count = scanResult.summary?.bySeverity?.[sev] || 0;
                    const pct   = (scanResult.totalThreats ?? 0) > 0
                      ? Math.round((count / scanResult.totalThreats) * 100) : 0;
                    return (
                      <div key={sev} className="sev-row">
                        <span className="sev-label" style={{ color }}>{sev}</span>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <span className="sev-count">{count}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="divider" />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {Object.entries(scanResult.summary?.byType || {}).map(([type, count]) => (
                    <div key={type} className="stat-card">
                      <div className="stat-card-label">
                        {type.replace('Cross-Site Scripting ', 'XSS ').replace(' Attack', '')}
                      </div>
                      <div className="stat-card-value" style={{ fontSize: 20 }}>{count}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Threat Distribution */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Threat Distribution</span>
                </div>
                <ThreatChart byType={scanResult.summary?.byType || {}} />
              </div>

            </div>

            {/* Row 2: Threat table (full width) */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="card-title">Detected Threats</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                  {scanResult.threats?.length ?? 0} events
                </span>
              </div>
              <ThreatFeed threats={scanResult.threats ?? []} />
            </div>

            {/* Row 3: AI Copilot + Executive Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">AI Security Analysis</span>
                </div>
                <AiPanel
                  analysis={aiResult}
                  loading={stage === STAGE.AI && !aiResult}
                  error={aiError}
                  modelUsed={aiResult?.model_used}
                />
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Executive Summary</span>
                </div>
                <ExecutiveSummary
                  summary={aiResult?.executive_summary}
                  loading={stage === STAGE.AI && !aiResult}
                />
              </div>

            </div>

            {/* Actions */}
            {stage === STAGE.DONE && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                <button
                  className="btn btn-success"
                  onClick={handleReport}
                  disabled={downloading}
                >
                  {downloading
                    ? <><div className="spinner" /> Generating...</>
                    : '↓ Download Incident Report (PDF)'}
                </button>
                <button className="btn btn-ghost" onClick={reset}>
                  Analyze Another File
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Idle landing ──────────────────────────────────────────────── */}
        {stage === STAGE.IDLE && !file && (
          <div className="animate-fade-in" style={{ marginTop: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { icon: '💉', label: 'SQL Injection',  desc: 'UNION SELECT, boolean-based, DROP TABLE' },
                { icon: '⚡', label: 'XSS',            desc: '<script>, onerror=, document.cookie' },
                { icon: '🔨', label: 'Brute Force',    desc: 'Repeated login failures, same IP' },
                { icon: '🗂️', label: 'Path Traversal', desc: '../, /etc/passwd, cmd.exe' },
              ].map(item => (
                <div key={item.label} className="card">
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{item.icon}</div>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>

            <div className="alert alert-info">
              <span>ℹ️</span>
              <div>
                <strong>Getting started:</strong> Upload a <code>.log</code> or <code>.txt</code> file above.
                The engine parses events, detects threats, scores risk, and generates an AI-powered analysis automatically.
                Sample files available in <code>sample-logs/</code>.
              </div>
            </div>
          </div>
        )}

      </main>

      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-dim)',
      }}>
        <span>WatchTower · AI Security Analyst · v1.0</span>
      </footer>
    </div>
  );
}
