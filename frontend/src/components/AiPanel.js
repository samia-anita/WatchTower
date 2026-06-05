import React from 'react';

function Section({ label, children }) {
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
      <div className="loading-box">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            className="spinner"
            style={{
              color: 'var(--blue)',
              width: 18,
              height: 18,
              borderWidth: 2,
            }}
          />
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-secondary)',
            }}
          >
            Generating security analysis...
          </span>
        </div>

        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          Querying Groq AI
        </div>

        <div className="loading-bar" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px 0' }}>
        <div
          className="alert alert-warn"
          style={{ flexDirection: 'column', gap: 6 }}
        >
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            AI Analysis Unavailable
          </div>

          <div style={{ fontSize: 12, opacity: 0.85 }}>
            {error}
          </div>

          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              marginTop: 4,
            }}
          >
            Configure a valid <code>GROQ_API_KEY</code> in the backend
            environment to enable AI analysis.
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: 20, height: 20 }}
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
        </div>

        <div className="empty-state-text">
          AI analysis pending
        </div>

        <div className="empty-state-sub">
          Upload a log file to trigger analysis
        </div>
      </div>
    );
  }

  const isFallback = modelUsed === 'rule-based-fallback';

  return (
    <div>
      {modelUsed && (
        <div className="model-tag">
          <span
            className="model-dot"
            style={{
              background: isFallback
                ? 'var(--amber)'
                : 'var(--green)',
            }}
          />

          {isFallback
            ? 'Rule-based fallback (Groq unavailable)'
            : `Groq • ${modelUsed}`}
        </div>
      )}

      {analysis.executive_summary && (
        <Section label="Executive Summary">
          {analysis.executive_summary}
        </Section>
      )}

      {analysis.explanation && (
        <Section label="Threat Explanation">
          {analysis.explanation}
        </Section>
      )}

      {analysis.risk_assessment && (
        <Section label="Risk Assessment">
          {analysis.risk_assessment}
        </Section>
      )}

      {analysis.recommendation && (
        <Section label="Recommended Action">
          {analysis.recommendation}
        </Section>
      )}
    </div>
  );
}