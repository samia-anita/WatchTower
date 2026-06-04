import React, { useState } from 'react';

const THREAT_ICONS = {
  'SQL Injection':              '💉',
  'Cross-Site Scripting (XSS)': '⚡',
  'Brute Force Attack':         '🔨',
  'Path Traversal':             '🗂️',
};

const THREAT_COLORS = {
  'SQL Injection':              'var(--severity-critical)',
  'Cross-Site Scripting (XSS)': 'var(--severity-high)',
  'Brute Force Attack':         'var(--severity-medium)',
  'Path Traversal':             'var(--accent-blue)',
};

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function SeverityBadge({ severity }) {
  const sev = severity ?? 'UNKNOWN';
  return (
    <span className={`badge badge-${sev.toLowerCase()}`}>{sev}</span>
  );
}

export default function ThreatFeed({ threats = [] }) {
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter]     = useState('ALL');

  const sorted = [...threats].sort((a, b) =>
    (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9)
  );

  const severityCounts = threats.reduce((acc, t) => {
    acc[t.severity] = (acc[t.severity] || 0) + 1;
    return acc;
  }, {});

  const filters = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

  const filtered = filter === 'ALL'
    ? sorted
    : sorted.filter(t => t.severity === filter);

  if (threats.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔍</div>
        <div className="empty-state-text">No threats detected</div>
      </div>
    );
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="filter-tabs">
        {filters.map(f => {
          const count = f === 'ALL' ? threats.length : (severityCounts[f] || 0);
          if (f !== 'ALL' && count === 0) return null;
          return (
            <button
              key={f}
              className={`filter-tab ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
              {count > 0 && <span className="filter-tab-count">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="scroll-list" style={{ maxHeight: 340 }}>
        <table className="threat-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Severity</th>
              <th>Source IP</th>
              <th style={{ textAlign: 'right' }}>Score</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((threat, idx) => {
              const threatKey = threat.id ?? idx;
              const icon      = THREAT_ICONS[threat.threat_type]  || '⚠️';
              const color     = THREAT_COLORS[threat.threat_type] || 'var(--text-muted)';
              const isOpen    = expanded === threatKey;

              return (
                <React.Fragment key={threatKey}>
                  <tr onClick={() => setExpanded(isOpen ? null : threatKey)}>
                    <td className="col-type">
                      <span
                        className="threat-type-icon"
                        style={{ background: `${color}18` }}
                      >
                        {icon}
                      </span>
                      {threat.threat_type ?? '—'}
                    </td>
                    <td><SeverityBadge severity={threat.severity} /></td>
                    <td className="col-ip">{threat.source_ip ?? '—'}</td>
                    <td className="col-score" style={{ color }}>
                      {threat.risk_score ?? '—'}
                      <span style={{ color: 'var(--text-dim)', marginLeft: 3, fontSize: 10 }}>
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="threat-detail-row">
                      <td colSpan={4}>
                        <div className="threat-detail-inner">
                          <dl>
                            {threat.description && (
                              <>
                                <dt>Description</dt>
                                <dd style={{ fontFamily: 'var(--font-ui)', fontSize: 12 }}>{threat.description}</dd>
                              </>
                            )}
                            {threat.matched_pattern && (
                              <>
                                <dt>Pattern</dt>
                                <dd style={{ color }}>{threat.matched_pattern}</dd>
                              </>
                            )}
                            {threat.timestamp && (
                              <>
                                <dt>Timestamp</dt>
                                <dd>{new Date(threat.timestamp).toLocaleString()}</dd>
                              </>
                            )}
                            {threat.raw_evidence && (
                              <>
                                <dt>Evidence</dt>
                                <dd>{String(threat.raw_evidence).substring(0, 240)}</dd>
                              </>
                            )}
                          </dl>
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
