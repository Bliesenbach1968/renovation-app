import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type ExcelJSType from 'exceljs';
import { getProject, getProjectSummary, getRooms, getUnits, frierePlanwerteEin, loeschePlanwerte } from '../api/projects';
import { getFinanceSummary } from '../api/finance';
import type { ProjectSummary, Project, BereichVergleichRow, PhaseType } from '../types';
import type { FinanceSummary } from '../domain/finance/VariableInterestEngine';

const PLAN_PHASE_NAMES: Record<string, string> = {
  demolition: 'Entkernung', renovation: 'Renovierung', specialConstruction: 'Sonderarbeiten',
  baunebenkosten: 'Baunebenkosten', planungskosten: 'Planungskosten',
  ausstellung: 'Ausstattung', vertrieb: 'Vertriebskosten',
};
const PLAN_PHASE_ORDER = ['demolition', 'renovation', 'specialConstruction', 'baunebenkosten', 'planungskosten', 'ausstellung', 'vertrieb'];
const MODULE_PHASES = ['baunebenkosten', 'planungskosten', 'ausstellung', 'vertrieb'] as const;

function deltaColor(pct: number | null) {
  if (pct === null) return 'text-gray-400';
  if (Math.abs(pct) <= 2) return 'text-green-600';
  if (Math.abs(pct) < 5)  return 'text-amber-600';
  return 'text-red-600 font-semibold';
}

