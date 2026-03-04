import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getProject, getProjectSummary } from '../api/projects';
import type { ProjectSummary, Project } from '../types';

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

const PHASE_NAMES: Record<string, string> = {
  demolition: 'Entkernung', renovation: 'Renovierung', specialConstruction: 'Sonderarbeiten',
};
const PHASE_COLORS: Record<string, string> = {
  demolition: 'border-l-red-500', renovation: 'border-l-blue-500', specialConstruction: 'border-l-green-500',
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

    // Kostenübersicht der Phase
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

    // Seitenumbruch prüfen
    if (y > 260 && phase !== 'specialConstruction') {
      doc.addPage();
      y = 15;
    }
  }

  // ── Gesamtkosten ──────────────────────────────────────────────────────────
  const t = summary.totals;
  const totalRows: Array<[string, string]> = [
    ['Materialkosten', eur(t.materialCost)],
    ['Entsorgungskosten', eur(t.disposalCost)],
    ['Arbeitskosten', eur(t.laborCost)],
  ];
  // Seitenumbruch wenn nötig
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

  XLSX.writeFile(wb, `Kostenkalkulation_${project.projectNumber}_${project.name.replace(/\s+/g, '_')}.xlsx`);
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function SummaryPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const { data: project } = useQuery(['project', projectId], () => getProject(projectId!));
  const { data: summary, isLoading } = useQuery(['summary', projectId], () => getProjectSummary(projectId!), { refetchInterval: 10_000 });
  if (isLoading) return <div className="p-6"><div className="animate-pulse h-8 w-64 bg-gray-200 rounded" /></div>;

  const phases = summary?.phases;
  const totals = summary?.totals;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to={`/projects/${projectId}`} className="text-gray-400 hover:text-gray-600 text-sm">← Projekt</Link>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Kostenkalkulation</h1>
        <span className="text-gray-400 text-sm hidden sm:inline">{project?.name}</span>
        <div className="ml-auto flex items-center gap-2">
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

      {/* Phase-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {phases && Object.entries(phases).map(([phase, data]) => (
          <PhaseCard key={phase} phase={phase} data={data} />
        ))}
      </div>

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
            <div className="bg-primary-600 text-white rounded-lg p-3">
              <p className="text-xs text-primary-200 mb-1">GESAMTSUMME</p>
              <p className="font-bold text-xl">{eur(totals.grandTotal)}</p>
              <p className="text-xs text-primary-200 mt-1">{totals.totalHours.toFixed(0)} Std. Arbeit</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
