const { v4: uuidv4 } = require('uuid');

const SQL_PATTERNS = [
  { pattern: /'\s*OR\s+['"\d]+=\s*['"\d]+/i, weight: 95, name: "Boolean-based SQLi" },
  { pattern: /UNION\s+(?:ALL\s+)?SELECT/i, weight: 92, name: "UNION SELECT SQLi" },
  { pattern: /DROP\s+TABLE/i, weight: 98, name: "DROP TABLE attack" },
  { pattern: /INSERT\s+INTO\s+\w+/i, weight: 80, name: "INSERT injection" },
  { pattern: /DELETE\s+FROM\s+\w+/i, weight: 85, name: "DELETE injection" },
  { pattern: /UPDATE\s+\w+\s+SET\s+\w+\s*=/i, weight: 80, name: "UPDATE injection" },
  { pattern: /EXEC\s*\(|EXECUTE\s*\(/i, weight: 90, name: "Stored procedure execution" },
  { pattern: /xp_cmdshell/i, weight: 99, name: "xp_cmdshell (RCE via SQL)" },
  { pattern: /SLEEP\s*\(\s*\d+\s*\)|WAITFOR\s+DELAY/i, weight: 88, name: "Time-based blind SQLi" },
  { pattern: /BENCHMARK\s*\(/i, weight: 85, name: "Benchmark-based SQLi" },
  { pattern: /information_schema/i, weight: 75, name: "Schema enumeration" },
  { pattern: /'[^']*'[^']*'/i, weight: 60, name: "Quote manipulation" },
  { pattern: /--\s*$|;\s*--/m, weight: 65, name: "SQL comment injection" },
  { pattern: /\/\*.*\*\//s, weight: 60, name: "Inline comment injection" },
  { pattern: /CHAR\s*\(\s*\d+/i, weight: 70, name: "Character encoding bypass" },
  { pattern: /%27|%22|%3D|%3B/i, weight: 65, name: "URL-encoded SQL chars" },
];

function detectSQLInjection(events) {
  const threats = [];

  for (const event of events) {
    const textToCheck = [
      event.raw_line,
      event.path,
      event.user_agent
    ].filter(Boolean).join(' ');

    let maxScore = 0;
    let matchedPatterns = [];

    for (const p of SQL_PATTERNS) {
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
        threat_type: 'SQL Injection',
        severity: getSeverity(maxScore),
        risk_score: maxScore,
        description: `SQL Injection attempt detected: ${matchedPatterns.join(', ')}`,
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

module.exports = { detectSQLInjection };
