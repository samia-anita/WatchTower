const axios = require('axios');

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const PREFERRED_MODELS = ['qwen2.5:7b', 'qwen2.5', 'mistral', 'llama3.2', 'llama3', 'qwen', 'phi3'];

async function getAvailableModel() {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });
    const models = response.data.models || [];
    const names = models.map(m => m.name);

    for (const preferred of PREFERRED_MODELS) {
      const found = names.find(n => n.toLowerCase().includes(preferred.toLowerCase()));
      if (found) return found;
    }

    // Return first available model
    if (names.length > 0) return names[0];
    return null;
  } catch (err) {
    return null;
  }
}

async function checkOllamaHealth() {
  try {
    await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });
    const model = await getAvailableModel();
    return { available: true, model };
  } catch {
    return { available: false, model: null };
  }
}

async function generateSecurityAnalysis(threats, scanMeta) {
  const model = await getAvailableModel();
  if (!model) {
    return getFallbackAnalysis(threats, scanMeta);
  }

  const threatSummary = buildThreatSummary(threats, scanMeta);

  const prompt = `You are a senior cybersecurity analyst. Analyze the following security scan results and provide a structured JSON response.

SCAN RESULTS:
${threatSummary}

Respond ONLY with a valid JSON object (no markdown, no code blocks, no extra text) with exactly these fields:
{
  "explanation": "Technical explanation of what happened in 2-3 sentences",
  "risk_assessment": "Why these threats are dangerous and potential impact in 2-3 sentences",
  "recommendation": "Top 3-5 specific remediation steps as a single string with numbered list",
  "executive_summary": "Business-friendly summary in 2-3 sentences suitable for a non-technical manager"
}`;

  try {
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          num_predict: 1024,
        }
      },
      { timeout: 120000 }
    );

    const rawText = response.data.response || '';

    // Try to extract JSON from response
    const parsed = extractJSON(rawText);
    if (parsed) {
      return { ...parsed, model_used: model };
    }

    // If JSON extraction failed, try to build from text
    return buildAnalysisFromText(rawText, model);
  } catch (err) {
    console.error('Ollama error:', err.message);
    return getFallbackAnalysis(threats, scanMeta);
  }
}

function buildThreatSummary(threats, scanMeta) {
  const byType = {};
  for (const t of threats) {
    if (!byType[t.threat_type]) byType[t.threat_type] = [];
    byType[t.threat_type].push(t);
  }

  const lines = [
    `Total threats detected: ${threats.length}`,
    `Overall risk score: ${scanMeta.overall_risk_score}/100`,
    `File analyzed: ${scanMeta.filename}`,
    `Total log events: ${scanMeta.total_events}`,
    '',
    'THREATS BY TYPE:',
  ];

  for (const [type, typeThreats] of Object.entries(byType)) {
    const maxScore = Math.max(...typeThreats.map(t => t.risk_score));
    const uniqueIPs = [...new Set(typeThreats.map(t => t.source_ip).filter(Boolean))];
    lines.push(`- ${type}: ${typeThreats.length} incidents, max risk score ${maxScore}`);
    if (uniqueIPs.length > 0) {
      lines.push(`  Source IPs: ${uniqueIPs.slice(0, 5).join(', ')}`);
    }
    if (typeThreats[0]?.description) {
      lines.push(`  Example: ${typeThreats[0].description}`);
    }
  }

  return lines.join('\n');
}

function extractJSON(text) {
  // Try direct parse first
  try {
    return JSON.parse(text.trim());
  } catch {}

  // Try to find JSON object in text
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }

  return null;
}

function buildAnalysisFromText(text, model) {
  // Fallback: use the raw text as explanation
  return {
    explanation: text.substring(0, 500) || "Security threats were detected in the log file.",
    risk_assessment: "The detected threats pose significant security risks to the organization.",
    recommendation: "1. Review and block suspicious IP addresses\n2. Implement input validation\n3. Enable WAF rules\n4. Review authentication policies\n5. Patch vulnerable components",
    executive_summary: "Security scan detected multiple threat indicators. Immediate review is recommended.",
    model_used: model,
  };
}

function getFallbackAnalysis(threats, scanMeta) {
  const byType = {};
  for (const t of threats) {
    byType[t.threat_type] = (byType[t.threat_type] || 0) + 1;
  }

  const typeList = Object.entries(byType).map(([k, v]) => `${v} ${k}`).join(', ');
  const uniqueIPs = [...new Set(threats.map(t => t.source_ip).filter(Boolean))];
  const criticalCount = threats.filter(t => t.severity === 'CRITICAL').length;
  const highCount = threats.filter(t => t.severity === 'HIGH').length;

  return {
    explanation: `Analysis of ${scanMeta.filename} revealed ${threats.length} security threats: ${typeList}. ${uniqueIPs.length} unique source IP(s) were involved in these incidents. ${criticalCount > 0 ? `${criticalCount} critical severity threats require immediate attention.` : ''}`,

    risk_assessment: `The detected threats pose ${scanMeta.overall_risk_score >= 70 ? 'HIGH' : scanMeta.overall_risk_score >= 40 ? 'MEDIUM' : 'LOW'} risk. ${criticalCount + highCount > 0 ? `${criticalCount + highCount} high/critical severity threats could lead to data breaches, unauthorized access, or system compromise.` : ''} SQL injection and path traversal attacks can lead to full database compromise. Brute force attacks indicate credential stuffing campaigns. XSS attacks can compromise end-user sessions.`,

    recommendation: "1. Block source IPs with multiple threat indicators at the firewall level\n2. Implement Web Application Firewall (WAF) with OWASP Core Rule Set\n3. Enable account lockout policies after 5 failed login attempts\n4. Sanitize and validate all user inputs server-side\n5. Review and apply least-privilege access controls\n6. Enable detailed audit logging and SIEM alerting\n7. Conduct emergency security review of affected endpoints",

    executive_summary: `Our security scan of ${scanMeta.filename} detected ${threats.length} security incidents with an overall risk score of ${scanMeta.overall_risk_score}/100. ${criticalCount > 0 ? `${criticalCount} critical threats were found that require immediate action.` : ''} Attackers appear to be probing for vulnerabilities including database attacks and unauthorized access attempts. We recommend immediate IP blocking of known bad actors and a security audit of affected systems. No evidence of successful breach was found in the log file alone, but investigation is strongly advised.`,

    model_used: 'rule-based-fallback',
  };
}

module.exports = { generateSecurityAnalysis, checkOllamaHealth };
