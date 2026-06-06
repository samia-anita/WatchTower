'use strict';
const axios = require('axios');

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

// Ordered by preference — best 70B models prioritized first.
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'deepseek-r1-distill-llama-70b',
  'mixtral-8x7b-32768'
];

// Cache the working model for 10 minutes so we don't probe on every request
let _modelCache = null;
let _modelCacheTime = 0;
const MODEL_CACHE_TTL = 10 * 60 * 1000;

async function checkGroqHealth() {
  if (!GROQ_API_KEY) {
    return { available: false, model: null, reason: 'GROQ_API_KEY not set' };
  }
  try {
    const model = await pickBestModel();
    return { available: !!model, model };
  } catch (err) {
    return { available: false, model: null, reason: err.message };
  }
}

// Probe each model in preference order with a minimal real request.
// Returns the first model that responds successfully.
async function pickBestModel() {
  const now = Date.now();
  if (_modelCache && (now - _modelCacheTime) < MODEL_CACHE_TTL) {
    return _modelCache;
  }

  // First get the list of models Groq says are available (fast filter)
  let availableIds = [];
  try {
    const res = await axios.get(`${GROQ_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      timeout: 8000,
    });
    availableIds = (res.data?.data ?? []).map((m) => m.id.toLowerCase());
  } catch (err) {
    console.log(`[groq] Could not fetch remote models list, falling back to full checklist. Error: ${err.message}`);
  }

  // Filter our preference list to models Groq says exist (Robust string matching)
  const candidates = availableIds.length > 0
    ? GROQ_MODELS.filter(preferred => {
        const prefLower = preferred.toLowerCase();
        return availableIds.some(id => id.includes(prefLower) || prefLower.includes(id));
      })
    : GROQ_MODELS;

  // If no matches from fuzzy filter, fall back to full list
  const toTry = candidates.length > 0 ? candidates : GROQ_MODELS;

  // Probe each candidate with a minimal 1-token request to confirm it actually works
  for (const model of toTry) {
    try {
      await axios.post(
        `${GROQ_BASE_URL}/chat/completions`,
        {
          model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 1,
        },
        {
          headers: {
            Authorization: `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
      
      // This model works — cache and return it
      _modelCache = model;
      _modelCacheTime = Date.now();
      console.log(`[groq] Using model: ${model}`);
      return model;
    } catch (err) {
      const status = err.response?.status;
      const errMsg = err.response?.data?.error?.message || '';
      
      // 400 = bad request but model exists and endpoint understands payload (still usable)
      if (status === 400) {
        _modelCache = model;
        _modelCacheTime = Date.now();
        console.log(`[groq] Using model (via 400 fallback verification): ${model}`);
        return model;
      }
      console.log(`[groq] Model ${model} unavailable (${status || err.message}${errMsg ? ': ' + errMsg.substring(0, 80) : ''}), trying next...`);
    }
  }

  return null;
}

// ─── Groq single-call helper ───────────────────────────────────────────────
async function groqCall(model, systemMsg, userMsg, maxTokens = 600) {
  const res = await axios.post(
    `${GROQ_BASE_URL}/chat/completions`,
    {
      model,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user',   content: userMsg },
      ],
      temperature: 0.3,
      max_tokens: maxTokens,
    },
    {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 45000,
    }
  );
  return res.data?.choices?.[0]?.message?.content?.trim() ?? '';
}

// ─── Build the evidence block the model will reason over ──────────────────
function buildEvidenceBlock(threats, scanMeta) {
  const byType = {};
  const bySev = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const byIp = {};
  const byEndpoint = {};

  threats.forEach((t) => {
    byType[t.threat_type] = (byType[t.threat_type] || 0) + 1;

    if (bySev[t.severity] !== undefined) {
      bySev[t.severity]++;
    }

    if (t.source_ip) {
      byIp[t.source_ip] = (byIp[t.source_ip] || 0) + 1;
    }

    const ep = t.target_endpoint || t.path;
    if (ep) {
      byEndpoint[ep] = (byEndpoint[ep] || 0) + 1;
    }
  });

  const threatLog = threats
    .slice(0, 50)
    .map((t, i) => {
      return `
${i + 1}.
Threat: ${t.threat_type}
Severity: ${t.severity}
Risk Score: ${t.risk_score || 0}
Source IP: ${t.source_ip || 'unknown'}
Endpoint: ${t.target_endpoint || t.path || 'unknown'}
Evidence: ${
        t.raw_evidence ||
        t.matched_pattern ||
        t.description ||
        'none'
      }
Timestamp: ${t.timestamp || 'unknown'}
`;
    })
    .join('\n');

  return `
FILE: ${scanMeta.filename}
TOTAL EVENTS: ${scanMeta.total_events}
TOTAL THREATS: ${threats.length}
RISK SCORE: ${scanMeta.overall_risk_score}/100

THREAT TYPES:
${JSON.stringify(byType, null, 2)}

SEVERITY BREAKDOWN:
${JSON.stringify(bySev, null, 2)}

TOP SOURCE IPS:
${JSON.stringify(byIp, null, 2)}

TOP ENDPOINTS:
${JSON.stringify(byEndpoint, null, 2)}

FULL THREAT DATA:
${threatLog}
`;
}

async function generateSecurityAnalysis(model, evidence) {
  const system = `
You are a senior cybersecurity incident responder.

Rules:

- Be extremely specific.
- Reference exact attack types.
- Reference exact IPs.
- Reference exact endpoints.
- Explain attacker behavior.
- Explain likely attacker objectives.
- Explain business impact.
- Provide concrete remediation.

Return ONLY valid JSON.

{
  "executive_summary":"",
  "explanation":"",
  "risk_assessment":"",
  "recommendation":""
}
`;

  const response = await groqCall(
    model,
    system,
    evidence,
    1800
  );

  const match = response.match(/\{[\s\S]*\}/);

  if (!match) {
    throw new Error('Model did not return JSON');
  }

  return JSON.parse(match[0]);
}

module.exports = {
  checkGroqHealth,
  pickBestModel,
  groqCall,
  buildEvidenceBlock,
  generateSecurityAnalysis
};
