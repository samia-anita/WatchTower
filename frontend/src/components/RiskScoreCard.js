import React from 'react';

function getRiskColor(s) {
  if (s >= 75) return '#ef4444';
  if (s >= 50) return '#f97316';
  if (s >= 25) return '#eab308';
  return '#10b981';
}

function getRiskGrade(s) {
  if (s >= 75) return { label: 'CRITICAL', bg: 'rgba(239,68,68,0.12)',  color: '#f87171', border: 'rgba(239,68,68,0.25)' };
  if (s >= 50) return { label: 'HIGH',     bg: 'rgba(249,115,22,0.12)', color: '#fb923c', border: 'rgba(249,115,22,0.25)' };
  if (s >= 25) return { label: 'MEDIUM',   bg: 'rgba(234,179,8,0.12)',  color: '#fbbf24', border: 'rgba(234,179,8,0.25)' };
  return              { label: 'LOW',      bg: 'rgba(16,185,129,0.12)', color: '#6ee7b7', border: 'rgba(16,185,129,0.25)' };
}

export default function RiskScoreCard({ score, totalThreats, totalEvents, filename }) {
  const s    = isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  const ths  = totalThreats ?? 0;
  const evs  = totalEvents  ?? 0;
  const col  = getRiskColor(s);
  const grade = getRiskGrade(s);

  const r   = 54;
  const circ = 2 * Math.PI * r;
  const off  = circ - (s / 100) * circ;

  return (
    <div className="card card-glow-blue">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 13, height: 13 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          Risk Score
        </div>
      </div>
      <div className="card-inner" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        <div className="risk-ring-wrap" style={{ marginBottom: 10 }}>
          <svg width="148" height="148" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="74" cy="74" r={r} fill="none" stroke="var(--bg-elevated)" strokeWidth="9" />
            <circle
              cx="74" cy="74" r={r} fill="none"
              stroke={col} strokeWidth="9"
              strokeDasharray={circ} strokeDashoffset={off}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)',
                filter: `drop-shadow(0 0 8px ${col}60)`,
              }}
            />
          </svg>
          <div className="risk-ring-center">
            <div className="risk-num" style={{ color: col }}>{s}</div>
            <div className="risk-denom">/100</div>
          </div>
        </div>

        <div className="risk-grade" style={{ background: grade.bg, color: grade.color, border: `1px solid ${grade.border}` }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block', flexShrink: 0 }} />
          {grade.label} RISK
        </div>

        {filename && (
          <div style={{
            marginTop: 12, fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: 'nowrap', maxWidth: '100%', textAlign: 'center', padding: '0 8px',
          }}>
            {filename}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14, width: '100%' }}>
          <div className="stat-mini">
            <div className="stat-mini-label">Threats</div>
            <div className="stat-mini-value" style={{ color: '#f97316', fontSize: 20 }}>{ths}</div>
          </div>
          <div className="stat-mini">
            <div className="stat-mini-label">Events</div>
            <div className="stat-mini-value" style={{ color: 'var(--blue)', fontSize: 20 }}>{evs}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
