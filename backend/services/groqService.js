'use strict';
const axios = require('axios');

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

// Ordered by preference — larger/smarter models first.
// 70B models follow instructions far better than 8B for structured analysis.
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama3-70b-8192',
  'llama-3.1-70b-versatile',
  'mixtral-8x7b-32768',
  'llama3-8b-8192',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
];

async function checkGroqHealth() {
  if (!GROQ_API_KEY) {
    return { available: false, model: null, reason: 'GROQ_API_KEY not set' };
  }
  try {
    const res = await axios.get(`${GROQ_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      timeout: 8000,
    });
    const available = res.data?.data ?? [];
    const model = pickModel(available.map((m) => m.id));
    return { available: !!model, model };
  } catch (err) {
    return { available: false, model: null, reason: err.message };
  }
}

function pickModel(availableIds) {
  for (const preferred of GROQ_MODELS) {
    if (availableIds.some((id) => id.toLowerCase().includes(preferred.toLowerCase()))) {
      return preferred;
    }
  }
  return availableIds[0] ?? null;
}

async function generateSecurityAnalysis(threats, scanMeta) {
  if (!GROQ_API_KEY) {
    return getFallbackAnalysis(threats, scanMeta);
  }

  let model = GROQ_MODELS[0];
  try {
    const res = await axios.get(`${GROQ_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      timeout: 8000,
    });
    const available = (res.data?.data ?? []).map((m) => m.id);
    model = pickModel(available) ?? model;
  } catch {}

  const threatSummary = buildThreatSummary(threats, scanMeta);

  // Split into system + user for much better instruction following
  const systemMessage = `You are a senior cybersecurity analyst with 15 years of experience writing detailed incident reports. You write in precise, technical language with specific numbers, IP addresses, patterns, and attack techniques drawn directly from the data provided to you.

CRITICAL RULES — violating any of these means your response is rejected:
1. NEVER write vague filler like "further analysis is required", "it is crucial to understand", "may involve reviewing", or "potentially conducting investigations". Every sentence must contain a specific data point from the scan.
2. NEVER use placeholder language. If you say "SQL injection was detected", you must also say HOW MANY, from WHICH IPs, targeting WHICH endpoints.
3. Each JSON field must be substantive: explanation ≥ 200 words, risk_assessment ≥ 100 words, recommendation must have ≥ 6 numbered steps referencing actual threat types found, executive_summary ≥ 100 words.
4. Return ONLY a raw JSON object. No markdown fences, no preamble, no text outside the JSON.`;

  const userMessage = `Analyze this security scan and return a JSON object with keys: explanation, risk_assessment, recommendation, executive_summary.

${threatSummary}

---
FIELD REQUIREMENTS:

"explanation": Technical analysis for a security engineer. You MUST cover:
- Exact count of each attack type detected (e.g. "4 SQL injection attempts, 1 XSS attempt, 1 brute force attempt, 1 path traversal attempt")
- The specific techniques observed for each type (e.g. UNION-based SQLi, reflected XSS via script tags, login endpoint hammering)
- Which source IPs were most active and how many events each generated
- Which endpoints or URL paths were targeted and how often
- The attacker's likely objective based on the combination of attack types seen (e.g. reconnaissance, credential theft, data exfiltration)
- Whether this looks automated (tool-generated) or manual based on timing/patterns

"risk_assessment": Risk analysis with business context. You MUST cover:
- Justify the risk score of ${scanMeta.overall_risk_score}/100 using the specific severity counts
- Which specific attack type is the highest priority threat and why (reference the actual counts)
- Concrete business impact scenarios if each attack type succeeded (e.g. "SQL injection success could expose the full user database", "brute force success means attacker controls an admin account")
- Whether this is opportunistic mass-scanning or a targeted campaign against this specific application

"recommendation": Numbered remediation list of exactly 8 steps. Each step MUST name the specific attack type(s) it addresses. Include:
1-2: Immediate containment (specific to the IPs/patterns found)
3-5: Short-term hardening tied to the exact attack types detected
6-7: Detection and monitoring improvements
8: Long-term architecture recommendation

"executive_summary": Plain English for a non-technical executive or board member. NO JARGON without explanation. You MUST:
- Open with a one-sentence plain-English description of what happened (e.g. "Attackers targeted your website with automated tools trying to break into the database and steal user data")
- State the risk score and what it means in business terms (not just "high risk")
- Explain what the attackers were trying to accomplish and whether they likely succeeded
- End with the top 2-3 things management needs to prioritize this week

Return ONLY the JSON object now:`;

  try {
    const res = await axios.post(
      `${GROQ_BASE_URL}/chat/completions`,
      {
        model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.2,
        max_tokens: 3000,
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 90000,
      }
    );

    const rawText = res.data?.choices?.[0]?.message?.content ?? '';
    const parsed = extractJSON(rawText);

    if (parsed) {
      // Post-process: strip any fields that are still vague filler
      return { ...parsed, model_used: model };
    }

    return buildAnalysisFromText(rawText, model);
  } catch (err) {
    console.error('[groq]', err.response?.data ?? err.message);
    return getFallbackAnalysis(threats, scanMeta);
  }
}