function PlanVsIstTabelle({ rows }: { rows: BereichVergleichRow[] }) {
  const byPhase: Record<string, BereichVergleichRow[]> = {};
  for (const row of rows) {
    if (!byPhase[row.phaseType]) byPhase[row.phaseType] = [];
    byPhase[row.phaseType].push(row);
  }
  const planVorhanden = rows.some((r) => r.plan !== null);

  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 italic py-1">Keine Positionen vorhanden.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-gray-700">
            <th className="text-left py-2 px-3 font-semibold w-32">Phase</th>
            <th className="text-left py-2 px-3 font-semibold">Bereich</th>
            <th className="text-right py-2 px-3 font-semibold">Plan (€)</th>
            <th className="text-right py-2 px-3 font-semibold">Ist (€)</th>
            <th className="text-right py-2 px-3 font-semibold">Δ (€)</th>
            <th className="text-right py-2 px-3 font-semibold">Δ (%)</th>
          </tr>
        </thead>
        <tbody>
          {PLAN_PHASE_ORDER.filter((p) => byPhase[p]).map((phase) => {
            const phaseRows = byPhase[phase];
            // Wenn kein Planwert eingefroren: aktuelle Kosten = Plan, Ist = leer
            // Wenn Planwert eingefroren: Plan = Baseline, Ist = aktuelle Kosten
            const subIstRaw  = phaseRows.reduce((s, r) => s + r.ist, 0);
            const subPlanRaw = phaseRows.every((r) => r.plan !== null)
              ? phaseRows.reduce((s, r) => s + (r.plan ?? 0), 0)
              : null;
            const subDelta = subPlanRaw !== null ? subIstRaw - subPlanRaw : null;
            const subPct   = subPlanRaw !== null && subPlanRaw !== 0 ? +((subDelta! / subPlanRaw) * 100).toFixed(1) : null;
            // Anzeigewerte je Phase
            const subPlanAnzeige = subPlanRaw !== null ? subPlanRaw : subIstRaw;
            const subIstAnzeige  = subPlanRaw !== null ? subIstRaw : null;
            return (
              <React.Fragment key={phase}>
                <tr className="bg-gray-100 border-t-2 border-gray-300">
                  <td colSpan={6} className="py-1.5 px-3 font-semibold text-gray-800 text-xs uppercase tracking-wide">
                    {PLAN_PHASE_NAMES[phase]}
                  </td>
                </tr>
                {phaseRows.map((row, i) => {
                  // Anzeigelogik je Zeile
                  const planAnzeige = row.plan !== null ? row.plan : row.ist;
                  const istAnzeige  = row.plan !== null ? row.ist : null;
                  return (
                    <tr key={`${phase}-${i}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-3" />
                      <td className="py-2 px-3 text-gray-700">{row.bereich ?? <span className="italic text-gray-400">Ohne Bereich</span>}</td>
                      <td className="py-2 px-3 text-right text-gray-600">{eur(planAnzeige)}</td>
                      <td className="py-2 px-3 text-right text-gray-900">{istAnzeige !== null ? eur(istAnzeige) : '–'}</td>
                      <td className={`py-2 px-3 text-right ${deltaColor(row.deltaPercent)}`}>{row.delta !== null ? eur(row.delta) : '–'}</td>
                      <td className={`py-2 px-3 text-right ${deltaColor(row.deltaPercent)}`}>
                        {row.deltaPercent !== null ? `${row.deltaPercent > 0 ? '+' : ''}${row.deltaPercent.toLocaleString('de-DE', { minimumFractionDigits: 1 })} %` : '–'}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-gray-300 bg-gray-50 font-semibold">
                  <td className="py-2 px-3 text-gray-500 text-xs">Gesamt</td>
                  <td className="py-2 px-3">{PLAN_PHASE_NAMES[phase]}</td>
                  <td className="py-2 px-3 text-right">{eur(subPlanAnzeige)}</td>
                  <td className="py-2 px-3 text-right">{subIstAnzeige !== null ? eur(subIstAnzeige) : '–'}</td>
                  <td className={`py-2 px-3 text-right ${deltaColor(subPct)}`}>{subDelta !== null ? eur(subDelta) : '–'}</td>
                  <td className={`py-2 px-3 text-right ${deltaColor(subPct)}`}>
                    {subPct !== null ? `${subPct > 0 ? '+' : ''}${subPct.toLocaleString('de-DE', { minimumFractionDigits: 1 })} %` : '–'}
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-2">* Container, Gerüst und Kran werden den Bereichen „Container &amp; Entsorgung", „Gerüst" und „Kran" zugeordnet.</p>
      {!planVorhanden && (
        <p className="text-xs text-amber-600 mt-1 italic">Aktuelle Kosten werden als Planwerte angezeigt. Klicken Sie auf „Planwerte jetzt einfrieren", um eine Baseline zu setzen und Abweichungen zu tracken.</p>
      )}
    </div>
  );
}

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

const PHASE_NAMES: Record<string, string> = {
  demolition: 'Entkernung', renovation: 'Renovierung', specialConstruction: 'Sonderarbeiten',
  baunebenkosten: 'Baunebenkosten', planungskosten: 'Planungskosten',
  ausstellung: 'Ausstattung', vertrieb: 'Vertriebskosten',
};
const PHASE_COLORS: Record<string, string> = {
  demolition: 'border-l-red-500', renovation: 'border-l-blue-500', specialConstruction: 'border-l-green-500',
  baunebenkosten: 'border-l-violet-500', planungskosten: 'border-l-cyan-500',
  ausstellung: 'border-l-amber-500', vertrieb: 'border-l-teal-500',
};

function PhaseCard({ phase, data }: { phase: string; data: any }) {
  return (
    <div className={`card border-l-4 ${PHASE_COLORS[phase]}`}>
      <h3 className="font-semibold text-gray-900 mb-3">{PHASE_NAMES[phase]}</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">Materialkosten</span><span>{eur(data.materialCost)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Entsorgungskosten</span><span>{eur(data.disposalCost)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Arbeitskosten</span><span>{eur(data.laborCost)}</span></div>
        <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2 mt-2">
          <span>Phasensumme</span><span className="text-primary-700">{eur(data.subtotal)}</span>
        </div>
        <div className="text-xs text-gray-400">{data.positionCount} Position{data.positionCount !== 1 ? 'en' : ''} · {data.totalHours.toFixed(1)} Std.</div>
      </div>
    </div>
  );
}

// ─── PDF-Download ──────────────────────────────────────────────────────────────

const DARK_BLUE: [number, number, number] = [30, 58, 95];
const LIGHT_BLUE: [number, number, number] = [232, 240, 250];
const PHASE_ORDER: Array<'demolition' | 'renovation' | 'specialConstruction'> = [
  'demolition', 'renovation', 'specialConstruction',
];
const ALL_PHASE_ORDER = [...PHASE_ORDER, 'baunebenkosten', 'planungskosten', 'ausstellung', 'vertrieb'] as const;

function downloadPDF(project: Project, summary: ProjectSummary) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const colW = pageW - margin * 2;
  const now = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // ── Kopfzeile ──────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK_BLUE);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Kostenkalkulation', margin, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${project.name}  ·  ${project.projectNumber}`, margin, 19);
  doc.text(
    `${project.address.street}, ${project.address.zipCode} ${project.address.city}  ·  Erstellt am ${now}`,
    margin, 25,
  );
  doc.setTextColor(0, 0, 0);

  let y = 36;

  // ── Pro Phase ──────────────────────────────────────────────────────────────
  for (const phase of PHASE_ORDER) {
    const d = summary.phases[phase];
    if (!d) continue;
    const phaseName = PHASE_NAMES[phase];

    const costRows: [string, string][] = [
      ['Materialkosten', eur(d.materialCost)],
      ['Entsorgungskosten', eur(d.disposalCost)],
      ['Arbeitskosten', eur(d.laborCost)],
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: colW,
      head: [[{ content: phaseName, colSpan: 2, styles: { halign: 'left', fillColor: DARK_BLUE, textColor: 255, fontStyle: 'bold', fontSize: 10 } }]],
      body: [
        ...costRows,
        [
          { content: `Phasensumme ${phaseName}`, styles: { fontStyle: 'bold', fillColor: LIGHT_BLUE } },
          { content: eur(d.subtotal), styles: { fontStyle: 'bold', fillColor: LIGHT_BLUE, halign: 'right' } },
        ],
        [
          { content: `Arbeitsstunden: ${d.totalHours.toFixed(1)} Std.  ·  ${d.positionCount} Position${d.positionCount !== 1 ? 'en' : ''}`, colSpan: 2, styles: { textColor: [100, 100, 100] as [number,number,number], fontSize: 8 } },
        ],
      ],
      columnStyles: { 0: { cellWidth: colW * 0.72 }, 1: { halign: 'right', cellWidth: colW * 0.28 } },
      styles: { fontSize: 9, cellPadding: 2.5 },
      bodyStyles: { textColor: [30, 30, 30] },
      alternateRowStyles: {},
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    if (y > 260 && phase !== 'specialConstruction') {
      doc.addPage();
      y = 15;
    }
  }

  // ── Module (Baunebenkosten etc.) ──────────────────────────────────────────
  const moduleRows: Array<[string, string]> = (
    ['baunebenkosten', 'planungskosten', 'ausstellung', 'vertrieb'] as const
  )
    .filter((m) => summary.phases[m]?.subtotal > 0)
    .map((m) => [PHASE_NAMES[m], eur(summary.phases[m].subtotal)]);

  if (moduleRows.length > 0) {
    if (y + 10 + moduleRows.length * 8 + 10 > 280) { doc.addPage(); y = 15; }
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: colW,
      head: [[{ content: 'Weitere Kosten', colSpan: 2, styles: { halign: 'left', fillColor: [80, 50, 120] as [number,number,number], textColor: 255, fontStyle: 'bold', fontSize: 10 } }]],
      body: moduleRows,
      columnStyles: { 0: { cellWidth: colW * 0.72 }, 1: { halign: 'right', cellWidth: colW * 0.28 } },
      styles: { fontSize: 9, cellPadding: 2.5 },
      bodyStyles: { textColor: [30, 30, 30] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── Gesamtkosten ──────────────────────────────────────────────────────────
  const t = summary.totals;
  const moduleSubtotals: Array<[string, string]> = (
    ['baunebenkosten', 'planungskosten', 'ausstellung', 'vertrieb'] as const
  )
    .filter((m) => summary.phases[m]?.subtotal > 0)
    .map((m) => [PHASE_NAMES[m], eur(summary.phases[m].subtotal)]);
  const totalRows: Array<[string, string]> = [
    ['Materialkosten (Entkernung + Renovierung + Sonderarbeiten)', eur(t.materialCost)],
    ['Entsorgungskosten', eur(t.disposalCost)],
    ['Arbeitskosten', eur(t.laborCost)],
    ...moduleSubtotals,
  ];
  if (y + 10 + totalRows.length * 8 + 20 > 280) {
    doc.addPage();
    y = 15;
  }

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    tableWidth: colW,
    head: [[{ content: 'Gesamtkosten Projekt', colSpan: 2, styles: { halign: 'left', fillColor: DARK_BLUE, textColor: 255, fontStyle: 'bold', fontSize: 11 } }]],
    body: [
      ...totalRows,
      [
        { content: 'GESAMTSUMME', styles: { fontStyle: 'bold', fillColor: DARK_BLUE, textColor: 255 as unknown as [number,number,number], fontSize: 12 } },
        { content: eur(t.grandTotal), styles: { fontStyle: 'bold', fillColor: DARK_BLUE, textColor: 255 as unknown as [number,number,number], halign: 'right', fontSize: 12 } },
      ],
      [
        { content: `Gesamte Arbeitsstunden: ${t.totalHours.toFixed(0)} Std.`, colSpan: 2, styles: { textColor: [100, 100, 100] as [number,number,number], fontSize: 8, fontStyle: 'italic' } },
      ],
    ],
    columnStyles: { 0: { cellWidth: colW * 0.72 }, 1: { halign: 'right', cellWidth: colW * 0.28 } },
    styles: { fontSize: 10, cellPadding: 3 },
    bodyStyles: { textColor: [30, 30, 30] },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Plan vs. Ist nach Bereich ──────────────────────────────────────────────
  const bereichRows = summary.bereichsVergleich ?? [];
  if (bereichRows.length > 0) {
    if (y + 40 > 270) {
      doc.addPage();
      y = 15;
    }

    const byPhase: Record<string, BereichVergleichRow[]> = {};
    for (const row of bereichRows) {
      if (!byPhase[row.phaseType]) byPhase[row.phaseType] = [];
      byPhase[row.phaseType].push(row);
    }

    const GREEN:  [number, number, number] = [22,  163, 74];
    const AMBER:  [number, number, number] = [180, 120,  0];
    const RED:    [number, number, number] = [220,  38, 38];
    const GRAY:   [number, number, number] = [120, 120, 120];

    const tableBody: any[] = [];
    for (const phase of PLAN_PHASE_ORDER.filter((p) => byPhase[p])) {
      const phaseRows = byPhase[phase];
      // Phasenkopf
      tableBody.push([{
        content: PLAN_PHASE_NAMES[phase],
        colSpan: 6,
        styles: { fillColor: [50, 75, 110] as [number,number,number], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      }]);

      for (const row of phaseRows) {
        const planAnzeige = row.plan !== null ? row.plan : row.ist;
        const istAnzeige  = row.plan !== null ? row.ist  : null;
        const pct = row.deltaPercent;
        const deltaColor: [number, number, number] = pct === null ? GRAY : Math.abs(pct) <= 2 ? GREEN : Math.abs(pct) < 5 ? AMBER : RED;

        tableBody.push([
          '',
          { content: row.bereich ?? 'Ohne Bereich', styles: { textColor: [50, 50, 50] as [number,number,number] } },
          { content: eur(planAnzeige), styles: { halign: 'right' } },
          { content: istAnzeige !== null ? eur(istAnzeige) : '–', styles: { halign: 'right' } },
          { content: row.delta !== null ? eur(row.delta) : '–', styles: { halign: 'right', textColor: deltaColor } },
          {
            content: pct !== null ? `${pct > 0 ? '+' : ''}${pct.toLocaleString('de-DE', { minimumFractionDigits: 1 })} %` : '–',
            styles: { halign: 'right', textColor: deltaColor },
          },
        ]);
      }

      // Phasengesamt
      const subIst  = phaseRows.reduce((s, r) => s + r.ist, 0);
      const subPlan = phaseRows.every((r) => r.plan !== null)
        ? phaseRows.reduce((s, r) => s + (r.plan ?? 0), 0)
        : null;
      const subDelta = subPlan !== null ? subIst - subPlan : null;
      const subPct   = subPlan !== null && subPlan !== 0 ? +((subDelta! / subPlan) * 100).toFixed(1) : null;
      const subPlanAnzeige = subPlan !== null ? subPlan : subIst;
      const subIstAnzeige  = subPlan !== null ? subIst  : null;
      const subColor: [number, number, number] = subPct === null ? GRAY : Math.abs(subPct) <= 2 ? GREEN : Math.abs(subPct) < 5 ? AMBER : RED;

      tableBody.push([
        { content: 'Gesamt', styles: { fontStyle: 'bold', textColor: [80, 80, 80] as [number,number,number], fontSize: 7, fillColor: [242, 244, 248] as [number,number,number] } },
        { content: PLAN_PHASE_NAMES[phase], styles: { fontStyle: 'bold', fillColor: [242, 244, 248] as [number,number,number] } },
        { content: eur(subPlanAnzeige), styles: { halign: 'right', fontStyle: 'bold', fillColor: [242, 244, 248] as [number,number,number] } },
        { content: subIstAnzeige !== null ? eur(subIstAnzeige) : '–', styles: { halign: 'right', fontStyle: 'bold', fillColor: [242, 244, 248] as [number,number,number] } },
        { content: subDelta !== null ? eur(subDelta) : '–', styles: { halign: 'right', fontStyle: 'bold', textColor: subColor, fillColor: [242, 244, 248] as [number,number,number] } },
        { content: subPct !== null ? `${subPct > 0 ? '+' : ''}${subPct.toLocaleString('de-DE', { minimumFractionDigits: 1 })} %` : '–', styles: { halign: 'right', fontStyle: 'bold', textColor: subColor, fillColor: [242, 244, 248] as [number,number,number] } },
      ]);
    }

    const colWidths = [colW * 0.07, colW * 0.28, colW * 0.17, colW * 0.17, colW * 0.17, colW * 0.14];
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      tableWidth: colW,
      head: [[
        { content: 'Phase', styles: { halign: 'left', fillColor: DARK_BLUE, textColor: 255, fontStyle: 'bold', fontSize: 9 } },
        { content: 'Bereich', styles: { halign: 'left', fillColor: DARK_BLUE, textColor: 255, fontStyle: 'bold', fontSize: 9 } },
        { content: 'Plan (€)', styles: { halign: 'right', fillColor: DARK_BLUE, textColor: 255, fontStyle: 'bold', fontSize: 9 } },
        { content: 'Ist (€)', styles: { halign: 'right', fillColor: DARK_BLUE, textColor: 255, fontStyle: 'bold', fontSize: 9 } },
        { content: 'Abw. (€)', styles: { halign: 'right', fillColor: DARK_BLUE, textColor: 255, fontStyle: 'bold', fontSize: 9 } },
        { content: 'Abw. (%)', styles: { halign: 'right', fillColor: DARK_BLUE, textColor: 255, fontStyle: 'bold', fontSize: 9 } },
      ]],
      body: tableBody,
      columnStyles: {
        0: { cellWidth: colWidths[0] },
        1: { cellWidth: colWidths[1] },
        2: { cellWidth: colWidths[2], halign: 'right' },
        3: { cellWidth: colWidths[3], halign: 'right' },
        4: { cellWidth: colWidths[4], halign: 'right' },
        5: { cellWidth: colWidths[5], halign: 'right' },
      },
      styles: { fontSize: 8, cellPadding: 2 },
      bodyStyles: { textColor: [30, 30, 30] },
      alternateRowStyles: {},
      didDrawPage: (data) => {
        // Sektionsüberschrift auf Folgeseiten
        if (data.pageNumber > 1) {
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text('Plan vs. Ist nach Bereich (Fortsetzung)', margin, 10);
          doc.setTextColor(0, 0, 0);
        }
      },
    });
  }

  // ── Fußzeile ──────────────────────────────────────────────────────────────
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `${project.projectNumber}  ·  ${project.name}  ·  Seite ${i} / ${pageCount}`,
      margin,
      doc.internal.pageSize.getHeight() - 7,
    );
    doc.text(now, pageW - margin, doc.internal.pageSize.getHeight() - 7, { align: 'right' });
  }

  doc.save(`Kostenkalkulation_${project.projectNumber}_${project.name.replace(/\s+/g, '_')}.pdf`);
}

// ─── Excel-Download (modern styled via ExcelJS) ────────────────────────────────

const XLSX_PHASE_COLORS: Record<string, string> = {
  demolition:          'C0392B',
  renovation:          '2563EB',
  specialConstruction: '16A34A',
  baunebenkosten:      '7C3AED',
  planungskosten:      '0891B2',
  ausstellung:         'D97706',
  vertrieb:            '0F766E',
};

// ─── GIK (2) helpers (adapted from provided code) ────────────────────────────

type GIKUnit = { type: 'WE' | 'DG'; weCode?: string; title: string; rooms: { name: string; area: number | null }[] };

function gikWeSorter(a: string, b: string) {
  const norm = (s: string) => s.replace(/^WE\s*/i, '');
  const pa = norm(a).match(/^(\d+)([A-Za-z]*)$/);
  const pb = norm(b).match(/^(\d+)([A-Za-z]*)$/);
  if (pa && pb) {
    const na = parseInt(pa[1], 10), nb = parseInt(pb[1], 10);
    if (na !== nb) return na - nb;
    return (pa[2] || '').localeCompare(pb[2] || '', 'de', { sensitivity: 'base' });
  }
  return a.localeCompare(b, 'de', { sensitivity: 'base' });
}

function buildGIKUnits(units: import('../types').Unit[], rooms: import('../types').Room[]): GIKUnit[] {
  const result: GIKUnit[] = [];
  for (const u of units) {
    const name  = u.name ?? '';
    const num   = u.number ?? '';
    const weM   = (num + ' ' + name).toUpperCase().match(/\b(WE\d+[A-Z]?)\b/);
    const isDG  = /(^|\s)(dachgeschoss|dachgeschoß|dg)(\s|$)/i.test(name) || /(^|\s)(dachgeschoss|dachgeschoß|dg)(\s|$)/i.test(num);

    const unitRooms = rooms.filter(r => {
      if (!r.unitId) return false;
      const uid = typeof r.unitId === 'string' ? r.unitId : (r.unitId as import('../types').Unit)._id;
      return uid === u._id;
    }).map(r => ({ name: r.name, area: r.dimensions?.area ?? null }));

    if (weM) {
      result.push({ type: isDG ? 'DG' : 'WE', weCode: weM[1], title: name, rooms: unitRooms });
    } else if (isDG) {
      result.push({ type: 'DG', title: 'Dachgeschoss', rooms: unitRooms });
    }
  }
  return result;
}

function addGIKSheet(wb: ExcelJSType.Workbook, units: import('../types').Unit[], rooms: import('../types').Room[], stellplaetze: number) {
  const ws = wb.addWorksheet('GIK (2)', {
    properties: { defaultColWidth: 12 },
    pageSetup: { paperSize: 9, orientation: 'portrait' as const },
  });

  const HEADER_BG = 'FFEFEFEF';
  const BORDER_C  = 'FFBFBFBF';
  const HAIR_C    = 'FFDDDDDD';

  function sectionHeader(row: ExcelJSType.Row, label: string) {
    row.height = 20;
    const c = row.getCell(1);
    c.value = label;
    c.font  = { bold: true, size: 11 };
  }
  function colHeader(row: ExcelJSType.Row, cols: string[]) {
    row.height = 18;
    cols.forEach((txt, i) => {
      const c = row.getCell(i + 1);
      c.value = txt;
      c.font  = { bold: true, size: 9 };
      c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
      c.alignment = { vertical: 'middle', horizontal: 'left' };
      c.border = { top: { style: 'thin', color: { argb: BORDER_C } }, bottom: { style: 'thin', color: { argb: BORDER_C } }, left: { style: 'thin', color: { argb: BORDER_C } }, right: { style: 'thin', color: { argb: BORDER_C } } };
    });
  }
  function dataRow(row: ExcelJSType.Row, vals: (string | number | null)[]) {
    row.height = 16;
    vals.forEach((v, i) => {
      const c = row.getCell(i + 1);
      c.value = v as ExcelJSType.CellValue;
      c.font  = { size: 9 };
      c.border = { bottom: { style: 'hair', color: { argb: HAIR_C } } };
      if (i === 2 && typeof v === 'number') { c.numFmt = '0,00 "m²"'; }
      if (i === 4 || i === 5 || i === 3) { c.numFmt = '#,##0.00 "€"'; }
    });
  }

  ws.columns = [
    { width: 15 }, { width: 28 }, { width: 36 }, { width: 10 }, { width: 14 }, { width: 16 },
  ];

  // ── WE + DG section ──────────────────────────────────────────────────────
  ws.addRow([]).height = 6;
  sectionHeader(ws.addRow([]), 'Erlöse WE + GE');
  colHeader(ws.addRow([]), ['WE Nr.', 'WE Bezeichnung', 'Fläche in m² (Boden)', 'Zimmer', '€/m²', 'Erlös pro WE in €']);

  const gikUnits = buildGIKUnits(units, rooms);
  const wes = gikUnits.filter(u => u.type === 'WE').sort((a, b) => gikWeSorter(a.weCode ?? '', b.weCode ?? ''));
  const dgs = gikUnits.filter(u => u.type === 'DG');

  for (const u of wes) {
    const totalArea = +u.rooms.reduce((s, r) => s + (r.area ?? 0), 0).toFixed(2);
    dataRow(ws.addRow([]), [u.weCode ?? 'WE', u.title, totalArea, u.rooms.length, null, null]);
  }
  for (const u of dgs) {
    const totalArea = +u.rooms.reduce((s, r) => s + (r.area ?? 0), 0).toFixed(2);
    dataRow(ws.addRow([]), ['Dachgeschoss', 'Dachgeschoss', totalArea, u.rooms.length, null, null]);
  }

  // ── Stellplätze section ───────────────────────────────────────────────────
  ws.addRow([]).height = 8;
  sectionHeader(ws.addRow([]), 'Erlöse Stellplätze');
  colHeader(ws.addRow([]), ['Anzahl', 'SP Bezeichnung', '', 'Erlöse (Stück) in €']);

  const spRow = ws.addRow([]);
  spRow.height = 16;
  spRow.getCell(1).value  = stellplaetze;
  spRow.getCell(2).value  = 'Stellplätze';
  spRow.getCell(4).value  = null;
  spRow.getCell(4).numFmt = '#,##0.00 "€"';
  [1, 2, 3, 4].forEach(i => {
    spRow.getCell(i).font   = { size: 9 };
    spRow.getCell(i).border = { bottom: { style: 'hair', color: { argb: HAIR_C } } };
  });
}

// ─── GIK (1) – Gesamtinvestitionskosten ────────────────────────────────────────
function addGIK1Sheet(
  wb: ExcelJSType.Workbook,
  project: Project,
  summary: ProjectSummary,
  allUnits: import('../types').Unit[],
  allRooms: import('../types').Room[],
  financeSummary: FinanceSummary | null,
) {
  const ws = wb.addWorksheet('GIK (1)', {
    properties: { defaultColWidth: 16 },
    pageSetup: { paperSize: 9, orientation: 'landscape' as const },
  });

  ws.columns = [
    { width: 10 },  // A: pos# / WE Nr. / Anzahl
    { width: 35 },  // B: label / WE Bezeichnung
    { width: 18 },  // C: value / Kosten brutto / Fläche m²
    { width: 14 },  // D: €/m² Wfl. / Zimmer
    { width: 14 },  // E: €/m² Erlöse
    { width: 18 },  // F: Erlös WE / Erlös gesamt
    { width: 55 },  // G: notes (Kennzahlen section)
  ];

  const DARK_BG   = 'FF1E3A5F';
  const LIGHT_ROW = 'FFF0F4FA';
  const NOTE_C    = 'FF888888';
  const INPUT_BG  = 'FFFFF9C4';
  const BORDER_C  = 'FFBFBFBF';
  const HAIR_C    = 'FFDDDDDD';
  const EUR_FMT   = '#,##0.00 "€"';

  function fillDark(cell: ExcelJSType.Cell, bold = false, size = 9) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } };
    cell.font = { bold, size, color: { argb: 'FFFFFFFF' } };
  }

  function formatMonthYear(d: string | null | undefined): string {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
  }

  // ── Computed values ─────────────────────────────────────────────────────────
  const wohnflaeche   = +allRooms.reduce((s, r) => s + (r.dimensions?.area ?? 0), 0).toFixed(2);
  const phaseByType   = (type: string) => project.phases.find(p => p.type === type);
  const perM2         = (cost: number | null): number | null =>
    cost !== null && wohnflaeche > 0 ? +(cost / wohnflaeche).toFixed(2) : null;

  const demolitionCost  = summary.phases.demolition?.subtotal          ?? 0;
  const renovationCost  = summary.phases.renovation?.subtotal          ?? 0;
  const specialCost     = summary.phases.specialConstruction?.subtotal  ?? 0;
  const ausstattungCost = summary.phases.ausstellung?.subtotal          ?? 0;
  const planungCost     = summary.phases.planungskosten?.subtotal       ?? 0;
  const baunebenCost    = summary.phases.baunebenkosten?.subtotal       ?? 0;
  const vertriebCost    = summary.phases.vertrieb?.subtotal             ?? 0;
  const finanzCost: number | null      = financeSummary?.totalInterest    ?? null;
  const grundstueckCost: number | null = financeSummary?.totalAcquisition ?? null;

  // Vertrieb prices from project data
  const vPrices: Record<string, { preisQm: string; festpreis: string }> = project.vertriebPreise ?? {};

  function parseGerman(s: string): number | null {
    if (!s?.trim()) return null;
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  // ── SECTION A: Gebäudekennzahlen ─────────────────────────────────────────
  ws.addRow([]).height = 4;
  ws.addRow([]).height = 4;
  ws.addRow([]).height = 4;

  const kRows: Array<{ label: string; value: number | string | null; note: string; manual?: boolean }> = [
    { label: 'Grundstück',                       value: project.grundstueckFlaeche ?? null,      note: 'Manuell eintragen oder aus "Gebäudekennzahlen" "Grundstück" xxxx m² hinzufügen' },
    { label: 'GRZ (Grundflächenzahl)',            value: null,                                    note: 'bei Gebäudekennzahlen eintragen (OPTIONAL)', manual: true },
    { label: 'BGF o.i. (Bruttogeschossfläche)',   value: null,                                    note: 'Manuell eintragen', manual: true },
    { label: 'Wohnfläche (Nutzfläche)',           value: wohnflaeche > 0 ? wohnflaeche : null,   note: 'Summe Fläche Wohnungen + Gewerbe' },
    { label: 'Wohneinheiten',                     value: project.anzahlWohnungen    ?? 0,         note: 'Siehe "Gebäudekennzahlen"' },
    { label: 'Gewerbeeinheiten',                  value: project.anzahlGewerbe      ?? 0,         note: 'Siehe "Gebäudekennzahlen"' },
    { label: 'PKW Stellplätze',                   value: project.anzahlStellplaetze ?? 0,         note: 'Siehe "Gebäudekennzahlen"' },
    { label: '(Außenanlage)',                     value: null,                                    note: 'Grundstücksfläche minus Grundstücksfläche * GRZ', manual: true },
  ];

  for (const k of kRows) {
    const row = ws.addRow([]); row.height = 18;
    row.getCell(2).value     = k.label;
    row.getCell(2).font      = { size: 9 };
    row.getCell(2).alignment = { vertical: 'middle' };
    row.getCell(3).value     = k.value;
    row.getCell(3).font      = { size: 9, bold: k.value !== null && !k.manual } as ExcelJSType.Font;
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
    if (k.manual) {
      row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_BG } };
    }
    if (k.value === null) {
      row.getCell(7).value     = k.note;
      row.getCell(7).font      = { size: 8, italic: true, color: { argb: NOTE_C } };
      row.getCell(7).alignment = { vertical: 'middle' };
    }
  }

  ws.addRow([]).height = 6;

  // Timeline dates
  const demoPhase = phaseByType('demolition');
  const renoPhase = phaseByType('renovation');
  const dateRows = [
    { label: 'Closing',            d: formatMonthYear(project.timeline?.plannedStart) },
    { label: 'Beginn Abbruch',     d: formatMonthYear(demoPhase?.timeline?.plannedStart) },
    { label: 'Beginn Innenausbau', d: formatMonthYear(renoPhase?.timeline?.plannedStart) },
    { label: 'Fertigstellung',     d: formatMonthYear(project.timeline?.plannedEnd) },
  ];
  for (const dr of dateRows) {
    const row = ws.addRow([]); row.height = 16;
    row.getCell(2).value     = dr.label;
    row.getCell(2).font      = { size: 9 };
    row.getCell(2).alignment = { vertical: 'middle' };
    row.getCell(3).value     = dr.d || null;
    row.getCell(3).font      = { size: 9 };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };
    if (!dr.d) row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_BG } };
  }

  ws.addRow([]).height = 10;
  ws.addRow([]).height = 10;

  // ── SECTION B: Gesamtinvestitionskosten ──────────────────────────────────
  const hRow = ws.addRow([]); hRow.height = 22;
  fillDark(hRow.getCell(1));
  fillDark(hRow.getCell(2), true, 10);
  fillDark(hRow.getCell(3), true, 9);
  fillDark(hRow.getCell(4), true, 9);
  hRow.getCell(2).value     = 'Gesamtinvestitionskosten';
  hRow.getCell(2).alignment = { vertical: 'middle', indent: 1 };
  hRow.getCell(3).value     = 'Kosten brutto';
  hRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
  hRow.getCell(4).value     = '€/m² Wfl.';
  hRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

  const positions: Array<{ nr: number; label: string; note: string; cost: number | null; manual?: boolean }> = [
    { nr: 1, label: 'Grundstück',                                         note: 'Manuell eintragen oder aus "Gebäudekennzahlen" "Grundstück" xxxx m² hinzufügen',   cost: grundstueckCost, manual: grundstueckCost === null },
    { nr: 2, label: 'Abriss / vorbereitende Maßnahmen',                   note: 'Gleich den Kostenpositionen Entkernung',                                           cost: demolitionCost },
    { nr: 3, label: 'Baukosten [Renovierung + Sonderarbeiten] [Auск.]',   note: 'Summe Renovierung + Sonderarbeiten aus der Kostenkalkulation',                     cost: renovationCost + specialCost },
    { nr: 4, label: 'Ausstattung',                                        note: 'pauschale Positionen hinzufügen (z.B. Einbauküche, Badezimmerschränke)',           cost: ausstattungCost },
    { nr: 5, label: 'Planung',                                            note: 'pauschale Positionen hinzufügen (z.B. Architekten, Vermesser, etc.)',              cost: planungCost },
    { nr: 6, label: 'Baunebenkosten',                                     note: 'pauschale Positionen hinzufügen (z.B. Versicherung, Strom, Sicherheit..., etc.)', cost: baunebenCost },
    { nr: 7, label: 'Finanzierung',                                       note: 'wie in Kalkulation (Zinsen)',                                                      cost: finanzCost,     manual: finanzCost === null },
    { nr: 8, label: 'Vertrieb',                                           note: 'pauschale Positionen hinzufügen (z.B. Makler, Vertriebstools, Fee Mitarbeiter)',   cost: vertriebCost },
  ];

  for (const pos of positions) {
    const row = ws.addRow([]); row.height = 20;
    row.getCell(1).value     = pos.nr;
    row.getCell(1).font      = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    row.getCell(1).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } };
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(2).value     = pos.label;
    row.getCell(2).font      = { bold: true, size: 9 };
    row.getCell(2).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_ROW } };
    row.getCell(2).alignment = { vertical: 'middle', indent: 1 };

    row.getCell(3).value     = pos.cost;
    row.getCell(3).numFmt    = EUR_FMT;
    row.getCell(3).font      = { bold: true, size: 9 };
    row.getCell(3).fill      = pos.manual
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_BG } }
      : { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_ROW } };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };

    row.getCell(4).value     = perM2(pos.cost);
    row.getCell(4).numFmt    = EUR_FMT;
    row.getCell(4).font      = { size: 9 };
    row.getCell(4).fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_ROW } };
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

    if (pos.manual) {
      const noteRow = ws.addRow([]); noteRow.height = 14;
      noteRow.getCell(2).value     = pos.note;
      noteRow.getCell(2).font      = { size: 8, italic: true, color: { argb: NOTE_C } };
      noteRow.getCell(2).alignment = { vertical: 'middle', indent: 2 };
    }
  }

  // Total row
  const knownTotal = positions.filter(p => p.cost !== null).reduce((s, p) => s + (p.cost ?? 0), 0);
  const tRow = ws.addRow([]); tRow.height = 24;
  fillDark(tRow.getCell(1));
  fillDark(tRow.getCell(2), true, 10);
  fillDark(tRow.getCell(3), true, 10);
  fillDark(tRow.getCell(4), true, 10);
  tRow.getCell(2).value     = 'Gesamtinvestitionskosten';
  tRow.getCell(2).alignment = { vertical: 'middle', indent: 1 };
  tRow.getCell(3).value     = knownTotal || null;
  tRow.getCell(3).numFmt    = EUR_FMT;
  tRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' };
  tRow.getCell(4).value     = perM2(knownTotal || null);
  tRow.getCell(4).numFmt    = EUR_FMT;
  tRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'right' };

  // ── SECTION C: Erlöse WE + GE ────────────────────────────────────────────
  ws.addRow([]).height = 14;
  ws.addRow([]).height = 4;

  const erlSH = ws.addRow([]); erlSH.height = 22;
  erlSH.getCell(1).value     = 'Erlöse WE + GE';
  erlSH.getCell(1).font      = { bold: true, size: 11 };
  erlSH.getCell(1).alignment = { vertical: 'middle' };
  ws.mergeCells(erlSH.number, 1, erlSH.number, 6);

  ws.addRow([]).height = 4;

  const erlColH = ['WE Nr.', 'WE Bezeichnung', 'Fläche in m² aus "Gebäude & Räume"', 'Zimmer', '€/m²', 'Erlös WE'];
  const erlHRow = ws.addRow([]); erlHRow.height = 20;
  erlColH.forEach((txt, i) => {
    const c = erlHRow.getCell(i + 1);
    c.value     = txt;
    c.font      = { bold: true, size: 9 };
    c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    c.alignment = { vertical: 'middle', horizontal: i >= 2 ? 'right' : 'left' };
    c.border    = { bottom: { style: 'thin', color: { argb: BORDER_C } } };
  });

  // Build sorted WE/DG list (reuses helpers from GIK (2) section)
  const gikList   = buildGIKUnits(allUnits, allRooms);
  const sortedWEs = gikList.filter(u => u.type === 'WE').sort((a, b) => gikWeSorter(a.weCode ?? '', b.weCode ?? ''));
  const sortedDGs = gikList.filter(u => u.type === 'DG');

  let totalErlArea  = 0;
  let totalErloes   = 0;

  for (const giku of [...sortedWEs, ...sortedDGs]) {
    const priceKey  = giku.weCode ?? 'Dachgeschoss';
    const p         = vPrices[priceKey] ?? { preisQm: '', festpreis: '' };
    const preisQm   = parseGerman(p.preisQm);
    const festpreis = parseGerman(p.festpreis);
    const unitArea  = +giku.rooms.reduce((s, r) => s + (r.area ?? 0), 0).toFixed(2);
    const erloes    = festpreis ?? (preisQm !== null && unitArea > 0 ? +(preisQm * unitArea).toFixed(2) : null);
    const zimmer    = giku.rooms.length;

    totalErlArea  += unitArea;
    totalErloes   += erloes ?? 0;

    const row = ws.addRow([]); row.height = 16;
    row.getCell(1).value  = giku.type === 'DG' ? 'Dachgeschoss' : (giku.weCode ?? '');
    row.getCell(2).value  = giku.title;
    row.getCell(3).value  = unitArea || null;
    row.getCell(3).numFmt = '#,##0.00 "m²"';
    row.getCell(4).value  = zimmer || null;
    row.getCell(5).value  = preisQm;
    row.getCell(5).numFmt = EUR_FMT;
    if (preisQm === null && !festpreis) {
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_BG } };
    }
    row.getCell(6).value  = erloes;
    row.getCell(6).numFmt = EUR_FMT;
    if (erloes === null) {
      row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_BG } };
    }
    [1, 2, 3, 4, 5, 6].forEach(i => {
      row.getCell(i).font   = { size: 9 };
      row.getCell(i).border = { bottom: { style: 'hair', color: { argb: HAIR_C } } };
    });
  }

  ws.addRow([]).height = 4;

  // Sum row
  const erlSumRow = ws.addRow([]); erlSumRow.height = 20;
  erlSumRow.getCell(3).value  = +totalErlArea.toFixed(2);
  erlSumRow.getCell(3).numFmt = '#,##0.00 "m²"';
  erlSumRow.getCell(3).font   = { bold: true, size: 9 };
  erlSumRow.getCell(6).value  = totalErloes > 0 ? +totalErloes.toFixed(2) : null;
  erlSumRow.getCell(6).numFmt = EUR_FMT;
  erlSumRow.getCell(6).font   = { bold: true, size: 9 };
  [1, 2, 3, 4, 5, 6].forEach(i => {
    erlSumRow.getCell(i).border = { top: { style: 'thin', color: { argb: BORDER_C } } };
  });

  // ── Stellplätze ───────────────────────────────────────────────────────────
  ws.addRow([]).height = 10;
  const spSH = ws.addRow([]); spSH.height = 22;
  spSH.getCell(1).value     = 'Erlöse Stellplätze';
  spSH.getCell(1).font      = { bold: true, size: 11 };
  spSH.getCell(1).alignment = { vertical: 'middle' };
  ws.mergeCells(spSH.number, 1, spSH.number, 6);

  ws.addRow([]).height = 4;

  const spHRow2 = ws.addRow([]); spHRow2.height = 20;
  ['Anzahl', 'SP Bezeichnung', '', '€ / Stück', '', 'Erlöse gesamt'].forEach((txt, i) => {
    const c = spHRow2.getCell(i + 1);
    c.value     = txt;
    c.font      = { bold: true, size: 9 };
    c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    c.alignment = { vertical: 'middle', horizontal: i >= 2 ? 'right' : 'left' };
    c.border    = { bottom: { style: 'thin', color: { argb: BORDER_C } } };
  });

  const spAnzahl    = project.anzahlStellplaetze ?? 0;
  const spRaw       = vPrices['Stellplätze'] ?? { preisQm: '', festpreis: '' };
  const spPerStueck = parseGerman(spRaw.festpreis); // per-piece price
  const spTotal     = spPerStueck !== null && spAnzahl > 0 ? +(spPerStueck * spAnzahl).toFixed(2) : null;

  const spRow2 = ws.addRow([]); spRow2.height = 18;
  spRow2.getCell(1).value  = spAnzahl;
  spRow2.getCell(2).value  = 'Stellplätze';
  spRow2.getCell(4).value  = spPerStueck;
  spRow2.getCell(4).numFmt = EUR_FMT;
  if (spPerStueck === null) spRow2.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_BG } };
  spRow2.getCell(6).value  = spTotal;
  spRow2.getCell(6).numFmt = EUR_FMT;
  if (spTotal === null) spRow2.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT_BG } };
  [1, 2, 3, 4, 5, 6].forEach(i => {
    spRow2.getCell(i).font   = { size: 9 };
    spRow2.getCell(i).border = { bottom: { style: 'hair', color: { argb: HAIR_C } } };
  });
}

