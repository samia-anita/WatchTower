const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

const { getDb, query, run } = require('../database/init');

const {
  generateSecurityAnalysis,
  buildEvidenceBlock,
  pickBestModel,
  checkGroqHealth
} = require('../services/groqService');

// POST /api/analyze-ai
router.post('/', async (req, res) => {
  const { scanId, threats, scanMeta } = req.body;

  if (!scanId) {
    return res.status(400).json({
      error: 'scanId is required'
    });
  }

  try {
    await getDb();

    const existing = query(
      'SELECT * FROM ai_analyses WHERE scan_id = ?',
      [scanId]
    );

    if (existing.length > 0) {
      const a = existing[0];

      const weakModels = [
        'llama-3.1-8b-instant',
        'llama3-8b-8192',
        'gemma2-9b-it',
        'rule-based-fallback'
      ];

      const isWeak = weakModels.some((m) =>
        (a.model_used || '').includes(m)
      );

      if (!isWeak) {
        return res.json({
          success: true,
          cached: true,
          explanation: a.explanation,
          risk_assessment: a.risk_assessment,
          recommendation: a.recommendation,
          executive_summary: a.executive_summary,
          model_used: a.model_used
        });
      }

      run(
        'DELETE FROM ai_analyses WHERE scan_id = ?',
        [scanId]
      );
    }

    let meta = scanMeta;

    if (!meta) {
      const scans = query(
        'SELECT * FROM scans WHERE id = ?',
        [scanId]
      );

      if (scans.length > 0) {
        meta = scans[0];
      } else {
        meta = {
          filename: 'unknown',
          overall_risk_score: 0,
          total_events: 0
        };
      }
    }

    let threatData = threats;

    if (!threatData || threatData.length === 0) {
      threatData = query(
        'SELECT * FROM threats WHERE scan_id = ?',
        [scanId]
      );
    }

    // -----------------------------
    // NEW SINGLE-PASS AI ANALYSIS
    // -----------------------------

    const model = await pickBestModel();

    console.log('ACTIVE MODEL:', model);

    const evidence = buildEvidenceBlock(
      threatData,
      meta
    );

    const analysis = await generateSecurityAnalysis(
      model,
      evidence
    );

    analysis.model_used = model;

    // -----------------------------

    const analysisId = uuidv4();

    run(
      `INSERT INTO ai_analyses
       (
         id,
         scan_id,
         explanation,
         risk_assessment,
         recommendation,
         executive_summary,
         model_used
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        analysisId,
        scanId,
        analysis.explanation,
        analysis.risk_assessment,
        analysis.recommendation,
        analysis.executive_summary,
        analysis.model_used
      ]
    );

    return res.json({
      success: true,
      cached: false,
      explanation: analysis.explanation,
      risk_assessment: analysis.risk_assessment,
      recommendation: analysis.recommendation,
      executive_summary: analysis.executive_summary,
      model_used: analysis.model_used
    });
  } catch (err) {
    console.error('AI analysis error:', err);

    return res.status(500).json({
      error: err.message || 'AI analysis failed'
    });
  }
});

router.get('/health', async (req, res) => {
  const health = await checkGroqHealth();
  res.json(health);
});

module.exports = router;