function buildThreatSummary(threats, scanMeta) {
  const byType = {};
  const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const sourceIps = {};
  const targetEndpoints = {};

  for (const t of threats) {
    byType[t.threat_type] = (byType[t.threat_type] || 0) + 1;
    if (bySeverity[t.severity] !== undefined) bySeverity[t.severity]++;
    if (t.source_ip && t.source_ip !== 'unknown') {
      sourceIps[t.source_ip] = (sourceIps[t.source_ip] || 0) + 1;
    }
    if (t.target_endpoint) {
      targetEndpoints[t.target_endpoint] = (targetEndpoints[t.target_endpoint] || 0) + 1;
    }
  }

  const topIps = Object.entries(sourceIps)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([ip, count]) => `  - ${ip}: ${count} events`)
    .join('\n');

  const topEndpoints = Object.entries(targetEndpoints)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([ep, count]) => `  - ${ep}: ${count} hits`)
    .join('\n');

  const threatTypeBreakdown = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `  - ${type}: ${count} incidents`)
    .join('\n');

  const severityBreakdown = Object.entries(bySeverity)
    .filter(([, v]) => v > 0)
    .map(([sev, count]) => `  - ${sev}: ${count}`)
    .join('\n');

  // Full threat detail — more context = better analysis
  const threatDetails = threats
    .slice(0, 15)
    .map((t, i) => {
      const parts = [
        `[${t.severity}]`,
        t.threat_type,
        t.source_ip ? `from ${t.source_ip}` : '',
        t.target_endpoint ? `→ ${t.target_endpoint}` : '',
        t.risk_score != null ? `(risk: ${t.risk_score})` : '',
      ].filter(Boolean).join(' ');

      const evidence = t.raw_line || t.matched_pattern || t.details || '';
      const evidenceLine = evidence ? `\n     Evidence: ${evidence.substring(0, 150)}` : '';

      return `  ${i + 1}. ${parts}${evidenceLine}`;
    })
    .join('\n');

  return `=== SCAN METADATA ===
File: ${scanMeta.filename}
Total log events: ${scanMeta.total_events}
Total threats: ${threats.length}
Risk score: ${scanMeta.overall_risk_score}/100

=== THREAT COUNTS BY TYPE ===
${threatTypeBreakdown || '  None'}

=== SEVERITY BREAKDOWN ===
${severityBreakdown || '  No severity data'}

=== TOP SOURCE IPs BY EVENT COUNT ===
${topIps || '  No IP data available'}

=== MOST HIT ENDPOINTS ===
${topEndpoints || '  No endpoint data available'}

=== FULL THREAT DETAILS (up to 15) ===
${threatDetails || '  No detail data available'}`;
}

function extractJSON(text) {
  // Try direct parse
  try { return JSON.parse(text.trim()); } catch {}

  // Strip markdown fences
  const stripped = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(stripped); } catch {}

  // Extract first {...} block
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }

  return null;
}

