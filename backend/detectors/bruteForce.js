const { v4: uuidv4 } = require('uuid');

const AUTH_FAIL_PATTERNS = [
  /failed\s+(password|login|authentication|auth)/i,
  /authentication\s+failure/i,
  /invalid\s+(password|credentials|user|login)/i,
  /login\s+failed/i,
  /bad\s+password/i,
  /wrong\s+password/i,
  /access\s+denied/i,
  /unauthorized/i,
  /invalid\s+username/i,
  /too\s+many\s+attempts/i,
  /account\s+locked/i,
  /login\s+attempt\s+failed/i,
  /\b401\b.*unauthorized/i,
  /\bauth\s+error\b/i,
  /password\s+mismatch/i,
];

const BRUTE_FORCE_THRESHOLD = 5; // attempts before flagging
const TIME_WINDOW_MS = 5 * 60 * 1000; // 5-minute window

function detectBruteForce(events) {
  const threats = [];

  // Track failed auth attempts by IP
  const ipFailures = new Map();

  for (const event of events) {
    const isAuthFailure = AUTH_FAIL_PATTERNS.some(p => p.test(event.raw_line));
    if (!isAuthFailure) continue;

    const ip = event.source_ip || 'unknown';
    if (!ipFailures.has(ip)) {
      ipFailures.set(ip, []);
    }
    ipFailures.get(ip).push(event);
  }

  // Find IPs exceeding threshold
  for (const [ip, failEvents] of ipFailures.entries()) {
    // Also check within time windows
    const windowGroups = groupByTimeWindow(failEvents);

    for (const group of windowGroups) {
      if (group.length >= BRUTE_FORCE_THRESHOLD) {
        const riskScore = calculateBruteForceRisk(group.length);
        const firstEvent = group[0];
        const lastEvent = group[group.length - 1];

        threats.push({
          id: uuidv4(),
          scan_id: firstEvent.scan_id,
          event_id: firstEvent.id,
          threat_type: 'Brute Force Attack',
          severity: getSeverity(riskScore),
          risk_score: riskScore,
          description: `Brute force detected: ${group.length} failed login attempts from IP ${ip} in a short period`,
          matched_pattern: `${group.length} failures from same IP`,
          source_ip: ip,
          timestamp: firstEvent.timestamp,
          raw_evidence: `${group.length} attempts from ${ip}. First: ${firstEvent.raw_line.substring(0, 200)}`,
        });
      }
    }

    // Also catch large total volumes even without time windowing
    if (failEvents.length >= 20 && !windowGroups.some(g => g.length >= BRUTE_FORCE_THRESHOLD)) {
      const riskScore = calculateBruteForceRisk(failEvents.length);
      threats.push({
        id: uuidv4(),
        scan_id: failEvents[0].scan_id,
        event_id: failEvents[0].id,
        threat_type: 'Brute Force Attack',
        severity: getSeverity(riskScore),
        risk_score: riskScore,
        description: `Sustained brute force: ${failEvents.length} total failed attempts from IP ${ip}`,
        matched_pattern: `${failEvents.length} total failures from same IP`,
        source_ip: ip,
        timestamp: failEvents[0].timestamp,
        raw_evidence: `Total ${failEvents.length} failures from ${ip}`,
      });
    }
  }

  return threats;
}

function groupByTimeWindow(events) {
  if (events.length === 0) return [];

  // If no timestamps, return all as one group
  const hasTimestamps = events.some(e => e.timestamp);
  if (!hasTimestamps) {
    return events.length >= BRUTE_FORCE_THRESHOLD ? [events] : [];
  }

  const groups = [];
  let currentGroup = [];

  const sorted = [...events].sort((a, b) => {
    const ta = parseTimestamp(a.timestamp);
    const tb = parseTimestamp(b.timestamp);
    return (ta || 0) - (tb || 0);
  });

  for (const event of sorted) {
    if (currentGroup.length === 0) {
      currentGroup.push(event);
      continue;
    }

    const firstTs = parseTimestamp(currentGroup[0].timestamp);
    const thisTs = parseTimestamp(event.timestamp);

    if (firstTs && thisTs && (thisTs - firstTs) <= TIME_WINDOW_MS) {
      currentGroup.push(event);
    } else {
      if (currentGroup.length >= BRUTE_FORCE_THRESHOLD) {
        groups.push(currentGroup);
      }
      currentGroup = [event];
    }
  }

  if (currentGroup.length >= BRUTE_FORCE_THRESHOLD) {
    groups.push(currentGroup);
  }

  return groups;
}

function parseTimestamp(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function calculateBruteForceRisk(count) {
  if (count >= 100) return 95;
  if (count >= 50) return 88;
  if (count >= 20) return 82;
  if (count >= 10) return 75;
  return 65;
}

function getSeverity(score) {
  if (score >= 90) return 'CRITICAL';
  if (score >= 70) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

module.exports = { detectBruteForce };
