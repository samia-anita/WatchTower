'use strict';
const axios = require('axios');

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

// Ordered by preference — best 70B models prioritized first.
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama3-70b-8192',
  'mixtral-8x7b-32768',
  'llama3-8b-8192',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
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
  const bySev  = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const byIp   = {};
  const byEndpt = {};

  for (const t of threats) {
    byType[t.threat_type] = (byType[t.threat_type] || 0) + 1;
    if (bySev[t.severity] !== undefined) bySev[t.severity]++;
    if (t.source_ip && t.source_ip !== 'unknown') {
      byIp[t.source_ip] = (byIp[t.source_ip] || 0) + 1;
    }
    if (t.target_endpoint || t.path) {
      const ep = t.target_endpoint || t.path;
      byEndpt[ep] = (byEndpt[ep] || 0) + 1;
    }
  }

  const topIps = Object.entries(byIp).sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([ip,n]) => `${ip} (${n} events)`).join(', ');

  const topEndpts = Object.entries(byEndpt).sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([ep,n]) => `${ep} (${n} hits)`).join(', ');

  const typeBreakdown = Object.entries(byType).sort((a,b)=>b[1]-a[1])
    .map(([t,n]) => `${n}x ${t}`).join(', ');

  const sevBreakdown = Object.entries(bySev).filter(([,v])=>v>0)
    .map(([s,n]) => `${n} ${s}`).join(', ');

  // Up to 12 threats with their actual matched pattern / raw evidence
  const threatLines = threats.slice(0, 12).map((t, i) => {
    const evidence = t.raw_evidence || t.matched_pattern || t.description || '';
    const ep = t.target_endpoint || t.path || '';
    return `  ${i+1}. [${t.severity}] ${t.threat_type} | IP: ${t.source_ip || 'unknown'} | endpoint: ${ep || 'unknown'} | matched: ${evidence.substring(0, 120)}`;
  }).join('\n');

  return {
    block: `FILE: ${scanMeta.filename} | EVENTS: ${scanMeta.total_events} | THREATS: ${threats.length} | RISK: ${scanMeta.overall_risk_score}/100
BREAKDOWN: ${typeBreakdown}
SEVERITY: ${sevBreakdown}
TOP IPs: ${topIps || 'none recorded'}
TOP ENDPOINTS: ${topEndpts || 'none recorded'}
THREAT LOG:
${threatLines || '  (no detail available)'}`,
    byType, bySev, byIp, byEndpt, topIps, topEndpts, typeBreakdown, sevBreakdown,
    score: scanMeta.overall_risk_score,
    filename: scanMeta.filename,
    totalThreats: threats.length,
    totalEvents: scanMeta.total_events,
  };
}

// ─── Four focused single-field prompts ────────────────────────────────────
async function getExplanation(model, ev) {
  const system = `You are a cybersecurity analyst. Write a technical threat explanation for a security engineer. 
Be specific — name every attack type, technique, IP address, and endpoint found in the data. 
3–4 paragraphs. Do not use filler phrases like "further analysis is required" or "it is crucial to review". Every sentence must contain a specific fact from the data.`;

  const user = `Here is the scan data:\n${ev.block}\n\nWrite the technical explanation now. Cover: what attack types were found and how many of each, what techniques each attack used (e.g. UNION SELECT, OR 1=1, <script> tags, ../ traversal), which IPs and endpoints were involved, and what the attacker's goal appears to be based on the combination of techniques.`;

  return groqCall(model, system, user, 700);
}

async function getRiskAssessment(model, ev) {
  const system = `You are a cybersecurity analyst. Write a risk assessment paragraph. 
Be specific — justify the risk score using the exact severity counts and attack types. Name the highest-priority threat and explain what would happen to the business if it succeeded. Do not be vague.`;

  const user = `Scan data:\n${ev.block}\n\nWrite the risk assessment. Cover: justify the ${ev.score}/100 risk score using the severity breakdown, name which attack type is most dangerous and why, describe the concrete business impact if the top threat succeeded (e.g. full database access, account takeover), and state whether this looks opportunistic or targeted.`;

  return groqCall(model, system, user, 400);
}

async function getRecommendations(model, ev) {
  const system = `You are a cybersecurity incident responder. Provide remediation recommendations based on the findings.`;
  const user = `Scan data:\n${ev.block}\n\nProvide actionable containment and eradication steps based on the findings.`;
  return groqCall(model, system, user, 500);
}

module.exports = {
  checkGroqHealth,
  pickBestModel,
  groqCall,
  buildEvidenceBlock,
  getExplanation,
  getRiskAssessment,
  getRecommendations
};
