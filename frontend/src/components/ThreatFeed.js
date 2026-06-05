import React, { useState, useEffect, useRef } from 'react';
import { lookupIpGeo } from '../services/api';

const THREAT_ICONS = {
  'SQL Injection':              '💉',
  'Cross-Site Scripting (XSS)': '⚡',
  'Brute Force Attack':         '🔨',
  'Path Traversal':             '🗂️',
};
const THREAT_BG = {
  'SQL Injection':              'rgba(239,68,68,0.12)',
  'Cross-Site Scripting (XSS)': 'rgba(249,115,22,0.12)',
  'Brute Force Attack':         'rgba(234,179,8,0.12)',
  'Path Traversal':             'rgba(59,130,246,0.12)',
};
const THREAT_COL = {
  'SQL Injection':              '#f87171',
  'Cross-Site Scripting (XSS)': '#fb923c',
  'Brute Force Attack':         '#fbbf24',
  'Path Traversal':             '#60a5fa',
};
const SEV_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function Chevron({ open }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ width: 12, height: 12, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none', color: 'var(--text-dim)' }}>
      <polyline points="6,9 12,15 18,9"/>
    </svg>
  );
}

function exportCsv(threats) {
  const headers = ['Threat Type', 'Severity', 'Risk Score', 'Source IP', 'Timestamp', 'Description', 'Pattern', 'Evidence'];
  const rows = threats.map(t => [
    t.threat_type, t.severity, t.risk_score, t.source_ip || '',
    t.timestamp || '', t.description || '', t.matched_pattern || '',
    (t.raw_evidence || '').replace(/"/g, '""'),
  ].map(v => `"${v}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `threats-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function IpCell({ ip }) {
  const [geo, setGeo] = useState(undefined); // undefined = loading, null = no data
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (!ip) { setGeo(null); return; }
    lookupIpGeo(ip).then(g => { if (mounted.current) setGeo(g); });
    return () => { mounted.current = false; };
  }, [ip]);

  if (!ip) return <span style={{ color: 'var(--text-dim)' }}>—</span>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span className="ip-pill">{ip}</span>
      {geo && (
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: 'var(--text-muted)', letterSpacing: '0.03em',
        }}>
          {geo.flag} {geo.city ? `${geo.city}, ` : ''}{geo.country}
        </span>
      )}
    </div>
  );
}

export default function ThreatFeed({ threats = [] }) {
  const [expanded, setExpanded] = useState(null);
  const [filter,   setFilter]   = useState('ALL');

  const sorted   = [...threats].sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
  const counts   = threats.reduce((acc, t) => { acc[t.severity] = (acc[t.severity] || 0) + 1; return acc; }, {});
  const filtered = filter === 'ALL' ? sorted : sorted.filter(t => t.severity === filter);

  if (threats.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <div className="empty-state-text">No threats detected</div>
        <div className="empty-state-sub">Upload a log file to start analysis</div>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar: filters left, CSV right — flat flex row, no overflow */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, padding: '10px 16px 10px',
        borderBottom: '1px solid var(--border)',
      }}>
        {/* Severity filters */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(f => {
            const c = f === 'ALL' ? threats.length : (counts[f] || 0);
            if (f !== 'ALL' && c === 0) return null;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: filter === f ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--border)',
                  background: filter === f ? 'rgba(59,130,246,0.12)' : 'transparent',
                  color: filter === f ? 'var(--blue)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.06em', cursor: 'pointer', transition: 'all 0.12s',
                }}
              >
                {f} <span style={{ opacity: 0.6 }}>{c}</span>
              </button>
            );
          })}
        </div>

        {/* CSV export — always visible */}
        <button
          onClick={() => exportCsv(filtered)}
          title={`Export ${filtered.length} threat${filtered.length !== 1 ? 's' : ''} to CSV`}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
            padding: '5px 12px',
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: 7,
            color: 'var(--green)',
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
            cursor: 'pointer', transition: 'all 0.12s',
          }}
          onMouseEnter={e => Object.assign(e.currentTarget.style, { background: 'rgba(16,185,129,0.16)', borderColor: 'rgba(16,185,129,0.4)' })}
          onMouseLeave={e => Object.assign(e.currentTarget.style, { background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)' })}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
      </div>

      <div className="scroll-list" style={{ maxHeight: 380 }}>
        <table className="threat-table">
          <thead>
            <tr>
              <th>Threat Type</th>
              <th>Severity</th>
              <th>Source IP</th>
              <th style={{ textAlign: 'right' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t, idx) => {
              const key    = t.id ?? idx;
              const icon   = THREAT_ICONS[t.threat_type] || '⚠️';
              const bg     = THREAT_BG[t.threat_type]    || 'rgba(91,122,148,0.1)';
              const col    = THREAT_COL[t.threat_type]   || 'var(--text-muted)';
              const isOpen = expanded === key;
              const sev    = (t.severity ?? 'UNKNOWN').toLowerCase();

              return (
                <React.Fragment key={key}>
                  <tr onClick={() => setExpanded(isOpen ? null : key)}>
                    <td>
                      <div className="type-cell">
                        <div className="type-icon" style={{ background: bg }}>{icon}</div>
                        <span className="type-name">{t.threat_type ?? '—'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${sev}`}>{(t.severity ?? 'UNKNOWN').toUpperCase()}</span>
                    </td>
                    <td><IpCell ip={t.source_ip} /></td>
                    <td>
                      <div className="score-cell" style={{ color: col }}>
                        {t.risk_score ?? '—'}
                        <Chevron open={isOpen} />
                      </div>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="detail-row">
                      <td colSpan={4}>
                        <div className="detail-inner anim-fade">
                          <div className="detail-grid">
                            {t.description     && (<><div className="dl">Description</div><div className="dv" style={{ fontFamily: 'var(--font-ui)' }}>{t.description}</div></>)}
                            {t.matched_pattern && (<><div className="dl">Pattern</div><div className="dv cyan">{t.matched_pattern}</div></>)}
                            {t.timestamp       && (<><div className="dl">Timestamp</div><div className="dv">{t.timestamp}</div></>)}
                            {t.raw_evidence    && (<><div className="dl">Evidence</div><div className="dv">{String(t.raw_evidence).substring(0, 300)}</div></>)}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
