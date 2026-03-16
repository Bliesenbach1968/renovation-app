import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getProject, getProjectSummary, getRooms, frierePlanwerteEin, loeschePlanwerte } from '../api/projects';
import { getFinanceSummary } from '../api/finance';
import type { ProjectSummary, Project, BereichVergleichRow, PhaseType } from '../types';
import type { FinanceSummary } from '../domain/finance/VariableInterestEngine';

const PLAN_PHASE_NAMES: Record<string, string> = {
  demolition: 'Entkernung', renovation: 'Renovierung', specialConstruction: 'Sonderarbeiten',
  baunebenkosten: 'Baunebenkosten', planungskosten: 'Planungskosten',
  ausstellung: 'Ausstellung', vertrieb: 'Vertrieb',
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
  ausstellung: 'Ausstellung', vertrieb: 'Vertrieb',
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

// ─── Excel-Download ───────────────────────────────────────────────────────────

function downloadExcel(project: Project, summary: ProjectSummary) {
  const now = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const wb = XLSX.utils.book_new();

  // ── Übersichtsblatt ────────────────────────────────────────────────────────
  const overviewRows: (string | number)[][] = [
    ['Kostenkalkulation'],
    [project.name],
    [project.projectNumber],
    [`${project.address.street}, ${project.address.zipCode} ${project.address.city}`],
    [`Erstellt am ${now}`],
    [],
    ['Phase', 'Materialkosten (€)', 'Entsorgungskosten (€)', 'Arbeitskosten (€)', 'Phasensumme (€)', 'Arbeitsstunden', 'Positionen'],
  ];

  for (const phase of PHASE_ORDER) {
    const d = summary.phases[phase];
    if (!d) continue;
    overviewRows.push([
      PHASE_NAMES[phase],
      d.materialCost,
      d.disposalCost,
      d.laborCost,
      d.subtotal,
      parseFloat(d.totalHours.toFixed(1)),
      d.positionCount,
    ]);
  }

  // Module Phasen
  const moduleKeys = ['baunebenkosten', 'planungskosten', 'ausstellung', 'vertrieb'] as const;
  const hasModuleData = moduleKeys.some((m) => (summary.phases[m]?.subtotal ?? 0) > 0);
  if (hasModuleData) {
    overviewRows.push([]);
    overviewRows.push(['Weitere Kosten', '', '', '', '', '', '']);
    for (const m of moduleKeys) {
      const d = summary.phases[m];
      if (!d || d.subtotal === 0) continue;
      overviewRows.push([PHASE_NAMES[m], d.materialCost, 0, 0, d.subtotal, 0, d.positionCount]);
    }
  }

  const t = summary.totals;
  overviewRows.push([]);
  overviewRows.push([
    'GESAMTSUMME',
    t.materialCost,
    t.disposalCost,
    t.laborCost,
    t.grandTotal,
    parseFloat(t.totalHours.toFixed(0)),
    '',
  ]);

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);

  // Spaltenbreiten
  wsOverview['!cols'] = [
    { wch: 22 }, { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(wb, wsOverview, 'Übersicht');

  // ── Je Phase ein eigenes Blatt ────────────────────────────────────────────
  for (const phase of PHASE_ORDER) {
    const d = summary.phases[phase];
    if (!d) continue;

    const rows: (string | number)[][] = [
      [PHASE_NAMES[phase]],
      [],
      ['Kostenart', 'Betrag (€)'],
      ['Materialkosten', d.materialCost],
      ['Entsorgungskosten', d.disposalCost],
      ['Arbeitskosten', d.laborCost],
      [],
      ['Phasensumme', d.subtotal],
      ['Arbeitsstunden', parseFloat(d.totalHours.toFixed(1))],
      ['Positionen', d.positionCount],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 24 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, PHASE_NAMES[phase]);
  }

  // ── Plan vs. Ist nach Bereich ────────────────────────────────────────────
  const bereichRows = summary.bereichsVergleich ?? [];
  if (bereichRows.length > 0) {
    const byPhase: Record<string, BereichVergleichRow[]> = {};
    for (const row of bereichRows) {
      if (!byPhase[row.phaseType]) byPhase[row.phaseType] = [];
      byPhase[row.phaseType].push(row);
    }

    const pvIstRows: (string | number | null)[][] = [
      ['Plan vs. Ist nach Bereich'],
      [],
      ['Phase', 'Bereich', 'Plan (€)', 'Ist (€)', 'Abweichung (€)', 'Abweichung (%)'],
    ];

    for (const phase of PLAN_PHASE_ORDER.filter((p) => byPhase[p])) {
      const phaseRows = byPhase[phase];

      for (const row of phaseRows) {
        const planAnzeige = row.plan !== null ? row.plan : row.ist;
        const istAnzeige  = row.plan !== null ? row.ist  : null;
        pvIstRows.push([
          PLAN_PHASE_NAMES[phase],
          row.bereich ?? 'Ohne Bereich',
          planAnzeige,
          istAnzeige,
          row.delta,
          row.deltaPercent !== null
            ? parseFloat(row.deltaPercent.toFixed(1))
            : null,
        ]);
      }

      // Phasengesamt
      const subIst  = phaseRows.reduce((s, r) => s + r.ist, 0);
      const subPlan = phaseRows.every((r) => r.plan !== null)
        ? phaseRows.reduce((s, r) => s + (r.plan ?? 0), 0)
        : null;
      const subDelta = subPlan !== null ? subIst - subPlan : null;
      const subPct   = subPlan !== null && subPlan !== 0
        ? parseFloat(((subDelta! / subPlan) * 100).toFixed(1))
        : null;
      const subPlanAnzeige = subPlan !== null ? subPlan : subIst;
      const subIstAnzeige  = subPlan !== null ? subIst  : null;

      pvIstRows.push([
        `Gesamt ${PLAN_PHASE_NAMES[phase]}`,
        '',
        subPlanAnzeige,
        subIstAnzeige,
        subDelta,
        subPct,
      ]);
      pvIstRows.push([]);
    }

    const wsPlan = XLSX.utils.aoa_to_sheet(pvIstRows);
    wsPlan['!cols'] = [
      { wch: 22 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 18 }, { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, wsPlan, 'Plan vs. Ist');
  }

  XLSX.writeFile(wb, `Kostenkalkulation_${project.projectNumber}_${project.name.replace(/\s+/g, '_')}.xlsx`);
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
            onClick={() => project && summary && downloadExcel(project, summary)}
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
