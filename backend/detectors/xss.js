const { v4: uuidv4 } = require('uuid');

const XSS_PATTERNS = [
  { pattern: /<script[\s>]/i, weight: 95, name: "Script tag injection" },
  { pattern: /<\/script>/i, weight: 90, name: "Closing script tag" },
  { pattern: /javascript:/i, weight: 88, name: "JavaScript protocol handler" },
  { pattern: /onerror\s*=/i, weight: 85, name: "onerror event handler" },
  { pattern: /onload\s*=/i, weight: 82, name: "onload event handler" },
  { pattern: /onclick\s*=/i, weight: 75, name: "onclick event injection" },
  { pattern: /onmouseover\s*=/i, weight: 72, name: "Mouse event injection" },
  { pattern: /<iframe/i, weight: 85, name: "iFrame injection" },
  { pattern: /document\.cookie/i, weight: 92, name: "Cookie theft attempt" },
  { pattern: /document\.location/i, weight: 80, name: "Redirect injection" },
  { pattern: /alert\s*\(/i, weight: 70, name: "Alert() function (XSS probe)" },
  { pattern: /eval\s*\(/i, weight: 88, name: "eval() execution" },
  { pattern: /\.innerHTML\s*=/i, weight: 78, name: "innerHTML manipulation" },
  { pattern: /fromCharCode\s*\(/i, weight: 82, name: "CharCode encoding bypass" },
  { pattern: /data:text\/html/i, weight: 85, name: "Data URI XSS" },
  { pattern: /%3Cscript%3E|%3C%2Fscript%3E/i, weight: 90, name: "URL-encoded script tag" },
  { pattern: /&#\d+;|&lt;script|&gt;/i, weight: 75, name: "HTML entity encoded XSS" },
  { pattern: /vbscript:/i, weight: 88, name: "VBScript protocol handler" },
  { pattern: /<img[^>]+src\s*=\s*['"]/i, weight: 65, name: "Image tag injection" },
  { pattern: /svg.*onload\s*=/i, weight: 85, name: "SVG XSS vector" },
];

function detectXSS(events) {
  const threats = [];

  for (const event of events) {
    const textToCheck = [
      event.raw_line,
      event.path,
      event.user_agent
    ].filter(Boolean).join(' ');

    let maxScore = 0;
    let matchedPatterns = [];

    for (const p of XSS_PATTERNS) {
      if (p.pattern.test(textToCheck)) {
        maxScore = Math.max(maxScore, p.weight);
        matchedPatterns.push(p.name);
      }
    }

    if (maxScore > 0) {
      threats.push({
        id: uuidv4(),
        scan_id: event.scan_id,
        event_id: event.id,
        threat_type: 'Cross-Site Scripting (XSS)',
        severity: getSeverity(maxScore),
        risk_score: maxScore,
        description: `XSS attempt detected: ${matchedPatterns.join(', ')}`,
        matched_pattern: matchedPatterns.join(' | '),
        source_ip: event.source_ip,
        timestamp: event.timestamp,
        raw_evidence: event.raw_line.substring(0, 500),
      });
    }
  }

  return threats;
}

function getSeverity(score) {
  if (score >= 90) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

module.exports = { detectXSS };
