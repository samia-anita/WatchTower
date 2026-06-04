const express = require('express');
const router = express.Router();

const { getDb, query } = require('../database/init');
const { generateIncidentReport } = require('../services/reportGenerator');

// GET /api/report/:scanId
router.get('/:scanId', async (req, res) => {
  const { scanId } = req.params;

  try {
    await getDb();

    // Load scan
    const scans = query('SELECT * FROM scans WHERE id = ?', [scanId]);
    if (scans.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    const scan = scans[0];

    // Load threats
    const threats = query('SELECT * FROM threats WHERE scan_id = ? ORDER BY risk_score DESC', [scanId]);

    // Load AI analysis
    const analyses = query('SELECT * FROM ai_analyses WHERE scan_id = ?', [scanId]);
    const analysis = analyses.length > 0 ? analyses[0] : null;

    // Generate PDF
    const pdfBuffer = await generateIncidentReport(scan, threats, analysis);

    const filename = `security-report-${scan.filename.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);

  } catch (err) {
    console.error('Report generation error:', err);
    return res.status(500).json({ error: err.message || 'Report generation failed' });
  }
});

// GET /api/report/scan/:scanId/data  — return raw JSON (useful for re-renders)
router.get('/scan/:scanId/data', async (req, res) => {
  const { scanId } = req.params;

  try {
    await getDb();

    const scans = query('SELECT * FROM scans WHERE id = ?', [scanId]);
    if (scans.length === 0) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    const threats = query('SELECT * FROM threats WHERE scan_id = ? ORDER BY risk_score DESC', [scanId]);
    const analyses = query('SELECT * FROM ai_analyses WHERE scan_id = ?', [scanId]);

    res.json({
      scan: scans[0],
      threats,
      analysis: analyses[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/report/scans/list  — list recent scans
router.get('/scans/list', async (req, res) => {
  try {
    await getDb();
    const scans = query('SELECT * FROM scans ORDER BY created_at DESC LIMIT 20');
    res.json({ scans });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
