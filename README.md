# WatchTower

**AI-Powered Security Log Analysis & Incident Reporting**

---

## Overview

WatchTower is a local-first security analysis platform that ingests raw web server logs, detects attack patterns through a multi-stage detection pipeline, scores organizational risk, and produces AI-generated incident reports — all within seconds, with no cloud dependency. It transforms raw, unstructured log data into structured, actionable intelligence that security teams and non-technical stakeholders can immediately act on.

---

## Problem Statement

### What Problem Exists

Modern web infrastructure generates thousands of log entries per hour. Hidden within that noise are SQL injection attempts, brute-force credential attacks, cross-site scripting payloads, and directory traversal probes — each capable of causing significant damage if left undetected. Security analysts must manually review this data, correlate events across sources, and produce reports that communicate risk to both technical and executive audiences. That process is slow, inconsistent, and cognitively exhausting.

### Why It Matters

A single undetected SQL injection campaign can result in full database exfiltration. A brute-force attack that goes unnoticed for hours can lead to account compromise at scale. The time between a threat event and its detection — known as dwell time — is one of the most critical metrics in cybersecurity. Every hour of delayed detection extends the attacker's window of opportunity and amplifies organizational damage.

### Why Current Approaches Are Insufficient

Enterprise SIEM platforms (Splunk, IBM QRadar, Microsoft Sentinel) require substantial infrastructure investment, lengthy configuration cycles, and dedicated security engineering teams to operate effectively. They are priced and designed for large organizations. Smaller teams, independent developers, and hackathon-scale projects have no equivalent tool that delivers structured threat intelligence quickly, locally, and without a subscription fee. Rule-based log analyzers exist, but they produce raw findings without the narrative context or prioritized recommendations that drive real remediation action.

---

## Proposed Solution

### How WatchTower Solves the Problem

WatchTower accepts a raw `.log` or `.txt` file through a drag-and-drop interface, runs it through a four-stage detection pipeline, aggregates threat evidence into a structured risk profile, and sends that profile to a large language model to generate a human-readable incident narrative. The entire workflow completes in seconds. Results are cached in a local SQLite database so repeat analyses return instantly.

### Key Differentiators

- **Zero configuration** — no agents, no collectors, no data pipelines to build. Upload a file and get results.
- **Local-first by design** — no log data is transmitted to third-party infrastructure. The AI call sends only aggregated threat metadata, never raw log content.
- **Narrative output** — AI-generated analysis explains attacker behavior, likely objectives, and specific remediation steps in plain language, bridging the gap between raw findings and executive communication.
- **PDF-ready reporting** — every scan produces a professionally structured incident report suitable for management review or audit documentation.

### Why AI-Assisted Analysis Improves Outcomes

Rule-based detection systems identify *what* happened. AI analysis explains *why it matters*, *what the attacker likely intended*, and *what to do next* — in context. A list of 37 detected threats is difficult to prioritize. An AI-generated executive summary that says "a single IP conducted a sustained SQL injection campaign targeting the `/api/users` endpoint, consistent with automated credential harvesting" is immediately actionable. WatchTower combines the precision of deterministic detection with the explanatory power of large language models.

---

## Key Features

**Log Ingestion**
Upload `.log` or `.txt` files up to 10 MB through a drag-and-drop interface or file picker. The parser tokenizes raw log lines into structured events, extracting timestamps, source IPs, HTTP methods, endpoints, status codes, and user agents.

**Threat Detection**
Four specialized detectors run against all parsed events in parallel: SQL Injection, Cross-Site Scripting (XSS), Brute Force, and Path Traversal. Each detector uses pattern matching calibrated to known attack signatures, including encoded variants and obfuscated payloads.

**Risk Scoring**
Each detected threat receives an individual risk score based on severity, frequency, and attack confidence. Scores are aggregated into a 0–100 overall risk index that provides an at-a-glance assessment of log file danger level.

**AI-Powered Incident Analysis**
Aggregated threat evidence is submitted to the Groq API, which routes the prompt to the best available large language model (preferring Llama 3.3 70B or DeepSeek R1 Distill 70B). The model returns a structured JSON response containing an executive summary, technical explanation, risk assessment, and concrete remediation recommendations. Results are cached; repeat requests return from the local database instantly.

**PDF Report Generation**
Every completed scan can be exported as a PDF incident report via PDFKit. Reports include an executive summary, full threat table with severity ratings, AI narrative, and remediation guidance — formatted for management review or audit records.

