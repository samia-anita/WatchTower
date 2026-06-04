'use strict';
const PDFDocument = require('pdfkit');

// ─── Constants ───────────────────────────────────────────────────────────────
const PAGE_W     = 595.28;   // A4 points
const PAGE_H     = 841.89;
const MARGIN     = 56;
const CONTENT_W  = PAGE_W - MARGIN * 2;
const FOOTER_H   = 36;
// Usable bottom edge — never draw body content below this
const BODY_BOTTOM = PAGE_H - FOOTER_H - MARGIN;

const C = {
  ink:       '#111827',   // near-black for body text
  header:    '#0f172a',   // page header / footer bg
  primary:   '#1d4ed8',   // section rule / accent
  muted:     '#6b7280',   // secondary text
  border:    '#e5e7eb',   // light rule / cell borders
  bg:        '#f9fafb',   // alternating row / stat cell bg
  white:     '#ffffff',

  critical:  '#dc2626',
  high:      '#ea580c',
  medium:    '#d97706',
  low:       '#2563eb',
  success:   '#16a34a',
};

function sevColor(s) {
  return C[s?.toLowerCase()] ?? C.muted;
}

// ─── Main export ──────────────────────────────────────────────────────────────
function generateIncidentReport(scan, threats, analysis) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size:        'A4',
      bufferPages: true,           // must be true for footer pass
      margins:     { top: MARGIN, bottom: MARGIN + FOOTER_H, left: MARGIN, right: MARGIN },
      info: {
        Title:   `Security Incident Report — ${scan.filename}`,
        Author:  'WatchTower AI Security Dashboard',
        Subject: 'Security Incident Report',
      },
    });

    const chunks = [];
    doc.on('data',  c => chunks.push(c));
    doc.on('end',   ()  => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Page 1 ────────────────────────────────────────────────────────────────
    drawCoverHeader(doc, scan);
    doc.moveDown(2.5);

    // Executive summary
    addSection(doc, 'Executive Summary');
    bodyText(doc, analysis?.executive_summary || 'No executive summary available.');
    doc.moveDown(2.0);

    // Scan statistics
    addSection(doc, 'Scan Statistics');
    drawStatGrid(doc, scan, threats);
    doc.moveDown(1.5);

    // Threat breakdown
    addSection(doc, 'Threat Breakdown by Type');
    drawBreakdownList(doc, threats);

    // ── Page 2 — threat table ────────────────────────────────────────────────
    doc.addPage();
    addSection(doc, 'Threat Event Log');
    drawThreatTable(doc, threats);

    // ── Page 3 — AI analysis ─────────────────────────────────────────────────
    doc.addPage();
    addSection(doc, 'AI Threat Analysis');
    drawAiSection(doc, analysis);

    // ── Footer pass (all pages) ───────────────────────────────────────────────
    const range      = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(range.start + i);
      drawFooter(doc, i + 1, totalPages, scan);
    }

    doc.end();
  });
}

// ─── Cover header ─────────────────────────────────────────────────────────────
function drawCoverHeader(doc, scan) {
  // Dark band
  doc.rect(0, 0, PAGE_W, 108).fill(C.header);

  // Product wordmark
  doc.fillColor('#94a3b8')
     .font('Helvetica')
     .fontSize(9)
     .text('WatchTower  ·  AI SECURITY DASHBOARD', MARGIN, 22, { characterSpacing: 1 });

  // Report title
  doc.fillColor(C.white)
     .font('Helvetica-Bold')
     .fontSize(20)
     .text('Security Incident Report', MARGIN, 36);

  // Meta row
  doc.fillColor('#94a3b8')
     .font('Helvetica')
     .fontSize(9)
     .text(
       `Generated ${new Date().toUTCString()}   ·   File: ${scan.filename}`,
       MARGIN, 66,
     );

  // Risk score badge (right side)
  const score = scan.overall_risk_score ?? 0;
  const badgeColor = score >= 70 ? C.critical : score >= 40 ? C.high : C.success;
  const badgeX = PAGE_W - MARGIN - 72;
  doc.rect(badgeX, 18, 72, 72).fill(badgeColor);
  doc.fillColor(C.white)
     .font('Helvetica-Bold')
     .fontSize(32)
     .text(String(score), badgeX, 26, { width: 72, align: 'center' });
  doc.fillColor('rgba(255,255,255,0.75)')
     .font('Helvetica')
     .fontSize(8)
     .text('RISK SCORE', badgeX, 64, { width: 72, align: 'center', characterSpacing: 0.5 });
}

// ─── Section header ───────────────────────────────────────────────────────────
// Always checks for overflow before drawing — the single place that decides
// whether a new page is needed.
function addSection(doc, title, forceNewPage = false) {
  // If we're close to the bottom, push to a fresh page
  if (forceNewPage || doc.y > BODY_BOTTOM - 80) {
    doc.addPage();
  }

  const y = doc.y;
  // Accent rule
  doc.rect(MARGIN, y, 3, 14).fill(C.primary);
  doc.fillColor(C.primary)
     .font('Helvetica-Bold')
     .fontSize(11)
     .text(title.toUpperCase(), MARGIN + 10, y + 1, { characterSpacing: 0.5 });
  doc.moveDown(0.2);
  // Full-width hairline
  doc.rect(MARGIN, doc.y, CONTENT_W, 0.75).fill(C.border);
  doc.moveDown(0.8);
}

