'use strict';
const PDFDocument = require('pdfkit');

function generateIncidentReport(scan, threats, analysis) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
    });

    const chunks = [];

    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const colors = {
      heading: '#1e293b',
      subheading: '#334155',
      body: '#475569',
      muted: '#94a3b8',
      accent: '#3b82f6',
      red: '#ef4444',
      orange: '#f97316',
      yellow: '#eab308',
      green: '#10b981',
      purple: '#8b5cf6',
    };

    function riskColor(score) {
      if (score >= 75) return colors.red;
      if (score >= 50) return colors.orange;
      if (score >= 25) return colors.yellow;
      return colors.green;
    }

    function riskLabel(score) {
      if (score >= 75) return 'CRITICAL';
      if (score >= 50) return 'HIGH';
      if (score >= 25) return 'MEDIUM';
      return 'LOW';
    }

    function severityColor(sev) {
      if (sev === 'CRITICAL') return colors.red;
      if (sev === 'HIGH') return colors.orange;
      if (sev === 'MEDIUM') return colors.yellow;
      return colors.accent;
    }

    function sectionHeader(title) {
      doc.moveDown(0.5);
      doc.fontSize(13).fillColor(colors.heading).font('Helvetica-Bold').text(title);
      doc.moveDown(0.2);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#e2e8f0').lineWidth(1).stroke();
      doc.moveDown(0.4);
    }

    function bodyText(text) {
      doc.fontSize(10).fillColor(colors.body).font('Helvetica').text(text, { lineGap: 3 });
    }

    // ── HEADER ──
    doc.rect(0, 0, 595, 80).fill('#0f172a');
    doc.fontSize(22).fillColor('#ffffff').font('Helvetica-Bold').text('WatchTower', 50, 22);
    doc.fontSize(10).fillColor('#94a3b8').font('Helvetica').text('Security Incident Report', 50, 50);
    doc.fontSize(9).fillColor('#64748b').text(new Date().toUTCString(), 400, 50, { align: 'right', width: 145 });

    doc.moveDown(3.5);

    // ── SCAN METADATA ──
    sectionHeader('Scan Overview');
    const score = scan.overall_risk_score || 0;
    doc.fontSize(10).fillColor(colors.body).font('Helvetica');

    const metaRows = [
      ['File Analyzed', scan.filename || 'N/A'],
      ['Overall Risk Score', `${score}/100 — ${riskLabel(score)}`],
      ['Total Log Events', String(scan.total_events || 0)],
      ['Threats Detected', String(threats.length)],
      ['Scan ID', scan.id || 'N/A'],
      ['Generated', new Date().toLocaleString()],
      ['AI Model', analysis?.model_used || 'N/A'],
    ];

    metaRows.forEach(([label, value]) => {
      const y = doc.y;
      doc.font('Helvetica-Bold').fillColor(colors.subheading).text(label + ':', 50, y, { continued: false, width: 140 });
      doc.font('Helvetica').fillColor(label === 'Overall Risk Score' ? riskColor(score) : colors.body)
        .text(value, 200, y, { width: 345 });
      doc.moveDown(0.35);
    });

    // ── SEVERITY BREAKDOWN ──
    sectionHeader('Threat Severity Breakdown');
    const bySeverity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const byType = {};
    for (const t of threats) {
      if (bySeverity[t.severity] !== undefined) bySeverity[t.severity]++;
      byType[t.threat_type] = (byType[t.threat_type] || 0) + 1;
    }

    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].forEach(sev => {
      const count = bySeverity[sev];
      const y = doc.y;
      doc.font('Helvetica-Bold').fillColor(severityColor(sev)).text(sev, 50, y, { width: 80 });
      doc.font('Helvetica').fillColor(colors.body).text(String(count) + ' threat(s)', 140, y, { width: 200 });
      doc.moveDown(0.35);
    });

    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fillColor(colors.subheading).text('By Attack Type:', 50);
    doc.moveDown(0.2);
    Object.entries(byType).forEach(([type, count]) => {
      const y = doc.y;
      doc.font('Helvetica').fillColor(colors.body).text(`• ${type}`, 60, y, { continued: false, width: 300 });
      doc.text(String(count), 370, y, { width: 60 });
      doc.moveDown(0.3);
    });

    // ── EXECUTIVE SUMMARY ──
    sectionHeader('Executive Summary');
    if (analysis?.executive_summary) {
      bodyText(analysis.executive_summary);
    } else {
      bodyText('No executive summary available. Configure GROQ_API_KEY to enable AI-generated summaries.');
    }

    doc.addPage();

    // ── AI ANALYSIS ──
    sectionHeader('AI Security Analysis');
    if (analysis?.model_used && analysis.model_used !== 'rule-based-fallback') {
      doc.fontSize(9).fillColor(colors.accent).font('Helvetica').text(`Powered by Groq • ${analysis.model_used}`);
      doc.moveDown(0.5);
    }

    if (analysis?.explanation) {
      doc.font('Helvetica-Bold').fillColor(colors.subheading).fontSize(11).text('Threat Explanation');
      doc.moveDown(0.3);
      bodyText(analysis.explanation);
      doc.moveDown(0.8);
    }

    if (analysis?.risk_assessment) {
      doc.font('Helvetica-Bold').fillColor(colors.subheading).fontSize(11).text('Risk Assessment');
      doc.moveDown(0.3);
      bodyText(analysis.risk_assessment);
      doc.moveDown(0.8);
    }

    if (analysis?.recommendation) {
      doc.font('Helvetica-Bold').fillColor(colors.subheading).fontSize(11).text('Recommended Actions');
      doc.moveDown(0.3);
      bodyText(analysis.recommendation);
      doc.moveDown(0.8);
    }

    // ── TOP THREATS TABLE ──
    doc.addPage();
    sectionHeader('Threat Log (Top 20)');

    // Table header
    const cols = [50, 180, 290, 360, 545];
    const headers = ['#', 'Type', 'Severity', 'Risk Score', 'Source IP'];
    const headerY = doc.y;
    doc.rect(50, headerY - 4, 495, 18).fill('#f1f5f9');
    headers.forEach((h, i) => {
      doc.font('Helvetica-Bold').fillColor(colors.subheading).fontSize(9)
        .text(h, cols[i], headerY, { width: (cols[i + 1] || 545) - cols[i] - 4 });
    });
    doc.moveDown(0.8);

    threats.slice(0, 20).forEach((t, i) => {
      if (doc.y > 720) doc.addPage();
      const rowY = doc.y;
      if (i % 2 === 0) doc.rect(50, rowY - 2, 495, 16).fill('#f8fafc');
      const cells = [
        String(i + 1),
        t.threat_type || 'Unknown',
        t.severity || 'N/A',
        String(t.risk_score || 0),
        t.source_ip || 'N/A',
      ];
      cells.forEach((cell, ci) => {
        const color = ci === 2 ? severityColor(t.severity) : colors.body;
        doc.font(ci === 2 ? 'Helvetica-Bold' : 'Helvetica').fillColor(color).fontSize(9)
          .text(cell, cols[ci], rowY, { width: (cols[ci + 1] || 545) - cols[ci] - 4 });
      });
      doc.moveDown(0.5);
    });

    // ── FOOTER ──
    doc.fontSize(8).fillColor(colors.muted).font('Helvetica')
      .text(`WatchTower Security Report · Generated ${new Date().toISOString()} · ${scan.filename}`, 50, 800, { align: 'center', width: 495 });

    doc.end();
  });
}

module.exports = { generateIncidentReport };