const { v4: uuidv4 } = require('uuid');

const PATH_TRAVERSAL_PATTERNS = [
  { pattern: /\.\.\//g, weight: 88, name: "Directory traversal (../)" },
  { pattern: /\.\.\\/g, weight: 88, name: "Windows directory traversal (..\\ )" },
  { pattern: /%2e%2e%2f/gi, weight: 90, name: "URL-encoded traversal (%2e%2e%2f)" },
  { pattern: /%2e%2e\//gi, weight: 90, name: "Partial URL-encoded traversal" },
  { pattern: /\.\.%2f/gi, weight: 90, name: "Mixed traversal (..%2f)" },
  { pattern: /%252e%252e/gi, weight: 92, name: "Double URL-encoded traversal" },
  { pattern: /\/etc\/passwd/i, weight: 98, name: "/etc/passwd access" },
  { pattern: /\/etc\/shadow/i, weight: 99, name: "/etc/shadow access (critical)" },
  { pattern: /\/etc\/hosts/i, weight: 82, name: "/etc/hosts access" },
  { pattern: /\/etc\/sudoers/i, weight: 96, name: "/etc/sudoers access" },
  { pattern: /\/proc\/self/i, weight: 88, name: "/proc/self access" },
  { pattern: /\/windows\/system32/i, weight: 92, name: "Windows System32 access" },
  { pattern: /\/winnt\/system32/i, weight: 90, name: "WinNT System32 access" },
  { pattern: /cmd\.exe/i, weight: 95, name: "cmd.exe access" },
  { pattern: /powershell\.exe/i, weight: 95, name: "PowerShell access" },
  { pattern: /web\.config/i, weight: 90, name: "web.config access" },
  { pattern: /\.htaccess/i, weight: 85, name: ".htaccess access" },
  { pattern: /\/boot\.ini/i, weight: 88, name: "boot.ini access" },
  { pattern: /\/var\/log\//i, weight: 78, name: "Log file access" },
  { pattern: /\.\.\.\.\//g, weight: 85, name: "Extended traversal (..../ )" },
  { pattern: /\.\.(\/|%2f|%5c){2,}/gi, weight: 90, name: "Chained traversal" },
];

function detectPathTraversal(events) {
  const threats = [];

  for (const event of events) {
    const textToCheck = [
      event.raw_line,
      event.path,
    ].filter(Boolean).join(' ');

    let maxScore = 0;
    let matchedPatterns = [];

    for (const p of PATH_TRAVERSAL_PATTERNS) {
      if (p.pattern.test(textToCheck)) {
        maxScore = Math.max(maxScore, p.weight);
        matchedPatterns.push(p.name);
        // Reset lastIndex for global patterns
        p.pattern.lastIndex = 0;
      }
    }

    if (maxScore > 0) {
      threats.push({
        id: uuidv4(),
        scan_id: event.scan_id,
        event_id: event.id,
        threat_type: 'Path Traversal',
        severity: getSeverity(maxScore),
        risk_score: maxScore,
        description: `Path traversal attempt detected: ${matchedPatterns.join(', ')}`,
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

module.exports = { detectPathTraversal };
