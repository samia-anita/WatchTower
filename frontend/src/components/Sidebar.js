import React, { useState, useEffect } from 'react';
import { getScanList } from '../services/api';

function ShieldIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function HomeIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg>; }
function GridIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>; }
function AlertIcon()   { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function FileIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>; }
function UploadIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>; }
function GearIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>; }
function HistoryIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="12,8 12,12 14,14"/><path d="M3.05 11a9 9 0 111.17 4.5"/><polyline points="3,16 3,11 8,11"/></svg>; }

function riskColor(s) {
  if (s >= 75) return '#ef4444';
  if (s >= 50) return '#f97316';
  if (s >= 25) return '#eab308';
  return '#10b981';
}

export default function Sidebar({ backendOnline, groqStatus, activePage, onNavigate, onLoadScan }) {
  const [scans, setScans]     = useState([]);
  const [histOpen, setHistOpen] = useState(true);
  const [loading, setLoading]  = useState(false);

  const groqClass = groqStatus === 'online' ? 'online' : groqStatus === 'checking' ? 'warn' : 'offline';
  const groqLabel = groqStatus === 'online' ? 'Online' : groqStatus === 'checking' ? 'Checking' : 'Offline';

  useEffect(() => {
    if (!backendOnline) return;
    setLoading(true);
    getScanList()
      .then(list => setScans(list.slice(0, 8)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [backendOnline]);

  const navItems = [
    { id: 'home',      label: 'Home',        icon: <HomeIcon /> },
    { id: 'dashboard', label: 'Dashboard',   icon: <GridIcon /> },
    { id: 'threats',   label: 'Threat Feed', icon: <AlertIcon /> },
    { id: 'reports',   label: 'Reports',     icon: <FileIcon /> },
  ];

  const toolItems = [
    { id: 'upload',   label: 'Upload Log', icon: <UploadIcon /> },
    { id: 'settings', label: 'Settings',   icon: <GearIcon /> },
  ];

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-mark"><ShieldIcon /></div>
        <div className="logo-text">
          <div className="logo-name">WatchTower</div>
          <div className="logo-sub">Security Analyst</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* Main nav */}
        <div className="sidebar-section-label">Main</div>
        {navItems.map(item => (
          <button key={item.id} className={`nav-btn ${activePage === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}>
            {item.icon}{item.label}
          </button>
        ))}

        <div className="nav-divider" />

        {/* Tools */}
        <div className="sidebar-section-label">Tools</div>
        {toolItems.map(item => (
          <button key={item.id} className={`nav-btn ${activePage === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}>
            {item.icon}{item.label}
          </button>
        ))}

        <div className="nav-divider" />

        {/* Scan History */}
        <button
          className="sidebar-section-label history-toggle"
          onClick={() => setHistOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 0 6px', color: 'inherit' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <HistoryIcon />
            Scan History
          </span>
          <span style={{ fontSize: 10, opacity: 0.4 }}>{histOpen ? '▲' : '▼'}</span>
        </button>

        {histOpen && (
          <div className="history-list">
            {loading && (
              <div style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>
                Loading...
              </div>
            )}
            {!loading && scans.length === 0 && (
              <div style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-dim)' }}>
                No previous scans
              </div>
            )}
            {scans.map(scan => (
              <button
                key={scan.id}
                className="history-item"
                onClick={() => onLoadScan(scan.id)}
                title={`${scan.filename} — Score: ${scan.overall_risk_score}`}
              >
                <div className="history-item-score" style={{ background: riskColor(scan.overall_risk_score || 0) }}>
                  {scan.overall_risk_score ?? '?'}
                </div>
                <div className="history-item-info">
                  <div className="history-item-name">{scan.filename}</div>
                  <div className="history-item-meta">
                    {scan.total_threats ?? 0} threats · {new Date(scan.created_at).toLocaleDateString()}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* System status footer */}
      <div className="sidebar-footer">
        <div className="sys-status-title">System Status</div>
        <div className="sys-status-row">
          <div className="sys-status-label"><span className={`status-dot ${backendOnline ? 'online' : 'offline'}`} />API Backend</div>
          <span className={`sys-status-val ${backendOnline ? 'online' : 'offline'}`}>{backendOnline ? 'Online' : 'Offline'}</span>
        </div>
        <div className="sys-status-row">
          <div className="sys-status-label"><span className={`status-dot ${groqClass}`} />LLM Engine</div>
          <span className={`sys-status-val ${groqClass}`}>{groqLabel}</span>
        </div>
        <div style={{ marginTop: 10, padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)', textAlign: 'center', letterSpacing: '0.05em' }}>
          v1.0.0 · On-Device Analysis
        </div>
      </div>
    </aside>
  );
}