function addSubsection(doc, title) {
  ensureSpace(doc, 40);
  doc.fillColor(C.ink)
     .font('Helvetica-Bold')
     .fontSize(10)
     .text(title);
  doc.moveDown(0.3);
}

// ─── Body text ────────────────────────────────────────────────────────────────
function bodyText(doc, text, opts = {}) {
  doc.fillColor(C.ink)
     .font('Helvetica')
     .fontSize(10)
     .text(String(text ?? ''), { lineGap: 3, align: 'justify', ...opts });
}

// ─── Overflow guard ───────────────────────────────────────────────────────────
// Call before drawing any block that needs `neededPts` of vertical space.
function ensureSpace(doc, neededPts) {
  if (doc.y + neededPts > BODY_BOTTOM) {
    doc.addPage();
  }
}

// ─── Stat grid ────────────────────────────────────────────────────────────────
function drawStatGrid(doc, scan, threats) {
  const bySeverity = countBySeverity(threats);
  const stats = [
    ['Total Events',     String(scan.total_events ?? 0)],
    ['Threats Detected', String(threats.length)],
    ['Critical',         String(bySeverity.CRITICAL ?? 0)],
    ['High',             String(bySeverity.HIGH     ?? 0)],
    ['Medium',           String(bySeverity.MEDIUM   ?? 0)],
    ['Low',              String(bySeverity.LOW      ?? 0)],
  ];

  const cols       = 3;
  const cellW      = (CONTENT_W - (cols - 1) * 8) / cols;
  const cellH      = 52;
  const rowGap     = 8;
  const rows       = Math.ceil(stats.length / cols);
  const gridHeight = rows * cellH + (rows - 1) * rowGap;

  ensureSpace(doc, gridHeight + 8);
  const startY = doc.y;

  stats.forEach((stat, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx  = MARGIN + col * (cellW + 8);
    const cy  = startY + row * (cellH + rowGap);

    // Cell background
    doc.rect(cx, cy, cellW, cellH).fill(C.bg);
    // Left accent strip using severity color for the last 4 cells
    const stripColor = i === 2 ? C.critical : i === 3 ? C.high : i === 4 ? C.medium : i === 5 ? C.low : C.primary;
    doc.rect(cx, cy, 3, cellH).fill(stripColor);

    // Label
    doc.fillColor(C.muted)
       .font('Helvetica')
       .fontSize(8)
       .text(stat[0].toUpperCase(), cx + 10, cy + 10, { width: cellW - 14, lineBreak: false, characterSpacing: 0.3 });
    // Value
    doc.fillColor(C.ink)
       .font('Helvetica-Bold')
       .fontSize(22)
       .text(stat[1], cx + 10, cy + 22, { width: cellW - 14, lineBreak: false });
  });

  // Advance cursor past the grid
  doc.y = startY + gridHeight;
}

// ─── Threat breakdown list ────────────────────────────────────────────────────
function drawBreakdownList(doc, threats) {
  const byType = countByType(threats);

  for (const [type, count] of Object.entries(byType)) {
    ensureSpace(doc, 36);

    const typeThreats = threats.filter(t => t.threat_type === type);
    const sev         = typeThreats[0]?.severity ?? 'LOW';
    const maxScore    = Math.max(...typeThreats.map(t => t.risk_score ?? 0));
    const rowY        = doc.y;

    // Row bg
    doc.rect(MARGIN, rowY, CONTENT_W, 28).fill(C.bg);
    // Severity left strip
    doc.rect(MARGIN, rowY, 3, 28).fill(sevColor(sev));

    // Threat type name
    doc.fillColor(C.ink)
       .font('Helvetica-Bold')
       .fontSize(10)
       .text(type, MARGIN + 10, rowY + 7, { width: CONTENT_W * 0.55, lineBreak: false });

    // Right-side metadata — count, max score, severity — drawn at fixed X positions
    const metaY = rowY + 8;
    doc.fillColor(C.muted)
       .font('Helvetica')
       .fontSize(9);

    doc.text(`${count} event${count !== 1 ? 's' : ''}`,
             MARGIN + CONTENT_W * 0.58, metaY, { width: 70, lineBreak: false });
    doc.text(`Max score: ${maxScore}`,
             MARGIN + CONTENT_W * 0.72, metaY, { width: 80, lineBreak: false });

    // Severity badge
    const badgeX = MARGIN + CONTENT_W - 64;
    doc.rect(badgeX, rowY + 7, 60, 14).fill(sevColor(sev));
    doc.fillColor(C.white)
       .font('Helvetica-Bold')
       .fontSize(8)
       .text(sev, badgeX, rowY + 10, { width: 60, align: 'center', lineBreak: false });

    doc.y = rowY + 28 + 4;  // advance past row + gap
  }
}

