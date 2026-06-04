import React from 'react';

const COLORS = {
  'SQL Injection':              '#ef4444',
  'Cross-Site Scripting (XSS)': '#f97316',
  'Brute Force Attack':         '#f59e0b',
  'Path Traversal':             '#3b82f6',
};
const DEFAULT_COLOR = '#64748b';

export default function ThreatChart({ byType = {} }) {
  const entries = Object.entries(byType).filter(([, v]) => v > 0);

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <div className="empty-state-text">No threat data to chart</div>
      </div>
    );
  }

  const maxVal = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div style={{ height: '220px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 10, padding: '8px 0' }}>
      {entries.map(([type, count]) => {
        const color    = COLORS[type] || DEFAULT_COLOR;
        const widthPct = Math.round((count / maxVal) * 100);
        const label    = type
          .replace('Cross-Site Scripting ', 'XSS ')
          .replace(' Attack', '');

        return (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 110,
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              textAlign: 'right',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {label}
            </div>
            <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 4, height: 22, overflow: 'hidden' }}>
              <div style={{
                width: `${widthPct}%`,
                height: '100%',
                background: color,
                borderRadius: 4,
                opacity: 0.8,
                transition: 'width 0.6s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 6,
                minWidth: 28,
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono)' }}>
                  {count}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
