import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  timeout: 120000, // 2 min for AI calls
});

export async function uploadLogFile(file, onProgress) {
  const formData = new FormData();
  formData.append('logfile', file);

  const response = await API.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded * 100) / evt.total));
      }
    },
  });
  return response.data;
}

export async function runAiAnalysis(scanId, threats, scanMeta) {
  const response = await API.post('/analyze-ai', { scanId, threats, scanMeta });
  return response.data;
}

export async function downloadReport(scanId) {
  const response = await API.get(`/report/${scanId}`, {
    responseType: 'blob',
  });

  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `security-report-${scanId.slice(0, 8)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function checkOllamaHealth() {
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
