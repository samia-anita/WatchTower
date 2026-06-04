# WatchTower — AI Security Analyst Dashboard

A local-first security log analysis tool that parses web server logs, detects attack patterns using rule-based detectors, scores overall risk, and generates an AI-written incident report.

---

## Problem

Security teams routinely ingest thousands of web server log lines per hour. Identifying attack patterns — SQL injection, brute-force attempts, path traversal, XSS — manually is slow and error-prone. Most SIEM tools are either expensive, cloud-dependent, or require significant configuration before they produce actionable output.

---

## Solution

WatchTower accepts a raw `.log` or `.txt` file, runs it through a detection pipeline, and returns a structured risk assessment with per-threat detail and an AI-generated narrative — all within seconds, entirely on-device.

```
Upload log file → Parse events → Run detectors → Score risk → AI narrative → PDF report
```

---

## Features

- **Four threat detectors** — SQL Injection, Cross-Site Scripting (XSS), Brute Force, Path Traversal
- **Risk scoring** — per-threat scores aggregated into a 0–100 overall risk index
- **AI analysis** — Ollama-powered narrative with technical explanation, risk assessment, and remediation steps; rule-based fallback when Ollama is offline
- **Analysis caching** — AI results stored in SQLite; re-requesting the same scan returns instantly
- **PDF incident report** — structured report with executive summary, threat table, and AI findings; suitable for management review
- **No cloud dependency** — all processing is local; no data leaves the machine

---

## Tech Stack

| Layer       | Technology                                      |
|-------------|--------------------------------------------------|
| Frontend    | React 18, plain CSS (no UI library)              |
| Backend     | Node.js, Express 4                               |
| AI          | Ollama (local LLM); prefers `qwen2.5:7b`, falls back to any available model |
| Database    | SQLite via `sql.js` (file-persisted as JSON)     |
| PDF         | PDFKit                                           |
| File upload | Multer (10 MB limit, `.log` / `.txt` only)       |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  React frontend  (localhost:3000)                   │
│  UploadZone → Dashboard → ThreatFeed → AiPanel      │
└────────────────────┬────────────────────────────────┘
                     │ HTTP (proxied)
┌────────────────────▼────────────────────────────────┐
│  Express API  (localhost:3001)                       │
│                                                      │
│  POST /api/upload                                    │
│    └─ logParser → threatDetectors → SQLite           │
│                                                      │
│  POST /api/analyze-ai                               │
│    └─ ollamaService → SQLite (cached)               │
│                                                      │
│  GET  /api/report/:id                               │
│    └─ reportGenerator (PDFKit)                       │
└────────────────────┬────────────────────────────────┘
                     │ HTTP (localhost:11434)