**Dashboard Visualization**
A React-based dashboard presents the risk score, severity breakdown, threat feed, AI analysis panel, and threat timeline in a unified interface. All views update immediately upon scan completion.

**Threat Categorization**
All detected threats are classified by type (SQL Injection, XSS, Brute Force, Path Traversal), enabling quick identification of dominant attack vectors in a given log file.

**Severity Breakdown**
Threats are rated across four severity levels — CRITICAL, HIGH, MEDIUM, and LOW — giving analysts a fast triage view before diving into per-threat detail.

**Security Recommendations**
The AI analysis component produces specific, actionable remediation steps tailored to the threats detected in each scan, referencing exact source IPs, targeted endpoints, and attack patterns observed in the evidence.

---

## System Architecture

### High-Level Overview

WatchTower follows a three-tier architecture: a React single-page application handles the user interface, an Express REST API handles all processing and persistence, and the Groq API provides AI-powered analysis. All components communicate over HTTP. The backend is stateful within a session; the SQLite database persists scans and AI results across server restarts.

```
┌─────────────────────────────────────────────────────────────┐
│                    React Frontend                           │
│              (http://localhost:3000)                        │
│                                                             │
│   UploadZone → Dashboard → ThreatFeed → AiPanel            │
│   RiskScoreCard │ ThreatChart │ ThreatTimeline              │
│   ExecutiveSummary │ Sidebar │ AppHeader                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP  /api/*  (proxied)
┌──────────────────────────▼──────────────────────────────────┐
│                   Express API Backend                       │
│              (http://localhost:3001)                        │
│                                                             │
│  POST /api/upload                                           │
│    └─ logParser → threatDetector → SQLite                   │
│                                                             │
│  POST /api/analyze-ai                                       │
│    └─ groqService → SQLite (cached)                         │
│                                                             │
│  GET  /api/report/:id                                       │
│    └─ reportGenerator (PDFKit)                              │
│                                                             │
│  GET  /api/geo                                              │
│    └─ IP geolocation enrichment                             │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────┐
│                      Groq API                               │
│         api.groq.com/openai/v1/chat/completions             │
│                                                             │
│  Models (in preference order):                              │
│    llama-3.3-70b-versatile                                  │
│    deepseek-r1-distill-llama-70b                            │
│    mixtral-8x7b-32768                                       │
└─────────────────────────────────────────────────────────────┘
```

### Backend Workflow

```
Log File Upload
      │
      ▼
  logParser.js
  Tokenize raw lines → structured events
  (timestamp, IP, method, path, status, user-agent)
      │
      ▼
  threatDetector.js
  Orchestrate 4 detectors in parallel:
  ┌─────────────┐  ┌──────────┐  ┌─────────────┐  ┌───────────────┐
  │sqlInjection │  │  xss.js  │  │bruteForce.js│  │pathTraversal  │
  │    .js      │  │          │  │             │  │    .js        │
  └─────────────┘  └──────────┘  └─────────────┘  └───────────────┘
      │
      ▼
  Compute per-threat risk scores
  Aggregate overall risk index (0–100)
      │
      ▼
  Persist scan + threats → SQLite
      │
      ▼
  Return scan ID + structured results to frontend
```

### Frontend Workflow

```
User drops file onto UploadZone
      │
      ▼
  POST /api/upload  →  scan results
      │
      ▼
  Dashboard renders:
  ├── RiskScoreCard    (overall risk index)
  ├── ThreatFeed       (per-threat table)
  ├── ThreatChart      (severity bar chart)
  ├── ThreatTimeline   (events over time)
  └── ExecutiveSummary (top-line stats)
      │
      ▼
  User clicks "Analyze with AI"
      │
      ▼
  POST /api/analyze-ai  →  AI narrative (or cached result)
      │
      ▼
  AiPanel renders:
  ├── Executive Summary
  ├── Technical Explanation
  ├── Risk Assessment
  └── Remediation Recommendations
      │
      ▼
  User clicks "Download Incident Report"
      │
      ▼
  GET /api/report/:id  →  PDF download
```

### AI Workflow

```
  groqService.js

  1. Check model cache (10-minute TTL)
  2. Query Groq /models endpoint for available models
  3. Probe preferred models in order until one responds
  4. Cache working model

  5. Build evidence block from scan data:
     - Filename, total events, total threats, risk score
     - Threat type distribution
     - Severity breakdown
     - Top source IPs
     - Top targeted endpoints
     - Full threat detail (up to 50 threats)

  6. Submit to Groq chat completions with senior CSIRT system prompt
  7. Parse JSON response:
     {
       "executive_summary": "...",
       "explanation": "...",
       "risk_assessment": "...",
       "recommendation": "..."
     }
  8. Persist to SQLite → serve to frontend
```

