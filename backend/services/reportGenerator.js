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

      doc
        .fontSize(13)
        .fillColor(colors.heading)
        .font('Helvetica-Bold')
        .text(title);

      doc.moveDown(0.2);

      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor('#e2e8f0')
        .lineWidth(1)
        .stroke();

      doc.moveDown(0.4);
    }

    function bodyText(text) {
      doc
        .fontSize(10)
        .fillColor(colors.body)
        .font('Helvetica')
        .text(text || '', {
          lineGap: 3,
        });
    }

    // HEADER

    doc.rect(0, 0, 595, 80).fill('#0f172a');

    doc
      .fontSize(22)
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .text('WatchTower', 50, 22);

    doc
      .fontSize(10)
      .fillColor('#94a3b8')
      .font('Helvetica')
      .text('Security Incident Report', 50, 50);

    doc
      .fontSize(9)
      .fillColor('#64748b')
      .text(new Date().toUTCString(), 400, 50, {
        align: 'right',
        width: 145,
      });

    doc.moveDown(3.5);

    // SCAN OVERVIEW

    sectionHeader('Scan Overview');

    const score = scan.overall_risk_score || 0;

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

      doc
        .font('Helvetica-Bold')
        .fillColor(colors.subheading)
        .text(label + ':', 50, y, {
          width: 140,
        });

      doc
        .font('Helvetica')
        .fillColor(
          label === 'Overall Risk Score'
            ? riskColor(score)
            : colors.body
        )
        .text(value, 200, y, {
          width: 345,
        });

      doc.moveDown(0.35);
    });

    // THREAT BREAKDOWN

    sectionHeader('Threat Severity Breakdown');

    const bySeverity = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    const byType = {};

    for (const t of threats) {
      if (bySeverity[t.severity] !== undefined) {
        bySeverity[t.severity]++;
      }

      byType[t.threat_type] =
        (byType[t.threat_type] || 0) + 1;
    }

    ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].forEach((sev) => {
      const count = bySeverity[sev];
      const y = doc.y;

      doc
        .font('Helvetica-Bold')
        .fillColor(severityColor(sev))
        .text(sev, 50, y, { width: 80 });

      doc
        .font('Helvetica')
        .fillColor(colors.body)
        .text(`${count} threat(s)`, 140, y, {
          width: 200,
        });

      doc.moveDown(0.35);
    });

    doc.moveDown(0.3);

    doc
      .font('Helvetica-Bold')
      .fillColor(colors.subheading)
      .text('By Attack Type:', 50);

    doc.moveDown(0.2);

    Object.entries(byType).forEach(([type, count]) => {
      const y = doc.y;

      doc
        .font('Helvetica')
        .fillColor(colors.body)
        .text(`• ${type}`, 60, y, {
          width: 300,
        });

      doc.text(String(count), 370, y, {
        width: 60,
      });

      doc.moveDown(0.3);
    });

    // EXECUTIVE SUMMARY

    sectionHeader('Executive Summary');

    bodyText(
      analysis?.executive_summary ||
        'No executive summary available.'
    );

    doc.moveDown();

    // THREAT ANALYSIS

    sectionHeader('Threat Analysis');

    bodyText(
      analysis?.explanation ||
        'No analysis available.'
    );

    doc.moveDown();

    // RISK ASSESSMENT

    sectionHeader('Risk Assessment');

    bodyText(
      analysis?.risk_assessment ||
        'No risk assessment available.'
    );

    doc.moveDown();

    // RECOMMENDATIONS

    sectionHeader('Recommendations');

    bodyText(
      analysis?.recommendation ||
        'No recommendations available.'
    );

    // FOOTER

    doc
      .fontSize(8)
      .fillColor(colors.muted)
      .font('Helvetica')
      .text(
        `WatchTower Security Report · Generated ${new Date().toISOString()} · ${scan.filename}`,
        50,
        800,
        {
          align: 'center',
          width: 495,
        }
      );

    doc.end();
  });
}

module.exports = {
  generateIncidentReport,
};