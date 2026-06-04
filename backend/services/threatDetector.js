const { detectSQLInjection } = require('../detectors/sqlInjection');
const { detectXSS } = require('../detectors/xss');
const { detectBruteForce } = require('../detectors/bruteForce');
const { detectPathTraversal } = require('../detectors/pathTraversal');

/**
 * Run all detectors against parsed events.
 * Returns a flat list of threat objects.
 */
function runDetectors(events) {
  const results = {
    threats: [],
    summary: {
      total: 0,
      byType: {},
      bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    }
  };

  const allThreats = [
    ...detectSQLInjection(events),
    ...detectXSS(events),
    ...detectBruteForce(events),
    ...detectPathTraversal(events),
  ];

  results.threats = allThreats;
  results.summary.total = allThreats.length;

  for (const threat of allThreats) {
    // Count by type
    if (!results.summary.byType[threat.threat_type]) {
      results.summary.byType[threat.threat_type] = 0;
    }
    results.summary.byType[threat.threat_type]++;

    // Count by severity
    if (results.summary.bySeverity[threat.severity] !== undefined) {
      results.summary.bySeverity[threat.severity]++;
    }
  }

  return results;
}

/**
 * Calculate an overall risk score for the scan.
 * Takes into account severity distribution and total threat count.
 */
function calculateOverallRiskScore(threats) {
  if (!threats || threats.length === 0) return 0;

  const weights = { CRITICAL: 1.0, HIGH: 0.75, MEDIUM: 0.5, LOW: 0.25 };

  // Weighted average
  const weightedSum = threats.reduce((sum, t) => {
    const severityMod = weights[t.severity] || 0.5;
    return sum + (t.risk_score * severityMod);
  }, 0);

  const maxPossible = threats.length * 100;
  const rawScore = (weightedSum / maxPossible) * 100;

  // Boost score for high threat counts
  const countBoost = Math.min(threats.length * 2, 20);

  return Math.min(Math.round(rawScore + countBoost), 100);
}

module.exports = { runDetectors, calculateOverallRiskScore };
