import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  timeout: 120000,
});

export async function uploadLogFile(file, onProgress) {
  const formData = new FormData();
  formData.append('logfile', file);
  const response = await API.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded * 100) / evt.total));
    },
  });
  return response.data;
}

export async function uploadPastedText(text, onProgress) {
  const blob = new Blob([text], { type: 'text/plain' });
  const file = new File([blob], `pasted-log-${Date.now()}.txt`, { type: 'text/plain' });
  return uploadLogFile(file, onProgress);
}

export async function runAiAnalysis(scanId, threats, scanMeta) {
  const response = await API.post('/analyze-ai', { scanId, threats, scanMeta });
  return response.data;
}

export async function downloadReport(scanId) {
  const response = await API.get(`/report/${scanId}`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `security-report-${scanId.slice(0, 8)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function getScanList() {
  const response = await API.get('/report/scans/list');
  return response.data.scans || [];
}

export async function getScanData(scanId) {
  const response = await API.get(`/report/scan/${scanId}/data`);
  const { scan, threats, analysis } = response.data;

  const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const byType = {};
  for (const t of threats) {
    if (bySeverity[t.severity] !== undefined) bySeverity[t.severity]++;
    byType[t.threat_type] = (byType[t.threat_type] || 0) + 1;
  }

  return {
    scanResult: {
      scanId: scan.id,
      filename: scan.filename,
      totalEvents: scan.total_events,
      totalThreats: scan.total_threats,
      overallRiskScore: scan.overall_risk_score,
      threats,
      summary: { bySeverity, byType },
    },
    aiResult: analysis ? {
      explanation:       analysis.explanation,
      risk_assessment:   analysis.risk_assessment,
      recommendation:    analysis.recommendation,
      executive_summary: analysis.executive_summary,
      model_used:        analysis.model_used,
    } : null,
  };
}

export async function checkGroqHealth() {
  try {
    const response = await API.get('/analyze-ai/health');
    return response.data;
  } catch {
    return { available: false, model: null };
  }
}

export async function checkBackendHealth() {
  try {
    const response = await API.get('/health');
    return response.data;
  } catch {
    return null;
  }
}

const geoCache = new Map();
export async function lookupIpGeo(ip) {
  if (!ip || ip === 'unknown') return null;
  if (geoCache.has(ip)) return geoCache.get(ip);
  try {
    const response = await API.get(`/geo/${encodeURIComponent(ip)}`);
    const data = response.data;
    if (!data || data.private || !data.found) { geoCache.set(ip, null); return null; }
    const result = { country: data.country, countryCode: data.countryCode, city: data.city, flag: data.flag || '', isp: data.isp };
    geoCache.set(ip, result);
    return result;
  } catch {
    geoCache.set(ip, null);
    return null;
  }
}