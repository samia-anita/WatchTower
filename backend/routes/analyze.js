const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const { getDb, query, run } = require('../database/init');
const { generateSecurityAnalysis, checkOllamaHealth } = require('../services/ollamaService');

// POST /api/analyze-ai
router.post('/', async (req, res) => {
  const { scanId, threats, scanMeta } = req.body;

  if (!scanId) {
    return res.status(400).json({ error: 'scanId is required' });
  }

  try {
    await getDb();

    // Check if analysis already exists
    const existing = query('SELECT * FROM ai_analyses WHERE scan_id = ?', [scanId]);
    if (existing.length > 0) {
      const a = existing[0];
      return res.json({
        success: true,
        cached: true,
        explanation: a.explanation,
        risk_assessment: a.risk_assessment,
        recommendation: a.recommendation,
        executive_summary: a.executive_summary,
        model_used: a.model_used,
      });
    }

    // Get scan record if not provided
    let meta = scanMeta;
    if (!meta) {
      const scans = query('SELECT * FROM scans WHERE id = ?', [scanId]);
      if (scans.length > 0) {
        meta = scans[0];
      } else {
        meta = { filename: 'unknown', overall_risk_score: 0, total_events: 0 };
      }
    }

    // Get threats if not provided
    let threatData = threats;
    if (!threatData || threatData.length === 0) {
      threatData = query('SELECT * FROM threats WHERE scan_id = ?', [scanId]);
    }

    // Generate AI analysis (with fallback built-in)
    const analysis = await generateSecurityAnalysis(threatData, meta);

    // Save to DB
    const analysisId = uuidv4();
    run(
      `INSERT INTO ai_analyses (id, scan_id, explanation, risk_assessment, recommendation, executive_summary, model_used)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [analysisId, scanId,
       analysis.explanation, analysis.risk_assessment,
       analysis.recommendation, analysis.executive_summary,
       analysis.model_used]
    );

    return res.json({
      success: true,
      cached: false,
      explanation: analysis.explanation,
      risk_assessment: analysis.risk_assessment,
      recommendation: analysis.recommendation,
      executive_summary: analysis.executive_summary,
      model_used: analysis.model_used,
    });

  } catch (err) {
    console.error('AI analysis error:', err);
    return res.status(500).json({ error: err.message || 'AI analysis failed' });
  }
});

// GET /api/analyze-ai/health
router.get('/health', async (req, res) => {
  const health = await checkOllamaHealth();
  res.json(health);
});

module.exports = router;
