import React from 'react';

const COLS = {
  'SQL Injection':              { bar: '#ef4444', glow: 'rgba(239,68,68,0.35)' },
  'Cross-Site Scripting (XSS)': { bar: '#f97316', glow: 'rgba(249,115,22,0.35)' },
  'Brute Force Attack':         { bar: '#eab308', glow: 'rgba(234,179,8,0.35)' },
  'Path Traversal':             { bar: '#3b82f6', glow: 'rgba(59,130,246,0.35)' },
};
const DEF = { bar: '#64748b', glow: 'rgba(100,116,139,0.3)' };

export default function ThreatChart({ byType = {} }) {
  const entries = Object.entries(byType).filter(([, v]) => v > 0);

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
            <rect x="18" y="3" width="4" height="18"/>
            <rect x="10" y="8" width="4" height="13"/>
            <rect x="2" y="13" width="4" height="8"/>
          </svg>
        </div>
        <div className="empty-state-text">No distribution data</div>
      </div>
    );
  }

  const maxVal = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {entries.map(([type, count]) => {
        const c   = COLS[type] || DEF;
        const pct = Math.round((count / maxVal) * 100);
        const lbl = type.replace('Cross-Site Scripting ', 'XSS ').replace(' Attack', '');

        return (
          <div key={type}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 7,
            }}>
              <span style={{
                fontSize: 11, color: 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)', fontWeight: 500,
              }}>
                {lbl}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                fontWeight: 800, color: c.bar,
              }}>
                {count}
              </span>
            </div>
            <div style={{
              height: 10, background: 'var(--bg-elevated)',
              borderRadius: 5, overflow: 'hidden',
            }}>
              <div style={{
                width: `${pct}%`, height: '100%',
                background: `linear-gradient(90deg, ${c.bar}cc, ${c.bar})`,
                borderRadius: 5,
                transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
                boxShadow: `0 0 10px ${c.glow}`,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