// ─── Threat table ─────────────────────────────────────────────────────────────
function drawThreatTable(doc, threats) {
  const sorted = [...threats].sort((a, b) => {
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
  });

  const cols = [
    { label: 'THREAT TYPE',  w: 0.28 },
    { label: 'SEVERITY',     w: 0.12 },
    { label: 'SOURCE IP',    w: 0.18 },
    { label: 'RISK',         w: 0.08 },
    { label: 'TIMESTAMP',    w: 0.34 },
  ].map(c => ({ ...c, px: Math.floor(CONTENT_W * c.w) }));

  function drawHeaderRow() {
    ensureSpace(doc, 20);
    const y = doc.y;
    doc.rect(MARGIN, y, CONTENT_W, 20).fill(C.header);

    let cx = MARGIN;
    cols.forEach(col => {
      doc.fillColor(C.white)
         .font('Helvetica-Bold')
         .fontSize(8)
         .text(col.label, cx + 5, y + 6, { width: col.px - 8, lineBreak: false, characterSpacing: 0.3 });
      cx += col.px;
    });
    doc.y = y + 20;
  }

  drawHeaderRow();

  const displayed = sorted.slice(0, 50);
  displayed.forEach((threat, idx) => {
    ensureSpace(doc, 22);

    // Redraw header when a new page was just started
    if (doc.y < MARGIN + 30 && idx > 0) {
      drawHeaderRow();
    }

    const rowY   = doc.y;
    const rowH   = 20;
    const isEven = idx % 2 === 0;

    doc.rect(MARGIN, rowY, CONTENT_W, rowH).fill(isEven ? C.bg : C.white);

    const cells = [
      threat.threat_type   ?? '—',
      threat.severity      ?? '—',
      threat.source_ip     ?? '—',
      String(threat.risk_score ?? '—'),
      (threat.timestamp    ?? '—').substring(0, 19).replace('T', ' '),
    ];

    let cx = MARGIN;
    cells.forEach((cell, ci) => {
      const col = cols[ci];
      // Severity cell gets colored text
      const textColor = ci === 1 ? sevColor(threat.severity) : C.ink;
      const isBold    = ci === 1;

      doc.fillColor(textColor)
         .font(isBold ? 'Helvetica-Bold' : 'Helvetica')
         .fontSize(9)
         .text(String(cell).substring(0, 35), cx + 5, rowY + 6,
               { width: col.px - 8, lineBreak: false });
      cx += col.px;
    });

    doc.y = rowY + rowH;
  });

  if (threats.length > 50) {
    doc.moveDown(0.6);
    doc.fillColor(C.muted)
       .font('Helvetica')
       .fontSize(9)
       .text(`Showing 50 of ${threats.length} events. Full data available via API export.`,
             { align: 'right' });
  }
}

// ─── AI analysis section ──────────────────────────────────────────────────────
function drawAiSection(doc, analysis) {
  if (!analysis) {
    bodyText(doc, 'No AI analysis available for this scan.');
    return;
  }

  if (analysis.explanation) {
    addSubsection(doc, 'Technical Explanation');
    bodyText(doc, analysis.explanation);
    doc.moveDown(1);
  }

  if (analysis.risk_assessment) {
    ensureSpace(doc, 60);
    addSubsection(doc, 'Risk Assessment');
    bodyText(doc, analysis.risk_assessment);
    doc.moveDown(1);
  }

  if (analysis.recommendation) {
    ensureSpace(doc, 60);
    addSubsection(doc, 'Recommended Mitigation');
    bodyText(doc, analysis.recommendation);
    doc.moveDown(1);
  }

  if (analysis.model_used) {
    ensureSpace(doc, 20);
    doc.fillColor(C.muted)
       .font('Helvetica')
       .fontSize(8)
       .text(`Analysis model: ${analysis.model_used}`, { align: 'right' });
  }
}

// ─── Footer (called in buffer-pages pass) ─────────────────────────────────────
function drawFooter(doc, pageNum, totalPages, scan) {
  const y = PAGE_H - FOOTER_H;
  doc.rect(0, y, PAGE_W, FOOTER_H).fill(C.header);

  // Left: report title
  doc.fillColor('#475569')
     .font('Helvetica')
     .fontSize(8)
     .text(`Security Incident Report  ·  ${scan.filename}`, MARGIN, y + 13, { lineBreak: false });

  // Center: confidential
  doc.fillColor('#475569')
     .fontSize(8)
     .text('CONFIDENTIAL', 0, y + 13, { width: PAGE_W, align: 'center', lineBreak: false });

  // Right: page n of N
  doc.fillColor('#475569')
     .text(`Page ${pageNum} of ${totalPages}`, MARGIN, y + 13,
           { width: PAGE_W - MARGIN * 2, align: 'right', lineBreak: false });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function countBySeverity(threats) {
  const c = {};
  for (const t of threats) c[t.severity] = (c[t.severity] || 0) + 1;
  return c;
}

function countByType(threats) {
  const c = {};
  for (const t of threats) c[t.threat_type] = (c[t.threat_type] || 0) + 1;
  return c;
}

module.exports = { generateIncidentReport };