import React from 'react';

function AiSection({ label, children }) {
  return (
    <div className="ai-section">
      <div className="ai-section-label">{label}</div>
      <div className="ai-section-body">{children}</div>
    </div>
  );
}

export default function AiPanel({ analysis, loading, error, modelUsed }) {
  if (loading) {
    return (
      <div className="loading-overlay">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="spinner" style={{ color: 'var(--accent-blue)' }} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Running AI analysis...
          </span>
        </div>
        <div className="loading-text">Querying language model for threat insights</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-warn" style={{ flexDirection: 'column', gap: 4 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>AI Analysis Unavailable</div>
        <div style={{ fontSize: 12 }}>{error}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          Ensure Ollama is running: <code>ollama serve</code>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🤖</div>
        <div className="empty-state-text">AI analysis will appear after upload</div>
      </div>
    );
  }

  return (
    <div>
      {modelUsed && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 14,
          padding: '3px 9px',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}>
          <span style={{ color: 'var(--accent-green)', fontSize: 8 }}>●</span>
          {modelUsed === 'rule-based-fallback'
            ? 'Rule-based fallback (Ollama offline)'
            : modelUsed}
        </div>
      )}

      {analysis.explanation && (
        <AiSection label="Threat Explanation">{analysis.explanation}</AiSection>
      )}
      {analysis.risk_assessment && (
        <AiSection label="Risk Assessment">{analysis.risk_assessment}</AiSection>
      )}
      {analysis.recommendation && (
        <AiSection label="Recommended Action">{analysis.recommendation}</AiSection>
      )}
    </div>
  );
}