---

## Technology Stack

**Frontend**
- React 18 — component-based UI framework
- React DOM — DOM rendering
- Axios — HTTP client for API communication
- JavaScript (ES6+) — application logic
- CSS — custom styling (no UI component library)
- Create React App (react-scripts 5) — build tooling

**Backend**
- Node.js (≥ 18) — JavaScript runtime
- Express 4 — REST API framework
- Multer — multipart file upload handling (10 MB limit, `.log` / `.txt`)
- CORS — cross-origin request handling
- Morgan — HTTP request logging
- Axios — HTTP client for Groq API calls
- dotenv — environment variable management
- Nodemon — development auto-reload

**Database**
- sql.js 1.10 — SQLite compiled to WebAssembly; file-persisted to `backend/database/security.db.json`

**AI**
- Groq API — inference provider
- Llama 3.3 70B Versatile (`llama-3.3-70b-versatile`) — primary model
- DeepSeek R1 Distill Llama 70B (`deepseek-r1-distill-llama-70b`) — secondary model
- Mixtral 8x7B 32768 (`mixtral-8x7b-32768`) — tertiary fallback model

**Reporting**
- PDFKit 0.15 — programmatic PDF generation

**Utilities**
- UUID 9 — scan ID generation
- JavaScript regex — pattern-based threat detection

---

