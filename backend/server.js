const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { getDb } = require('./database/init');

const uploadRoute = require('./routes/upload');
const analyzeRoute = require('./routes/analyze');
const reportRoute = require('./routes/report');
const geoRoute    = require('./routes/geo');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/upload', uploadRoute);
app.use('/api/analyze-ai', analyzeRoute);
app.use('/api/report', reportRoute);
app.use('/api/geo', geoRoute);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'AI Security Analyst Dashboard',
  });
});

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
async function start() {
  try {
    // Initialize database before accepting requests
    await getDb();
    console.log('✅ Database initialized');

    app.listen(PORT, () => {
      console.log(`🚀 AI Security Dashboard backend running on http://localhost:${PORT}`);
      console.log(`   API endpoints:`);
      console.log(`   POST /api/upload         — upload & analyze log file`);
      console.log(`   POST /api/analyze-ai     — run AI analysis on threats`);
      console.log(`   GET  /api/report/:id     — download PDF report`);
      console.log(`   GET  /api/health         — health check`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();