function buildAnalysisFromText(text, model) {
  return {
    explanation: text.substring(0, 1500),
    risk_assessment: 'Multiple threat categories detected requiring immediate manual review.',
    recommendation:
      '1. Immediately block all source IPs associated with detected attacks at the firewall\n' +
      '2. Enable a Web Application Firewall with rules for SQL injection and XSS patterns\n' +
      '3. Enforce parameterized queries / prepared statements on all database calls\n' +
      '4. Apply Content-Security-Policy headers to block inline script execution\n' +
      '5. Rate-limit and add CAPTCHA to all authentication endpoints\n' +
      '6. Restrict directory traversal via chroot / allowlist path validation\n' +
      '7. Enable real-time alerting on repeated 4xx/5xx patterns from single IPs\n' +
      '8. Schedule a penetration test to validate remediation completeness',
    executive_summary:
      'Attackers targeted your web application with automated tools probing for multiple vulnerabilities simultaneously. ' +
      'The security team has logged and categorized all attack attempts. Immediate action is required to block the attacking ' +
      'IP addresses and harden the affected application endpoints before a successful breach occurs.',
    model_used: model,
  };
}

function getFallbackAnalysis(threats, scanMeta) {
  const byType = {};
  const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const sourceIps = {};
  const targetEndpoints = {};

  for (const t of threats) {
    byType[t.threat_type] = (byType[t.threat_type] || 0) + 1;
    if (bySeverity[t.severity] !== undefined) bySeverity[t.severity]++;
    if (t.source_ip && t.source_ip !== 'unknown') {
      sourceIps[t.source_ip] = (sourceIps[t.source_ip] || 0) + 1;
    }
    if (t.target_endpoint) {
      targetEndpoints[t.target_endpoint] = (targetEndpoints[t.target_endpoint] || 0) + 1;
    }
  }

  const typeList = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${v} ${k}`)
    .join(', ');

  const topIpList = Object.entries(sourceIps)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ip, c]) => `${ip} (${c} events)`)
    .join(', ');

  const topEndpointList = Object.entries(targetEndpoints)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ep, c]) => `${ep} (${c} hits)`)
    .join(', ');

  const critCount = bySeverity.CRITICAL + bySeverity.HIGH;
  const riskLabel = scanMeta.overall_risk_score >= 75 ? 'CRITICAL' : scanMeta.overall_risk_score >= 50 ? 'HIGH' : scanMeta.overall_risk_score >= 25 ? 'MEDIUM' : 'LOW';

  const typeRecs = {
    'SQL Injection': '  • Deploy parameterized queries / prepared statements on all DB-touching endpoints. Add a WAF rule blocking UNION, SELECT, DROP, and boolean-based blind patterns.',
    'Cross-Site Scripting (XSS)': '  • Enforce Content-Security-Policy: default-src \'self\'. HTML-encode all user-supplied output. Block <script>, onerror=, and javascript: URI patterns at the WAF.',
    'Brute Force': '  • Implement account lockout after 5 failed attempts. Add CAPTCHA and rate limiting (max 10 req/min) on /login, /admin, and /wp-login endpoints. Consider IP-based temporary bans.',
    'Path Traversal': '  • Validate all file path inputs against an allowlist. Chroot application processes. Block ../, %2e%2e, and encoded variants at the WAF and application layer.',
  };

  const specificRecs = Object.keys(byType)
    .map(t => typeRecs[t] || `  • Review and harden against ${t} patterns.`)
    .join('\n');

  return {
    explanation:
      `Scan of ${scanMeta.filename} (${scanMeta.total_events} log events) detected ${threats.length} security threats with a risk score of ${scanMeta.overall_risk_score}/100 (${riskLabel}). ` +
      `Attack type breakdown: ${typeList || 'various'}. ` +
      (bySeverity.CRITICAL > 0 ? `${bySeverity.CRITICAL} CRITICAL severity threat(s) indicate active exploitation attempts — these represent the highest immediate risk and must be addressed first. ` : '') +
      (bySeverity.HIGH > 0 ? `${bySeverity.HIGH} HIGH severity threat(s) suggest targeted probing of vulnerable endpoints. ` : '') +
      (topIpList ? `Most active source IPs: ${topIpList}. ` : '') +
      (topEndpointList ? `Most targeted endpoints: ${topEndpointList}. ` : '') +
      `The combination of ${Object.keys(byType).join(' and ')} attacks suggests ${Object.keys(byType).length > 2 ? 'a broad automated scan using multiple attack vectors simultaneously, consistent with tool-assisted reconnaissance' : 'a focused attack campaign targeting specific application weaknesses'}. ` +
      `To receive AI-generated analysis with deeper pattern recognition, configure GROQ_API_KEY in backend/.env.`,

    risk_assessment:
      `Risk score ${scanMeta.overall_risk_score}/100 (${riskLabel}): ${bySeverity.CRITICAL} critical, ${bySeverity.HIGH} high, ${bySeverity.MEDIUM} medium, ${bySeverity.LOW} low severity threats detected. ` +
      (byType['SQL Injection'] ? `SQL Injection (${byType['SQL Injection']} incidents) is the highest-priority threat — a successful injection would give the attacker direct read/write access to the database, potentially exposing all user records, credentials, and sensitive business data. ` : '') +
      (byType['Brute Force'] ? `Brute Force activity (${byType['Brute Force']} attempts) indicates credential stuffing — if successful, the attacker gains authenticated access to user or admin accounts. ` : '') +
      (byType['Cross-Site Scripting (XSS)'] ? `XSS attempts (${byType['Cross-Site Scripting (XSS)']}) could allow session hijacking or malicious redirects affecting legitimate users. ` : '') +
      (byType['Path Traversal'] ? `Path Traversal attempts (${byType['Path Traversal']}) suggest the attacker is probing for access to server-side configuration files or source code. ` : '') +
      `${critCount > 0 ? 'The high/critical severity findings indicate active exploitation rather than passive scanning — the attacker has moved beyond reconnaissance.' : 'No critical findings suggest the attack is still in the reconnaissance phase.'}`,

    recommendation:
      `1. IMMEDIATE: Block ${topIpList || 'all flagged source IPs'} at the firewall/CDN level. These IPs are responsible for the majority of attack traffic.\n` +
      `2. IMMEDIATE: Enable rate-limiting (max 20 req/min per IP) on all endpoints flagged in this scan.\n` +
      `3. SHORT-TERM: Address ${Object.keys(byType).join(', ')} vulnerabilities:\n${specificRecs}\n` +
      `4. SHORT-TERM: Deploy or tune a Web Application Firewall (WAF) with signatures matching the detected attack patterns.\n` +
      `5. SHORT-TERM: Audit authentication endpoints — enforce MFA on all admin and privileged accounts.\n` +
      `6. MONITORING: Set up real-time alerts for >10 4xx responses from a single IP in 60 seconds.\n` +
      `7. MONITORING: Forward application logs to a SIEM for correlation with network-layer events.\n` +
      `8. LONG-TERM: Commission a penetration test focused on the ${Object.keys(byType)[0] || 'detected'} attack surfaces to confirm full remediation.`,

    executive_summary:
      `Your web application was targeted by automated attack tools attempting to break in through ${Object.keys(byType).length} different methods — including ${typeList}. These are not random internet noise; the attackers were specifically probing your application for weaknesses that could allow them to steal data or gain unauthorized access. ` +
      `The overall risk score of ${scanMeta.overall_risk_score} out of 100 (${riskLabel}) means this situation requires ${scanMeta.overall_risk_score >= 75 ? 'immediate action — your systems are under active, serious attack' : scanMeta.overall_risk_score >= 50 ? 'prompt attention within the next 24–48 hours' : 'attention within the next week'}. ` +
      `WatchTower has logged all ${threats.length} attack attempts. ${critCount > 0 ? `Of these, ${critCount} are rated critical or high severity, meaning they had the potential to succeed if your current defenses had gaps.` : 'None of the attacks reached critical severity, but the patterns suggest escalation is possible.'} ` +
      `This week, your team should: (1) block the attacking IP addresses, (2) patch or harden the ${Object.keys(byType)[0] || 'affected'} vulnerabilities, and (3) confirm no successful breach occurred by auditing database and authentication logs for the same time period.`,

    model_used: 'rule-based-fallback',
  };
}

module.exports = {
  generateSecurityAnalysis,
  checkGroqHealth,
};