## Installation

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- A Groq API key (free tier available at [console.groq.com](https://console.groq.com))

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/watchtower.git
cd watchtower
```

### 2. Configure the Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env` and add your Groq API key (see [Environment Variables](#environment-variables) below).

### 3. Install Backend Dependencies

```bash
cd backend
npm install
```

### 4. Install Frontend Dependencies

```bash
cd frontend
npm install
```

---

## Environment Variables

All environment variables are configured in `backend/.env`.

| Variable       | Required | Description                                      | Example                      |
|----------------|----------|--------------------------------------------------|------------------------------|
| `GROQ_API_KEY` | Yes      | Groq API key for AI-powered analysis             | `gsk_abc123...`              |
| `PORT`         | No       | Backend server port (default: `3001`)            | `3001`                       |

**Example `backend/.env`:**

```env
GROQ_API_KEY=your_groq_api_key_here
PORT=3001
```

> Without a valid `GROQ_API_KEY`, WatchTower will still perform all threat detection and risk scoring. The AI analysis step will be unavailable, and the `/api/analyze-ai` endpoint will return a service-unavailable response.

---

## Running Locally

### Start the Backend

```bash
cd backend

# Production mode
npm start

# Development mode (auto-reload on file changes)
npm run dev
```

The backend starts on **http://localhost:3001**.

### Start the Frontend

Open a second terminal:

```bash
cd frontend
npm start
```

The app opens at **http://localhost:3000**. The React development server automatically proxies all `/api/*` requests to `localhost:3001`.

### Development Workflow

1. Start the backend in dev mode (`npm run dev` in `/backend`)
2. Start the frontend (`npm start` in `/frontend`)
3. Edit backend files — Nodemon restarts the server automatically
4. Edit frontend files — Create React App hot-reloads the browser automatically
5. Scan results and AI analyses persist in `backend/database/security.db.json` across server restarts

---

## Usage Guide

### Step-by-Step Instructions

**1. Open the Application**
Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

**2. Upload a Log File**
Drag a `.log` or `.txt` file onto the upload zone, or click to open the file picker. Sample files are provided in `sample-logs/` for immediate testing.

**3. Run Analysis**
Click **Analyze File**. The pipeline runs three stages in sequence:
- Upload & parse — raw lines are tokenized into structured events
- Threat detection — four detectors scan all events in parallel
- Risk scoring — per-threat scores aggregate into an overall risk index

**4. Review Results**
The dashboard populates with:
- Overall risk score (0–100)
- Severity breakdown (CRITICAL / HIGH / MEDIUM / LOW counts)
- Threat feed with per-threat detail
- Threat distribution chart
- Event timeline

**5. Run AI Analysis**
Click **Analyze with AI**. WatchTower submits aggregated threat evidence to the Groq API and displays the AI-generated narrative in the AI Analysis panel. If the same scan has been analyzed before, the cached result returns immediately.

**6. Export the Report**
Click **Download Incident Report** to export a PDF containing the full scan summary, threat table, and AI analysis. The report is formatted for management review or audit documentation.

---

## Security Analysis Pipeline

The following six-stage pipeline runs sequentially on every uploaded log file:

**Stage 1 — Upload & Ingest**
The frontend submits the log file via `multipart/form-data`. Multer validates the file type (`.log` / `.txt`) and size (≤ 10 MB), then passes the file path to the parsing stage.

**Stage 2 — Parse Events**
`logParser.js` reads each line and extracts structured fields: timestamp, source IP, HTTP method, request path, status code, response size, and user agent. Lines that do not match the expected format are discarded. The parser outputs an array of event objects.

**Stage 3 — Detect Threats**
`threatDetector.js` routes all events through four specialized detectors running in parallel:

| Detector       | Severity Range | Detection Logic                                                    |
|----------------|----------------|--------------------------------------------------------------------|
| SQL Injection  | HIGH–CRITICAL  | Pattern match on UNION SELECT, boolean injection, `--` comments, encoded payloads |
| XSS            | MEDIUM–HIGH    | `<script>`, `onerror=`, `document.cookie`, encoded variants        |
| Brute Force    | MEDIUM–HIGH    | ≥ 5 failed auth attempts from the same IP within the scan window  |
| Path Traversal | MEDIUM–HIGH    | `../`, `/etc/passwd`, `cmd.exe`, URL-encoded traversal sequences  |

**Stage 4 — Score Threats**
Each detected threat receives an individual risk score based on severity and confidence. Scores are aggregated into a single overall risk index on a 0–100 scale.

**Stage 5 — Aggregate Evidence**
`groqService.js` builds an evidence block from the scan results, summarizing threat type distribution, severity breakdown, top source IPs, top targeted endpoints, and full detail on up to 50 individual threats.

**Stage 6 — AI Analysis**
The evidence block is submitted to the Groq API with a senior CSIRT analyst system prompt. The model returns a structured JSON object with four fields: `executive_summary`, `explanation`, `risk_assessment`, and `recommendation`. The response is parsed, validated, and persisted to SQLite.

**Stage 7 — Generate Report**
`reportGenerator.js` uses PDFKit to produce a structured PDF from the scan data and AI analysis. The report is streamed directly to the client as a download.

---

## Example Output

### Scan Response (JSON)

```json
{
  "scanId": "a3f1e2d4-7c9b-4a12-b8e5-0f1234567890",
  "filename": "attack.log",
  "totalEvents": 1842,
  "totalThreats": 37,
  "overallRiskScore": 91,
  "threats": [
    {
      "threat_type": "SQL Injection",
      "severity": "CRITICAL",
      "risk_score": 95,
      "source_ip": "192.168.1.105",
      "target_endpoint": "/api/users/login",
      "raw_evidence": "' OR 1=1 UNION SELECT username,password FROM users--",
      "timestamp": "2024-01-15T14:23:07Z"
    },
    {
      "threat_type": "Brute Force",
      "severity": "HIGH",
      "risk_score": 78,
      "source_ip": "10.0.0.22",
      "target_endpoint": "/admin/login",
      "raw_evidence": "23 failed authentication attempts within 4 minutes",
      "timestamp": "2024-01-15T14:31:42Z"
    }
  ]
}
```

### AI Analysis Response (JSON)

```json
{
  "executive_summary": "The log file reveals a coordinated multi-vector attack originating primarily from 192.168.1.105. The attacker conducted automated SQL injection against authentication endpoints consistent with credential harvesting, while a secondary actor at 10.0.0.22 executed a brute-force campaign against the admin panel. Immediate containment is required.",
  "explanation": "The SQL injection payloads target the /api/users/login endpoint using UNION-based injection to extract username and password columns from the users table. The use of boolean injection variants alongside UNION SELECT indicates a tool-assisted attack, likely sqlmap. Simultaneously, 23 failed POST requests to /admin/login from 10.0.0.22 within a 4-minute window indicate automated credential stuffing.",
  "risk_assessment": "Overall risk is CRITICAL (91/100). Successful exploitation of the SQL injection vector would result in full authentication bypass and potential access to the complete user database. The brute-force campaign has not yet succeeded but remains active.",
  "recommendation": "1. Immediately block 192.168.1.105 and 10.0.0.22 at the firewall. 2. Audit the users table for unauthorized access or data extraction. 3. Implement parameterized queries on all database-touching endpoints. 4. Enable account lockout after 5 failed attempts on /admin/login. 5. Deploy a WAF rule blocking UNION SELECT patterns in request paths and bodies."
}
```

### PDF Report Structure

```
WatchTower Incident Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Scan ID:          a3f1e2d4-7c9b-4a12-b8e5-0f1234567890
  File Analyzed:    attack.log
  Report Generated: 2024-01-15 15:02:33 UTC
  Overall Risk:     91 / 100  [CRITICAL]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTIVE SUMMARY
  [AI-generated paragraph]

SCAN STATISTICS
  Total Events:     1,842
  Total Threats:    37
  Critical:         12
  High:             18
  Medium:           7
  Low:              0

THREAT TABLE
  #   Type              Severity   Risk   Source IP       Endpoint
  1   SQL Injection      CRITICAL   95    192.168.1.105  /api/users/login
  2   Brute Force        HIGH       78    10.0.0.22      /admin/login
  ...

AI ANALYSIS
  Technical Explanation:  [AI-generated paragraph]
  Risk Assessment:        [AI-generated paragraph]
  Recommendations:        [AI-generated numbered list]
```

---

## Future Enhancements

- **Multi-tenant support** — user accounts with isolated scan histories and report archives
- **Real-time monitoring** — continuous log tail ingestion via SSE or WebSocket rather than file upload
- **SIEM integrations** — bidirectional connectors for Splunk, Elastic SIEM, and Microsoft Sentinel
- **Threat intelligence feeds** — IP reputation enrichment via AbuseIPDB, VirusTotal, and Shodan
- **Role-based access control (RBAC)** — analyst, manager, and administrator permission tiers
- **Advanced analytics** — time-series attack frequency charts, attacker geolocation mapping, trending threat types
- **Additional log formats** — AWS ALB, Nginx JSON, Cloudflare, Apache Combined, Syslog RFC 5424
- **Batch processing** — multi-file upload and cross-file correlation
- **Configurable detection thresholds** — user-adjustable brute-force windows and severity mappings via environment variables
- **Streaming upload progress** — replace polling with Server-Sent Events for large file uploads
- **Native SQLite persistence** — replace sql.js (in-memory) with better-sqlite3 or PostgreSQL for large-scale deployments

---

## Project Structure

```
WatchTower/
├── backend/
│   ├── detectors/
│   │   ├── sqlInjection.js       # UNION SELECT, boolean injection, comment patterns
│   │   ├── xss.js                # Script tags, event handlers, encoded XSS variants
│   │   ├── bruteForce.js         # IP-based failed auth threshold detection
│   │   └── pathTraversal.js      # Directory traversal, sensitive file access
│   ├── services/
│   │   ├── logParser.js          # Tokenizes raw log lines into structured events
│   │   ├── threatDetector.js     # Orchestrates detectors, computes risk scores
│   │   ├── groqService.js        # Groq API integration, model selection, evidence building
│   │   └── reportGenerator.js    # PDFKit report layout and generation
│   ├── routes/
│   │   ├── upload.js             # POST /api/upload
│   │   ├── analyze.js            # POST /api/analyze-ai, GET /api/analyze-ai/health
│   │   ├── report.js             # GET /api/report/:id
│   │   └── geo.js                # GET /api/geo (IP geolocation enrichment)
│   ├── database/
│   │   └── init.js               # sql.js initialization and schema definition
│   ├── uploads/                  # Temporary file storage (auto-cleared)
│   ├── server.js                 # Express app entry point
│   ├── package.json
│   └── .env                      # Environment variables (not committed)
├── frontend/
│   └── src/
│       ├── pages/
│       │   └── Dashboard.js      # Main application view
│       ├── components/
│       │   ├── UploadZone.js     # Drag-and-drop file upload interface
│       │   ├── RiskScoreCard.js  # Overall risk index display
│       │   ├── ThreatFeed.js     # Per-threat detail table
│       │   ├── AiPanel.js        # AI analysis narrative display
│       │   ├── ExecutiveSummary.js # Top-line scan statistics
│       │   ├── ThreatTimeline.js # Event frequency over time
│       │   ├── AppHeader.js      # Application header and navigation
│       │   ├── Sidebar.js        # Navigation sidebar
│       │   └── Toast.js          # User notification toasts
│       ├── charts/
│       │   └── ThreatChart.js    # CSS-based severity bar chart
│       ├── services/
│       │   └── api.js            # Axios API client
│       └── index.js              # React application entry point
├── sample-logs/
│   ├── attack.log                # High-volume mixed attacks (risk ≈ 90)
│   ├── mixed.log                 # Moderate threats among normal traffic
│   └── normal.log                # Clean traffic with no detected threats
└── README.md
```

---

## License

MIT License

