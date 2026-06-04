const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'security.db.json');

let db = null;
let SQL = null;

async function getDb() {
  if (db) return db;

  SQL = await initSqlJs();
  
  // Load existing DB from file if present
  if (fs.existsSync(DB_PATH)) {
    try {
      const saved = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
      const buf = Buffer.from(saved.data);
      db = new SQL.Database(buf);
    } catch {
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  initSchema();
  return db;
}

function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, JSON.stringify({ data: Array.from(data) }));
  } catch (e) {
    // Non-fatal
  }
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      file_size INTEGER,
      status TEXT DEFAULT 'pending',
      overall_risk_score INTEGER DEFAULT 0,
      total_events INTEGER DEFAULT 0,
      total_threats INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      timestamp TEXT,
      raw_line TEXT,
      source_ip TEXT,
      event_type TEXT,
      method TEXT,
      path TEXT,
      status_code TEXT,
      user_agent TEXT,
      line_number INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS threats (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL,
      event_id TEXT,
      threat_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      risk_score INTEGER NOT NULL,
      description TEXT,
      matched_pattern TEXT,
      source_ip TEXT,
      timestamp TEXT,
      raw_evidence TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ai_analyses (
      id TEXT PRIMARY KEY,
      scan_id TEXT NOT NULL UNIQUE,
      explanation TEXT,
      risk_assessment TEXT,
      recommendation TEXT,
      executive_summary TEXT,
      model_used TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// Helper: run a SELECT and return rows as array of objects
function query(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run INSERT/UPDATE/DELETE
function run(sql, params = []) {
  if (!db) throw new Error('DB not initialized');
  db.run(sql, params);
  saveDb();
}

module.exports = { getDb, query, run, saveDb };