// ─── Excel-Download (modern styled via ExcelJS) ────────────────────────────────
async function downloadExcel(project: Project, summary: ProjectSummary, allUnits: import('../types').Unit[], allRooms: import('../types').Room[], financeSummary: FinanceSummary | null) {
  // Dynamic import so bundle stays small when not needed
  const ExcelJS = ((await import('exceljs')) as unknown as { default: typeof ExcelJSType }).default;
  const now = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sanierungssoftware';
  wb.created = new Date();

  // ─── Colour palette ─────────────────────────────────────────────────────
  const DARK_BG  = 'FF1E3A5F';
  const ALT_ROW  = 'FFF8FAFC';
  const TOTAL_BG = 'FFE8F0FA';
  const MOD_BG   = 'FF4C1D95';
  const EUR_FMT  = '#,##0.00 "€"';
  const H_FMT    = '#,##0.0';

  // ─── Style helpers ───────────────────────────────────────────────────────
  type ECell = ExcelJSType.Cell;

  function titleCell(cell: ECell, text: string, size: number, sub = false) {
    cell.value = text;
    cell.style = {
      font: { bold: !sub, size, color: { argb: sub ? 'FFB0C4DE' : 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } },
      alignment: { vertical: 'middle', horizontal: 'left', indent: 1 },
    };
  }

  function headerCell(cell: ECell, text: string, align: 'left' | 'right' | 'center' = 'left', bg = DARK_BG) {
    cell.value = text;
    cell.style = {
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } },
      alignment: { vertical: 'middle', horizontal: align, indent: align === 'left' ? 1 : 0 },
      border: { bottom: { style: 'thin', color: { argb: 'FF1E3A5F' } } },
    };
  }

  function dataCell(cell: ECell, value: string | number | null, alt: boolean, align: 'left' | 'right' = 'right', fmt?: string, bold = false, colorArgb?: string) {
    cell.value = value as ExcelJSType.CellValue;
    const style: Partial<ExcelJSType.Style> = {
      font: { size: 9, bold, color: colorArgb ? { argb: colorArgb } : undefined },
      fill: alt
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW } }
        : { type: 'pattern', pattern: 'none' },
      alignment: { horizontal: align, vertical: 'middle', indent: align === 'left' ? 1 : 0 },
      border: { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } },
    };
    if (fmt) style.numFmt = fmt;
    cell.style = style;
  }

  function totalCell(cell: ECell, value: string | number | null, fmt?: string, size = 9) {
    cell.value = value as ExcelJSType.CellValue;
    cell.style = {
      font: { bold: true, size, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } },
      alignment: { horizontal: typeof value === 'number' ? 'right' : 'left', vertical: 'middle', indent: typeof value === 'string' ? 1 : 0 },
      numFmt: fmt,
    };
  }

  function subtotalCell(cell: ECell, value: string | number | null, fmt?: string) {
    cell.value = value as ExcelJSType.CellValue;
    cell.style = {
      font: { bold: true, size: 9 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_BG } },
      alignment: { horizontal: typeof value === 'number' ? 'right' : 'left', vertical: 'middle', indent: typeof value === 'string' ? 1 : 0 },
      border: { top: { style: 'thin', color: { argb: 'FFCBD5E1' } }, bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } },
      numFmt: fmt,
    };
  }

  // ─── SHEET 1: Übersicht ──────────────────────────────────────────────────
  const wsO = wb.addWorksheet('Übersicht');
  wsO.columns = [
    { width: 28 }, { width: 20 }, { width: 22 }, { width: 18 }, { width: 18 }, { width: 15 }, { width: 12 },
  ];

  // Title rows
  const r1 = wsO.addRow(['']); r1.height = 30;
  titleCell(r1.getCell(1), 'Kostenkalkulation', 15);
  wsO.mergeCells(r1.number, 1, r1.number, 7);
  // fill remaining merged cells
  for (let c = 2; c <= 7; c++) r1.getCell(c).style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } } };

  const r2 = wsO.addRow(['']); r2.height = 20;
  titleCell(r2.getCell(1), project.name, 11);
  wsO.mergeCells(r2.number, 1, r2.number, 7);
  for (let c = 2; c <= 7; c++) r2.getCell(c).style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } } };

  const r3 = wsO.addRow(['']); r3.height = 16;
  titleCell(r3.getCell(1), `${project.projectNumber}  ·  ${project.address.street}, ${project.address.zipCode} ${project.address.city}  ·  Erstellt am ${now}`, 8, true);
  wsO.mergeCells(r3.number, 1, r3.number, 7);
  for (let c = 2; c <= 7; c++) r3.getCell(c).style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } } };

  wsO.addRow([]).height = 6; // thin spacer

  // Column headers
  const rH = wsO.addRow([]); rH.height = 22;
  const colLabels = ['Phase', 'Materialkosten (€)', 'Entsorgungskosten (€)', 'Arbeitskosten (€)', 'Phasensumme (€)', 'Arbeitsstunden', 'Positionen'];
  const colAligns: Array<'left' | 'right'> = ['left', 'right', 'right', 'right', 'right', 'right', 'right'];
  colLabels.forEach((lbl, i) => headerCell(rH.getCell(i + 1), lbl, colAligns[i]));
  wsO.views = [{ state: 'frozen', ySplit: rH.number }];

  // Phase rows
  let altIdx = 0;
  for (const phase of PHASE_ORDER) {
    const d = summary.phases[phase];
    if (!d) continue;
    const alt = altIdx++ % 2 === 1;
    const row = wsO.addRow([]); row.height = 18;
    const phCol = `FF${XLSX_PHASE_COLORS[phase] ?? '64748B'}`;
    // Phase name with colored dot indicator
    const nameCell = row.getCell(1);
    nameCell.value = `● ${PHASE_NAMES[phase]}`;
    nameCell.style = {
      font: { size: 9, bold: true, color: { argb: phCol } },
      fill: alt ? { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW } } : { type: 'pattern', pattern: 'none' },
      alignment: { vertical: 'middle', indent: 1 },
      border: { bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } } },
    };
    dataCell(row.getCell(2), d.materialCost,  alt, 'right', EUR_FMT);
    dataCell(row.getCell(3), d.disposalCost,  alt, 'right', EUR_FMT);
    dataCell(row.getCell(4), d.laborCost,     alt, 'right', EUR_FMT);
    dataCell(row.getCell(5), d.subtotal,      alt, 'right', EUR_FMT, true);
    dataCell(row.getCell(6), parseFloat(d.totalHours.toFixed(1)), alt, 'right', H_FMT);
    dataCell(row.getCell(7), d.positionCount, alt, 'right', '0');
  }

  // Module section
  const moduleKeys = ['baunebenkosten', 'planungskosten', 'ausstellung', 'vertrieb'] as const;
  const hasModuleData = moduleKeys.some((m) => (summary.phases[m]?.subtotal ?? 0) > 0);
  if (hasModuleData) {
    wsO.addRow([]).height = 6;
    const mH = wsO.addRow([]); mH.height = 20;
    mH.getCell(1).value = 'Weitere Kosten';
    mH.getCell(1).style = {
      font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: MOD_BG } },
      alignment: { vertical: 'middle', indent: 1 },
    };
    wsO.mergeCells(mH.number, 1, mH.number, 7);
    for (let c = 2; c <= 7; c++) mH.getCell(c).style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: MOD_BG } } };

    for (const m of moduleKeys) {
      const d = summary.phases[m];
      if (!d || d.subtotal === 0) continue;
      const row = wsO.addRow([]); row.height = 18;
      dataCell(row.getCell(1), PHASE_NAMES[m], false, 'left');
      row.getCell(1).style.font = { size: 9, color: { argb: `FF${XLSX_PHASE_COLORS[m]}` } };
      // fill blanks 2-4, 6-7
      [2,3,4,6,7].forEach(c => dataCell(row.getCell(c), null, false, 'right'));
      dataCell(row.getCell(5), d.subtotal, false, 'right', EUR_FMT, true);
      dataCell(row.getCell(7), d.positionCount, false, 'right', '0');
    }
  }

  // Grand total
  wsO.addRow([]).height = 6;
  const t = summary.totals;
  const rT = wsO.addRow([]); rT.height = 26;
  totalCell(rT.getCell(1), 'GESAMTSUMME', undefined, 11);
  totalCell(rT.getCell(2), t.materialCost, EUR_FMT);
  totalCell(rT.getCell(3), t.disposalCost, EUR_FMT);
  totalCell(rT.getCell(4), t.laborCost,    EUR_FMT);
  totalCell(rT.getCell(5), t.grandTotal,   EUR_FMT, 12);
  totalCell(rT.getCell(6), parseFloat(t.totalHours.toFixed(0)), H_FMT);
  totalCell(rT.getCell(7), null);

  // ─── SHEET per phase ─────────────────────────────────────────────────────
  for (const phase of PHASE_ORDER) {
    const d = summary.phases[phase];
    if (!d) continue;
    const phColor = `FF${XLSX_PHASE_COLORS[phase] ?? '1E3A5F'}`;
    const ws = wb.addWorksheet(PHASE_NAMES[phase]);
    ws.columns = [{ width: 28 }, { width: 20 }];

    // Title
    const pt = ws.addRow([]); pt.height = 26;
    pt.getCell(1).value = PHASE_NAMES[phase];
    pt.getCell(1).style = {
      font: { bold: true, size: 13, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: phColor } },
      alignment: { vertical: 'middle', indent: 1 },
    };
    ws.mergeCells(pt.number, 1, pt.number, 2);
    pt.getCell(2).style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: phColor } } };

    ws.addRow([]).height = 6;

    // Header
    const ph = ws.addRow([]); ph.height = 20;
    headerCell(ph.getCell(1), 'Kostenart', 'left', phColor);
    headerCell(ph.getCell(2), 'Betrag (€)', 'right', phColor);

    const costData = [
      ['Materialkosten',    d.materialCost],
      ['Entsorgungskosten', d.disposalCost],
      ['Arbeitskosten',     d.laborCost],
    ] as [string, number][];
    costData.forEach(([label, val], i) => {
      const row = ws.addRow([]); row.height = 18;
      dataCell(row.getCell(1), label, i % 2 === 1, 'left');
      dataCell(row.getCell(2), val,   i % 2 === 1, 'right', EUR_FMT);
    });

    ws.addRow([]).height = 4;
    const rs = ws.addRow([]); rs.height = 22;
    subtotalCell(rs.getCell(1), `Phasensumme ${PHASE_NAMES[phase]}`);
    subtotalCell(rs.getCell(2), d.subtotal, EUR_FMT);

    ws.addRow([]).height = 6;
    const metaRows = [
      ['Arbeitsstunden', parseFloat(d.totalHours.toFixed(1))],
      ['Positionen', d.positionCount],
    ] as [string, number][];
    metaRows.forEach(([label, val]) => {
      const row = ws.addRow([]); row.height = 16;
      row.getCell(1).value = label;
      row.getCell(1).style = { font: { size: 8, color: { argb: 'FF64748B' } }, alignment: { vertical: 'middle', indent: 1 } };
      row.getCell(2).value = val;
      row.getCell(2).style = { font: { size: 8, color: { argb: 'FF64748B' } }, alignment: { horizontal: 'right', vertical: 'middle' }, numFmt: '0.0' };
    });
  }

  // ─── SHEET: Plan vs. Ist ─────────────────────────────────────────────────
  const bereichRows = summary.bereichsVergleich ?? [];
  if (bereichRows.length > 0) {
    const byPhase: Record<string, BereichVergleichRow[]> = {};
    for (const row of bereichRows) {
      if (!byPhase[row.phaseType]) byPhase[row.phaseType] = [];
      byPhase[row.phaseType].push(row);
    }

    const wsPV = wb.addWorksheet('Plan vs. Ist');
    wsPV.columns = [
      { width: 24 }, { width: 30 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 14 },
    ];

    // Title
    const pvT = wsPV.addRow([]); pvT.height = 26;
    pvT.getCell(1).value = 'Plan vs. Ist nach Bereich';
    pvT.getCell(1).style = {
      font: { bold: true, size: 13, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } },
      alignment: { vertical: 'middle', indent: 1 },
    };
    wsPV.mergeCells(pvT.number, 1, pvT.number, 6);
    for (let c = 2; c <= 6; c++) pvT.getCell(c).style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } } };

    wsPV.addRow([]).height = 6;

    // Column headers
    const pvH = wsPV.addRow([]); pvH.height = 22;
    ['Phase', 'Bereich', 'Plan (€)', 'Ist (€)', 'Abweichung (€)', 'Abw. (%)'].forEach((lbl, i) => {
      headerCell(pvH.getCell(i + 1), lbl, i < 2 ? 'left' : 'right');
    });
    wsPV.views = [{ state: 'frozen', ySplit: pvH.number }];

    for (const phase of PLAN_PHASE_ORDER.filter((p) => byPhase[p])) {
      const phRows = byPhase[phase];
      const phColor = `FF${XLSX_PHASE_COLORS[phase] ?? '334155'}`;

      // Phase section header
      const phH = wsPV.addRow([]); phH.height = 20;
      phH.getCell(1).value = PLAN_PHASE_NAMES[phase];
      phH.getCell(1).style = {
        font: { bold: true, size: 9, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: phColor } },
        alignment: { vertical: 'middle', indent: 1 },
      };
      wsPV.mergeCells(phH.number, 1, phH.number, 6);
      for (let c = 2; c <= 6; c++) phH.getCell(c).style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: phColor } } };

      // Data rows
      phRows.forEach((row, i) => {
        const planAnzeige = row.plan !== null ? row.plan : row.ist;
        const istAnzeige  = row.plan !== null ? row.ist  : null;
        const pct = row.deltaPercent;
        const alt = i % 2 === 1;

        let deltaArgb: string | undefined;
        if (pct !== null) {
          deltaArgb = Math.abs(pct) <= 2 ? 'FF16A34A' : Math.abs(pct) < 5 ? 'FFD97706' : 'FFDC2626';
        }

        const dr = wsPV.addRow([]); dr.height = 18;
        dataCell(dr.getCell(1), '',                                  alt, 'left');
        dataCell(dr.getCell(2), row.bereich ?? 'Ohne Bereich',       alt, 'left');
        dataCell(dr.getCell(3), planAnzeige,                         alt, 'right', EUR_FMT);
        dataCell(dr.getCell(4), istAnzeige,                          alt, 'right', EUR_FMT);
        dataCell(dr.getCell(5), row.delta,                           alt, 'right', EUR_FMT, false, deltaArgb);
        dataCell(dr.getCell(6),
          pct !== null ? parseFloat(pct.toFixed(1)) : null,          alt, 'right', '+0.0;-0.0;0.0"%"', false, deltaArgb);
      });

      // Phase subtotal
      const subIst  = phRows.reduce((s, r) => s + r.ist, 0);
      const subPlan = phRows.every((r) => r.plan !== null) ? phRows.reduce((s, r) => s + (r.plan ?? 0), 0) : null;
      const subDelta = subPlan !== null ? subIst - subPlan : null;
      const subPct   = subPlan !== null && subPlan !== 0 ? parseFloat(((subDelta! / subPlan) * 100).toFixed(1)) : null;

      const sr = wsPV.addRow([]); sr.height = 20;
      subtotalCell(sr.getCell(1), 'Gesamt');
      subtotalCell(sr.getCell(2), PLAN_PHASE_NAMES[phase]);
      subtotalCell(sr.getCell(3), subPlan !== null ? subPlan : subIst, EUR_FMT);
      subtotalCell(sr.getCell(4), subPlan !== null ? subIst : null,    EUR_FMT);
      subtotalCell(sr.getCell(5), subDelta,                            EUR_FMT);
      subtotalCell(sr.getCell(6), subPct !== null ? subPct : null,     '+0.0;-0.0;0.0"%"');

      wsPV.addRow([]).height = 4;
    }
  }

  // ─── GIK (1) sheet ───────────────────────────────────────────────────────
  try {
    addGIK1Sheet(wb, project, summary, allUnits, allRooms, financeSummary);
  } catch (e) {
    console.error('[GIK1] Fehler beim Erstellen:', e);
  }

  // ─── GIK (2) sheet ───────────────────────────────────────────────────────
  addGIKSheet(wb, allUnits, allRooms, project.anzahlStellplaetze ?? 0);

  // ─── Write & trigger download ─────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Kostenkalkulation_${project.projectNumber}_${project.name.replace(/\s+/g, '_')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Finanzierungs-KPI-Karte ──────────────────────────────────────────────────

