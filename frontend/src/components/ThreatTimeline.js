import React, { useMemo } from 'react';

const SEV_COLOR = {
  CRITICAL: '#ef4444',
  HIGH:     '#f97316',
  MEDIUM:   '#eab308',
  LOW:      '#3b82f6',
};

const MONTH_MAP = {
  Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5,
  Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11,
};

function parseTs(ts) {
  if (!ts || typeof ts !== 'string') return null;
  try {
    // Apache/Nginx: 01/Jun/2026:09:07:00 +0000
    const a = ts.match(/(\d{1,2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})/);
    if (a) {
      const mo = MONTH_MAP[a[2].charAt(0).toUpperCase() + a[2].slice(1).toLowerCase()];
      if (mo !== undefined) {
        const ms = Date.UTC(+a[3], mo, +a[1], +a[4], +a[5], +a[6]);
        if (isFinite(ms)) return ms;
      }
    }
    // Syslog: Jun  1 09:07:00
    const b = ts.match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (b) {
      const mo = MONTH_MAP[b[1].charAt(0).toUpperCase() + b[1].slice(1).toLowerCase()];
      if (mo !== undefined) {
        const ms = Date.UTC(new Date().getUTCFullYear(), mo, +b[2], +b[3], +b[4], +b[5]);
        if (isFinite(ms)) return ms;
      }
    }
    // ISO / YYYY-MM-DD HH:MM:SS
    const ms = Date.parse(ts.replace(' ', 'T'));
    if (isFinite(ms)) return ms;
  } catch { /* ignore */ }
  return null;
}

function fmtTime(ms) {
  try {
    return new Date(ms).toISOString().slice(11, 16); // "HH:MM"
  } catch { return ''; }
}

function fmtDate(ms) {
  try {
    return new Date(ms).toISOString().slice(0, 10); // "YYYY-MM-DD"
  } catch { return ''; }
}

export default function ThreatTimeline({ threats = [] }) {
  const { points, tMin, tMax, hasTime } = useMemo(() => {
    const pts = threats.map((t, i) => ({ ...t, _ms: parseTs(t.timestamp), _i: i }));
    const timed = pts.filter(p => p._ms !== null && isFinite(p._ms));

    if (timed.length < 2) {
      return {
        points: pts.map((t, i) => ({
          ...t,
          _pct: threats.length > 1 ? (i / (threats.length - 1)) * 100 : 50,
        })),
        tMin: null, tMax: null, hasTime: false,
      };
    }

    const times = timed.map(p => p._ms);
    const mn = Math.min(...times);
    const mx = Math.max(...times);
    const range = mx - mn || 1;

    return {
      points: timed.map(p => ({ ...p, _pct: ((p._ms - mn) / range) * 100 })),
      tMin: mn, tMax: mx, hasTime: true,
    };
  }, [threats]);

  if (threats.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-text">No timeline data</div>
      </div>
    );
  }

  return (
    <div className="timeline-wrap">
      {/* Legend */}
      <div className="timeline-legend">
        {Object.entries(SEV_COLOR).map(([sev, col]) => {
          const n = threats.filter(t => t.severity === sev).length;
          if (!n) return null;
          return (
            <div key={sev} className="tl-legend-item">
              <span className="tl-dot" style={{ background: col }} />
              <span>{sev}</span>
              <span style={{ opacity: 0.5 }}>({n})</span>
            </div>
          );
        })}
      </div>

      {/* Track */}
      <div className="timeline-track-wrap">
        <div className="timeline-track">
          {points.map((t, idx) => {
            const col = SEV_COLOR[t.severity] || '#64748b';
            const label = t._ms !== null
              ? `${fmtTime(t._ms)} · ${t.threat_type} · ${t.source_ip || '?'}`
              : `#${t._i + 1} · ${t.threat_type} · ${t.source_ip || '?'}`;

            // Smart tooltip alignment: pin to left edge for early dots, right edge for late dots
            const tooltipStyle = t._pct < 20
              ? { left: 0, right: 'auto', transform: 'none' }
              : t._pct > 80
              ? { left: 'auto', right: 0, transform: 'none' }
              : { left: '50%', right: 'auto', transform: 'translateX(-50%)' };

            return (
              <div
                key={t.id || idx}
                className="tl-event"
                style={{ left: `${t._pct}%`, '--tl-color': col }}
                title={label}
              >
                <div className="tl-dot-large" />
                <div className="tl-tooltip" style={tooltipStyle}>
                  <div className="tl-tt-type">{t.threat_type}</div>
                  {t.source_ip && <div className="tl-tt-meta"><span className="tl-tt-ip">{t.source_ip}</span></div>}
                  {t._ms !== null && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>
                      {fmtDate(t._ms)} {fmtTime(t._ms)}
                    </div>
                  )}
                  <span className={`badge badge-${(t.severity || '').toLowerCase()}`} style={{ marginTop: 4, display: 'inline-block' }}>
                    {t.severity}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="timeline-axis" />
      </div>

      {/* Labels */}
      <div className="timeline-labels">
        {hasTime ? (
          <>
            <span>{fmtDate(tMin)} {fmtTime(tMin)}</span>
            <span style={{ color: 'var(--text-dim)' }}>←  attack window  →</span>
            <span>{fmtDate(tMax)} {fmtTime(tMax)}</span>
          </>
        ) : (
          <span style={{ color: 'var(--text-dim)', margin: '0 auto' }}>
            Detection order — hover dots for details
          </span>
        )}
      </div>
    </div>
  );
}