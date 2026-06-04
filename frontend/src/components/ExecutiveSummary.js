import React from 'react';

export default function ExecutiveSummary({ summary, loading }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 0' }}>
        <div className="spinner" style={{ color: 'var(--accent-blue)' }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Generating summary...</span>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <div className="empty-state-text">Executive summary will appear after analysis</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 600,
          background: 'rgba(47,126,245,0.12)',
          color: 'var(--accent-blue)',
          padding: '2px 8px',
          borderRadius: 'var(--radius-sm)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          Non-technical
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Plain-language overview for management
        </span>
      </div>

      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--accent-blue)',
        borderRadius: '0 var(--radius-md) var(--radius-md) 0',
        padding: '14px 18px',
        fontSize: 13,
        color: 'var(--text-primary)',
        lineHeight: 1.8,
      }}>
        {summary}
      </div>
    </div>
  );
}