function FinanceKpiBar({ fin, projectId }: { fin: FinanceSummary; projectId: string }) {
  const kpis = [
    { label: 'All-in',        value: eur(fin.totalAllIn),       accent: 'text-blue-700',   bold: true },
    { label: 'Gesamtzinsen',  value: eur(fin.totalInterest),    accent: 'text-orange-600', bold: false },
    { label: 'Peak Debt',     value: eur(fin.peakDebt),         accent: 'text-gray-900',   bold: false },
    { label: 'Ankauf',        value: eur(fin.totalAcquisition), accent: 'text-gray-900',   bold: false },
    { label: 'Projektkosten', value: eur(fin.totalProjectCosts),accent: 'text-gray-900',   bold: false },
    {
      label: 'Ø Zinssatz',
      value: `${fin.averageRate.toFixed(4).replace('.', ',')} %`,
      sub: `${fin.periodsCount} Perioden`,
      accent: 'text-gray-900',
      bold: false,
    },
  ];
  return (
    <div className="card border border-amber-200 bg-amber-50/60 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          </svg>
          <h3 className="font-semibold text-amber-800 text-sm">Finanzierung</h3>
        </div>
        <Link
          to={`/projects/${projectId}/finance`}
          className="text-xs text-amber-700 hover:text-amber-900 font-medium underline underline-offset-2"
        >
          Details →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-amber-100 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{k.label}</p>
            <p className={`text-sm font-${k.bold ? 'bold' : 'semibold'} leading-tight ${k.accent}`}>{k.value}</p>
            {k.sub && <p className="text-[10px] text-gray-400 mt-0.5">{k.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function SummaryPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: project } = useQuery(['project', projectId], () => getProject(projectId!));
  const { data: summary, isLoading } = useQuery(['summary', projectId], () => getProjectSummary(projectId!), { refetchInterval: 10_000 });
  const { data: excelUnits = [] } = useQuery(['units', projectId], () => getUnits(projectId!));
  const { data: excelRooms = [] } = useQuery(['rooms',  projectId], () => getRooms(projectId!));

  const frierenMutation = useMutation(() => frierePlanwerteEin(projectId!), {
    onSuccess: () => {
      queryClient.invalidateQueries(['summary', projectId]);
      queryClient.invalidateQueries(['project', projectId]);
    },
  });

  const loeschenMutation = useMutation(() => loeschePlanwerte(projectId!), {
    onSuccess: () => {
      queryClient.invalidateQueries(['summary', projectId]);
      queryClient.invalidateQueries(['project', projectId]);
    },
  });
  const { data: financeSummary } = useQuery(
    ['financeSummary', projectId],
    () => getFinanceSummary(projectId!),
    { enabled: !!projectId, retry: false }
  );

  // Alle Räume des Projekts laden – für Kosten-pro-m²-Berechnung
  const { data: rooms } = useQuery(
    ['rooms', projectId],
    () => getRooms(projectId!),
    { refetchInterval: 10_000 }
  );

  if (isLoading) return <div className="p-6"><div className="animate-pulse h-8 w-64 bg-gray-200 rounded" /></div>;

  const phases = summary?.phases;
  const totals = summary?.totals;

  // ─── Berechnung: Kosten pro m² ─────────────────────────────────────────────
  //
  // Variablen:
  //   gesamtwohnflaeche  – Summe aller Raumflächen (Room.dimensions.area) in m²
  //                        Das Unit-Modell hat keine eigene Flächenangabe;
  //                        Wohnungsfläche = Summe der Räume dieser Wohnung.
  //                        Deshalb werden nur Raumflächen summiert → keine Doppelerfassung.
  //   kostenProM2        – Gesamtkosten (grandTotal) geteilt durch Gesamtwohnfläche
  //
  // Formel: kosten_pro_m2 = totals.grandTotal / Σ(room.dimensions.area)
  //
  // Validierung: Falls gesamtwohnflaeche = 0 → kostenProM2 = null → Hinweis anzeigen
  const gesamtwohnflaeche = rooms
    ? rooms.reduce((sum, r) => sum + (r.dimensions?.area ?? 0), 0)
    : 0;

  const kostenProM2 = gesamtwohnflaeche > 0 && totals
    ? totals.grandTotal / gesamtwohnflaeche
    : null;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to={`/projects/${projectId}`} className="text-gray-400 hover:text-gray-600 text-sm">← Projekt</Link>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Kostenkalkulation</h1>
        <span className="text-gray-400 text-sm hidden sm:inline">{project?.name}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => navigate(`/projects/${projectId}/gaeb`)}
            className="btn btn-sm btn-secondary"
            title="GAEB Leistungsverzeichnis exportieren / importieren"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            GAEB
          </button>
          <button
            onClick={() => navigate(`/projects/${projectId}/datev`)}
            className="btn btn-sm btn-secondary"
            title="DATEV Buchungsstapel exportieren"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            DATEV
          </button>
          <button
            onClick={() => project && summary && void downloadExcel(project, summary, excelUnits as import('../types').Unit[], excelRooms as import('../types').Room[], financeSummary ?? null)}
            disabled={!summary || !project}
            className="btn btn-sm btn-success"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel
          </button>
          <button
            onClick={() => project && summary && downloadPDF(project, summary)}
            disabled={!summary || !project}
            className="btn btn-sm btn-danger"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            PDF
          </button>
        </div>
      </div>

      {/* Phase-Karten (Entkernung, Renovierung, Sonderarbeiten) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {phases && PHASE_ORDER.filter((p) => phases[p]).map((phase) => (
          <PhaseCard key={phase} phase={phase} data={phases[phase]} />
        ))}
      </div>

      {/* Modul-Karten (Baunebenkosten, Planungskosten, Ausstellung, Vertrieb) */}
      {phases && MODULE_PHASES.some((m) => (phases[m]?.subtotal ?? 0) > 0) && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Weitere Kosten</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {MODULE_PHASES.map((m) => {
              const d = phases[m];
              if (!d) return null;
              return (
                <div key={m} className={`card border-l-4 ${PHASE_COLORS[m]} py-3`}>
                  <h3 className="font-semibold text-gray-900 text-sm mb-2">{PHASE_NAMES[m]}</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{d.positionCount} Position{d.positionCount !== 1 ? 'en' : ''}</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-gray-200 pt-2 mt-1">
                      <span className="text-xs">Summe</span>
                      <span className="text-primary-700">{eur(d.subtotal)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gesamtkosten */}
      {totals && (
        <div className="card bg-primary-50 border border-primary-200 mb-6">
          <h3 className="font-bold text-primary-900 text-lg mb-4">Gesamtkosten Projekt</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 text-center">
            {[
              { label: 'Materialkosten', val: totals.materialCost },
              { label: 'Entsorgungskosten', val: totals.disposalCost },
              { label: 'Arbeitskosten', val: totals.laborCost },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-lg p-3 border border-primary-100">
                <p className="text-xs text-primary-600 mb-1">{item.label}</p>
                <p className="font-semibold text-gray-900">{eur(item.val)}</p>
              </div>
            ))}
            {/* Modul-Summen */}
            {phases && MODULE_PHASES.filter((m) => (phases[m]?.subtotal ?? 0) > 0).map((m) => (
              <div key={m} className="bg-white rounded-lg p-3 border border-primary-100">
                <p className="text-xs text-primary-600 mb-1">Summe {PHASE_NAMES[m]}</p>
                <p className="font-semibold text-gray-900">{eur(phases[m]!.subtotal)}</p>
              </div>
            ))}
            <div className="bg-primary-600 text-white rounded-lg p-3">
              <p className="text-xs text-primary-200 mb-1">GESAMTSUMME</p>
              <p className="font-bold text-xl">{eur(totals.grandTotal)}</p>
              <p className="text-xs text-primary-200 mt-1">{totals.totalHours.toFixed(0)} Std. Arbeit</p>
            </div>
          </div>

          {/* Kosten pro m² – dynamisch aus Raumflächen berechnet */}
          <div className="mt-3 pt-3 border-t border-primary-200">
            {kostenProM2 !== null ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Kosten pro m²</p>
                  <p className="text-xs text-blue-400 mt-0.5">
                    Gesamtwohnfläche: {gesamtwohnflaeche.toLocaleString('de-DE', { maximumFractionDigits: 2 })} m²
                  </p>
                </div>
                <p className="text-xl font-bold text-blue-700">{eur(kostenProM2)}</p>
              </div>
            ) : (
              <p className="text-xs text-amber-600 italic text-center py-1">
                Keine Wohnfläche vorhanden – Kosten pro m² können nicht berechnet werden.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Plan vs. Ist je Bereich */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-lg">Plan vs. Ist nach Bereich</h3>
          <div className="flex items-center gap-2">
            {(() => {
              const hatPlanwerte = summary?.bereichsVergleich?.some((r) => r.plan !== null) ?? false;
              return (
                <button
                  onClick={() => {
                    if (window.confirm('Planwerte wirklich zurücksetzen? Die eingefrorenen Plankosten werden gelöscht.')) {
                      loeschenMutation.mutate();
                    }
                  }}
                  disabled={!hatPlanwerte || loeschenMutation.isLoading}
                  className="btn btn-sm btn-danger"
                  title={hatPlanwerte ? 'Eingefrorene Planwerte löschen' : 'Keine Planwerte vorhanden'}
                >
                  {loeschenMutation.isLoading ? 'Wird zurückgesetzt…' : 'Planwerte zurücksetzen'}
                </button>
              );
            })()}
            {summary?.bereichsVergleich && summary.bereichsVergleich.every((r) => r.plan === null) && (
              <button
                onClick={() => frierenMutation.mutate()}
                disabled={frierenMutation.isLoading}
                className="btn btn-sm btn-secondary"
                title="Aktuelle Ist-Kosten als Planwerte einfrieren (einmalig)"
              >
                {frierenMutation.isLoading ? 'Wird eingefroren…' : 'Planwerte jetzt einfrieren'}
              </button>
            )}
          </div>
        </div>
        <PlanVsIstTabelle rows={summary?.bereichsVergleich ?? []} />
      </div>

      {/* Finanzierungs-KPIs (wenn Parameter konfiguriert) */}
      {financeSummary && projectId && (
        <FinanceKpiBar fin={financeSummary} projectId={projectId} />
      )}

      {/* Hinweis wenn noch keine Finanzierung konfiguriert */}
      {!financeSummary && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between text-sm text-gray-400 mb-2">
          <span>Finanzierungsparameter noch nicht konfiguriert</span>
          <Link to={`/projects/${projectId}/finance`}
            className="text-blue-600 hover:text-blue-800 font-medium text-xs">
            Jetzt einrichten →
          </Link>
        </div>
      )}

    </div>
  );
}
