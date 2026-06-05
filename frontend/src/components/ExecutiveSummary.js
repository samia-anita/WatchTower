import React from 'react';

export default function ExecutiveSummary({ summary, loading }) {
  if (loading) {
    return (
      <div className="loading-box" style={{ padding: '24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="spinner" style={{ color: 'var(--purple)', width: 16, height: 16, borderWidth: 2 }} />
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Generating summary...</span>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20 }}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <div className="empty-state-text">Executive summary pending</div>
        <div className="empty-state-sub">Plain-language overview for management</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
          background: 'rgba(139,92,246,0.12)', color: 'var(--purple)',
          padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase',
          letterSpacing: '0.07em', border: '1px solid rgba(139,92,246,0.2)',
        }}>
          Non-Technical
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Management overview</span>
      </div>
      <div className="exec-summary">{summary}</div>
    </div>
  );
}
