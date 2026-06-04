const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const { getDb, query, run } = require('../database/init');
const { parseLogFile } = require('../services/logParser');
const { runDetectors, calculateOverallRiskScore } = require('../services/threatDetector');

const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${uuidv4().slice(0, 8)}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.txt', '.log'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt and .log files are accepted'));
    }
  },
});

// POST /api/upload
router.post('/', upload.single('logfile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded or invalid file type' });
  }

  const scanId = uuidv4();
  const filePath = req.file.path;

  try {
    // Ensure DB is ready
    await getDb();

    // Read file content
    const content = fs.readFileSync(filePath, 'utf8');

    // Create scan record
    run(
      `INSERT INTO scans (id, filename, file_size, status) VALUES (?, ?, ?, 'processing')`,
      [scanId, req.file.originalname, req.file.size]
    );

    // Parse log events
    const events = parseLogFile(content, scanId);

    // Batch insert events (chunked to avoid hitting limits)
    const CHUNK = 200;
    for (let i = 0; i < events.length; i += CHUNK) {
      const chunk = events.slice(i, i + CHUNK);
      for (const evt of chunk) {
        run(
          `INSERT INTO events (id, scan_id, timestamp, raw_line, source_ip, event_type, method, path, status_code, user_agent, line_number)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [evt.id, evt.scan_id, evt.timestamp, evt.raw_line?.substring(0, 1000),
           evt.source_ip, evt.event_type, evt.method, evt.path,
           evt.status_code, evt.user_agent, evt.line_number]
        );
      }
    }

    // Run threat detectors
    const detectionResult = runDetectors(events);
    const threats = detectionResult.threats;
    const overallRisk = calculateOverallRiskScore(threats);

    // Insert threats
    for (const threat of threats) {
      run(
        `INSERT INTO threats (id, scan_id, event_id, threat_type, severity, risk_score, description, matched_pattern, source_ip, timestamp, raw_evidence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [threat.id, threat.scan_id, threat.event_id, threat.threat_type,
         threat.severity, threat.risk_score, threat.description,
         threat.matched_pattern, threat.source_ip, threat.timestamp,
         threat.raw_evidence?.substring(0, 500)]
      );
    }

    // Update scan record
    run(
      `UPDATE scans SET status='completed', overall_risk_score=?, total_events=?, total_threats=?, completed_at=datetime('now') WHERE id=?`,
      [overallRisk, events.length, threats.length, scanId]
    );

    // Clean up uploaded file
    try { fs.unlinkSync(filePath); } catch {}

    // Build threat timeline (most recent 50)
    const threatTimeline = threats.slice(0, 50).map(t => ({
      id: t.id,
      threat_type: t.threat_type,
      severity: t.severity,
      risk_score: t.risk_score,
      source_ip: t.source_ip,
      timestamp: t.timestamp,
      description: t.description,
    }));

    return res.json({
      success: true,
      scanId,
      filename: req.file.originalname,
      totalEvents: events.length,
      totalThreats: threats.length,
      overallRiskScore: overallRisk,
      summary: detectionResult.summary,
      threats: threatTimeline,
      // Pass first 20 events for display
      recentEvents: events.slice(0, 20).map(e => ({
        timestamp: e.timestamp,
        source_ip: e.source_ip,
        event_type: e.event_type,
        method: e.method,
        path: e.path,
        status_code: e.status_code,
        raw_line: e.raw_line?.substring(0, 200),
      })),
    });

  } catch (err) {
    console.error('Upload pipeline error:', err);
    // Clean up
    try { fs.unlinkSync(filePath); } catch {}
    // Mark scan as failed if it was created
    try { run(`UPDATE scans SET status='failed' WHERE id=?`, [scanId]); } catch {}
    return res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

module.exports = router;