┌────────────────────▼────────────────────────────────┐
│  Ollama  (local LLM runtime)                        │
│  Model: qwen2.5:7b or any available model           │
└─────────────────────────────────────────────────────┘
```

The backend is stateful within a session. `sql.js` persists the database to `backend/database/security.db.json` on every write, so scans and AI analyses survive server restarts.

---

## Setup

### Prerequisites

- Node.js ≥ 18
- [Ollama](https://ollama.com) installed and running (optional — rule-based fallback activates automatically if offline)

### 1. Start Ollama (optional)

```bash
ollama serve
ollama pull qwen2.5:7b   # or any model from PREFERRED_MODELS list
```

### 2. Backend

```bash
cd backend
npm install
npm start          # production
# or
npm run dev        # nodemon watch mode
```

Server starts on **http://localhost:3001**.

### 3. Frontend

```bash
cd frontend
npm install
npm start
```

App starts on **http://localhost:3000**. The React dev server proxies `/api/*` to port 3001.

---

## API Reference

| Method | Endpoint                        | Description                                              |
|--------|---------------------------------|----------------------------------------------------------|
| `POST` | `/api/upload`                   | Upload a log file. Returns scan ID, threat list, risk score. |
| `POST` | `/api/analyze-ai`               | Run AI analysis on a completed scan. Cached after first call. |
| `GET`  | `/api/analyze-ai/health`        | Check Ollama availability and active model.             |
| `GET`  | `/api/report/:scanId`           | Download PDF incident report for a scan.                |
| `GET`  | `/api/report/scan/:scanId/data` | Return raw scan + threat + analysis JSON.               |
| `GET`  | `/api/report/scans/list`        | List the 20 most recent scans.                          |
| `GET`  | `/api/health`                   | Backend liveness check.                                 |

**Upload request:**
```
POST /api/upload
Content-Type: multipart/form-data
Field name: logfile
Accepted:   .log, .txt (max 10 MB)
```

**Upload response (abbreviated):**
```json
{
  "scanId": "uuid",
  "totalEvents": 1842,
  "totalThreats": 37,
  "overallRiskScore": 84,
  "threats": [ { "threat_type": "SQL Injection", "severity": "CRITICAL", "risk_score": 95, "source_ip": "..." } ]
}
```

---

## Example Workflow

1. Start backend and frontend as described above.
2. Open **http://localhost:3000**.
3. Drop a `.log` file onto the upload zone (sample files in `sample-logs/`).
4. Click **Analyze File**. The pipeline runs in three stages:
   - **Upload & parse** — log lines are tokenised into structured events.
   - **Threat detection** — four detectors run against all events in parallel.
   - **AI analysis** — Ollama generates a narrative; falls back to rule-based output if unavailable.
5. Review the risk score, severity breakdown, and threat table in the dashboard.
6. Click **Download Incident Report** to export a PDF suitable for sharing.

**To re-analyze a previous scan**, the AI result is cached — the second call returns immediately from the database.

---

## Sample Log Files

Three pre-built log files are included in `sample-logs/`:

| File          | Description                                  |
|---------------|----------------------------------------------|
| `attack.log`  | High-volume mixed attacks, risk score ≈ 90   |
| `mixed.log`   | Moderate threats among normal traffic        |
| `normal.log`  | Clean traffic with no detected threats       |

---

## Threat Detectors

| Detector       | Severity range | Detection method                                      |
|----------------|---------------|-------------------------------------------------------|
| SQL Injection  | HIGH–CRITICAL | Pattern match on UNION SELECT, boolean injection, `--` comments |
| XSS            | MEDIUM–HIGH   | `<script>`, `onerror=`, `document.cookie`, encoded variants |
| Brute Force    | MEDIUM–HIGH   | ≥5 failed auth attempts from the same IP within the event window |
| Path Traversal | MEDIUM–HIGH   | `../`, `/etc/passwd`, `cmd.exe`, encoded traversal sequences |

---

## Known Limitations

- **In-memory SQLite** — `sql.js` loads the full database into RAM. Not suitable for files producing millions of events.
- **Single-file upload** — batch processing is not supported.
- **No authentication** — the API is open; intended for local use only.
- **Brute force detection is session-scoped** — thresholds are evaluated per-upload, not across historical scans.

---

## Future Improvements

- [ ] Persistent PostgreSQL or SQLite (native) backend to handle larger datasets
- [ ] CIDR-range grouping for source IP analysis
- [ ] Time-series view for attack frequency over the log's time range
- [ ] User-configurable detection thresholds via environment variables
- [ ] Support for additional log formats: AWS ALB, Nginx JSON, Cloudflare
- [ ] Streaming upload progress for large files (replace polling with SSE)

---

## Project Structure

```
WatchTower/
├── backend/
│   ├── detectors/         # SQL injection, XSS, brute force, path traversal
│   ├── services/
│   │   ├── logParser.js         # Tokenises raw log lines into events
│   │   ├── threatDetector.js    # Orchestrates detectors, computes risk score
│   │   ├── ollamaService.js     # LLM prompting + rule-based fallback
│   │   └── reportGenerator.js  # PDFKit report layout
│   ├── routes/            # upload.js, analyze.js, report.js
│   ├── database/          # sql.js init + schema
│   └── server.js
├── frontend/
│   └── src/
│       ├── pages/Dashboard.js
│       ├── components/    # RiskScoreCard, ThreatFeed, AiPanel, etc.
│       ├── charts/        # ThreatChart (CSS bar chart, no canvas)
│       └── services/api.js
└── sample-logs/
```

---

## License

MIT# WatchTower
