import React from 'react';

function getRiskColor(score) {
  if (score >= 75) return 'var(--severity-critical)';
  if (score >= 50) return 'var(--severity-high)';
  if (score >= 25) return 'var(--severity-medium)';
  return 'var(--accent-green)';
}

function getRiskGrade(score) {
  if (score >= 75) return { label: 'CRITICAL', bg: 'rgba(240,65,65,0.12)',  color: '#f87171' };
  if (score >= 50) return { label: 'HIGH',     bg: 'rgba(244,123,48,0.12)', color: '#fb923c' };
  if (score >= 25) return { label: 'MEDIUM',   bg: 'rgba(232,185,48,0.12)', color: '#fbbf24' };
  return                   { label: 'LOW',     bg: 'rgba(34,197,94,0.12)',  color: '#86efac' };
}

export default function RiskScoreCard({ score, totalThreats, totalEvents, filename }) {
  const safeScore        = isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  const safeTotalThreats = totalThreats ?? 0;
  const safeTotalEvents  = totalEvents  ?? 0;

  const color = getRiskColor(safeScore);
  const grade = getRiskGrade(safeScore);

  const radius       = 52;
  const circumference = 2 * Math.PI * radius;
  const offset       = circumference - (safeScore / 100) * circumference;

  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div className="card-header" style={{ justifyContent: 'center', borderBottom: 'none', marginBottom: 8, paddingBottom: 0 }}>
        <span className="card-title">Risk Score</span>
      </div>

      {/* Ring */}
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0' }}>
        <svg width="136" height="136" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="68" cy="68" r={radius} fill="none" stroke="var(--bg-elevated)" strokeWidth="7" />
          <circle
            cx="68" cy="68" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div className="risk-score-value" style={{ color }}>{safeScore}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>/100</div>
        </div>
      </div>

      {/* Grade pill */}
      <div style={{ marginBottom: 16 }}>
        <span className="risk-score-grade" style={{ background: grade.bg, color: grade.color }}>
          {grade.label} RISK
        </span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="stat-card">
          <div className="stat-card-label">Threats</div>
          <div className="stat-card-value" style={{ color: 'var(--severity-high)', fontSize: 22 }}>{safeTotalThreats}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Events</div>
          <div className="stat-card-value" style={{ color: 'var(--accent-blue)', fontSize: 22 }}>{safeTotalEvents}</div>
        </div>
      </div>

      {filename && (
        <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filename}
        </div>
      )}
    </div>
  );
}
