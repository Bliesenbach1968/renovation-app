import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getProject, getProjectSummary, getContainers, getGerueste, getKraene } from '../api/projects';
import type { Container, Geruest, Kran, ProjectSummary, Project } from '../types';

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
        {data.containerCost > 0 && <div className="flex justify-between"><span className="text-gray-500">Container/Entsorgung</span><span>{eur(data.containerCost)}</span></div>}
        {data.geruestCost > 0 && <div className="flex justify-between"><span className="text-gray-500">Gerüst</span><span>{eur(data.geruestCost)}</span></div>}
        {data.kranCost > 0 && <div className="flex justify-between"><span className="text-gray-500">Kran</span><span>{eur(data.kranCost)}</span></div>}
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

function downloadPDF(
  project: Project,
  summary: ProjectSummary,
  containers: Container[],
  gerueste: Geruest[],
  kraene: Kran[],
) {
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

    const phaseContainers = containers.filter((c) => c.phaseType === phase);
    const phaseGerueste  = gerueste.filter((g) => g.phaseType === phase);
    const phaseKraene    = kraene.filter((k) => k.phaseType === phase);

    if (d.containerCost > 0) {
      costRows.push(['Container & Entsorgung', eur(d.containerCost)]);
      phaseContainers.forEach((c) =>
        costRows.push([`   ${c.type}  –  ${c.sizeCubicMeters} m³  ×  ${c.quantity}`, eur(c.totalCost)])
      );
    }
    if (d.geruestCost > 0) {
      costRows.push(['Gerüst', eur(d.geruestCost)]);
      phaseGerueste.forEach((g) =>
        costRows.push([`   ${g.type}  –  ${g.areaSqm} m²  ×  ${g.rentalWeeks} Wo.`, eur(g.totalCost)])
      );
    }
    if (d.kranCost > 0) {
      costRows.push(['Kran', eur(d.kranCost)]);
      phaseKraene.forEach((k) =>
        costRows.push([`   ${k.type}  –  ${k.rentalDays} Tage`, eur(k.totalCost)])
      );
    }

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
  if (t.containerCost > 0) totalRows.push(['Container & Entsorgung', eur(t.containerCost)]);
  if (t.geruestCost > 0)   totalRows.push(['Gerüst', eur(t.geruestCost)]);
  if (t.kranCost > 0)      totalRows.push(['Kran', eur(t.kranCost)]);

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

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export default function SummaryPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const { data: project } = useQuery(['project', projectId], () => getProject(projectId!));
  const { data: summary, isLoading } = useQuery(['summary', projectId], () => getProjectSummary(projectId!), { refetchInterval: 10_000 });
  const { data: containers = [] } = useQuery(['containers', projectId], () => getContainers(projectId!));
  const { data: gerueste = [] } = useQuery(['gerueste', projectId], () => getGerueste(projectId!));
  const { data: kraene = [] } = useQuery(['kraene', projectId], () => getKraene(projectId!));

  if (isLoading) return <div className="p-6"><div className="animate-pulse h-8 w-64 bg-gray-200 rounded" /></div>;

  const phases = summary?.phases;
  const totals = summary?.totals;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/projects/${projectId}`} className="text-gray-400 hover:text-gray-600 text-sm">← Projekt</Link>
        <h1 className="text-2xl font-bold text-gray-900">Kostenkalkulation</h1>
        <span className="text-gray-400 text-sm">{project?.name}</span>
        <div className="ml-auto">
          <button
            onClick={() => project && summary && downloadPDF(project, summary, containers, gerueste, kraene)}
            disabled={!summary || !project}
            className="inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(180deg, #F03A2E 0%, #D42B20 100%)',
              color: '#fff',
              boxShadow: '0 1px 3px rgba(212,43,32,0.40), 0 1px 2px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.14)',
              padding: '5px 10px 5px 6px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => !e.currentTarget.disabled && (e.currentTarget.style.background = 'linear-gradient(180deg, #E83529 0%, #C42419 100%)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'linear-gradient(180deg, #F03A2E 0%, #D42B20 100%)')}
          >
            {/* Klassisches PDF-Icon */}
            <span
              className="flex items-center justify-center shrink-0"
              style={{ width: 20, height: 20, background: 'rgba(0,0,0,0.20)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.18)' }}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 2h8l4 4v16a1 1 0 01-1 1H6a1 1 0 01-1-1V3a1 1 0 011-1z" fill="rgba(255,255,255,0.95)" />
                <path d="M14 2l4 4h-3a1 1 0 01-1-1V2z" fill="rgba(255,255,255,0.60)" />
                <rect x="3" y="11" width="14" height="7" rx="1.5" fill="#D42B20" />
                <text x="5.5" y="17" fontSize="5" fontWeight="bold" fill="white" fontFamily="Helvetica, Arial, sans-serif">PDF</text>
              </svg>
            </span>
            PDF herunterladen
            <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" style={{ opacity: 0.8 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Phase-Karten */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {phases && Object.entries(phases).map(([phase, data]) => (
          <PhaseCard key={phase} phase={phase} data={data} />
        ))}
      </div>

      {/* Container & Entsorgung */}
      {totals && (
        <div className="card border-l-4 border-l-amber-500 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Container & Entsorgung</h3>
            <Link to={`/projects/${projectId}/containers`} className="text-xs text-primary-600 hover:text-primary-800 border border-primary-200 rounded px-2 py-0.5 hover:bg-primary-50 transition-colors">
              Verwalten →
            </Link>
          </div>
          <div className="space-y-2 text-sm">
            {(['demolition', 'renovation', 'specialConstruction'] as const).map((phase) => {
              const cost = phases?.[phase]?.containerCost ?? 0;
              if (cost === 0) return null;
              return (
                <div key={phase} className="flex justify-between">
                  <span className="text-gray-500">{PHASE_NAMES[phase]}</span>
                  <span>{eur(cost)}</span>
                </div>
              );
            })}
            {containers.length === 0 && (
              <p className="text-gray-400 text-xs">Noch keine Container gebucht –{' '}
                <Link to={`/projects/${projectId}/containers`} className="text-primary-600 hover:underline">jetzt buchen</Link>
              </p>
            )}
            {totals.containerCost > 0 && (
              <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2 mt-2">
                <span>Summe Container</span>
                <span className="text-amber-700">{eur(totals.containerCost)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gerüst */}
      {totals && (
        <div className="card border-l-4 border-l-orange-500 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Gerüst</h3>
            <Link to={`/projects/${projectId}/geruest`} className="text-xs text-primary-600 hover:text-primary-800 border border-primary-200 rounded px-2 py-0.5 hover:bg-primary-50 transition-colors">
              Verwalten →
            </Link>
          </div>
          <div className="space-y-2 text-sm">
            {(['demolition', 'renovation', 'specialConstruction'] as const).map((phase) => {
              const cost = phases?.[phase]?.geruestCost ?? 0;
              if (cost === 0) return null;
              return (
                <div key={phase} className="flex justify-between">
                  <span className="text-gray-500">{PHASE_NAMES[phase]}</span>
                  <span>{eur(cost)}</span>
                </div>
              );
            })}
            {gerueste.length === 0 && (
              <p className="text-gray-400 text-xs">Noch kein Gerüst gebucht –{' '}
                <Link to={`/projects/${projectId}/geruest`} className="text-primary-600 hover:underline">jetzt buchen</Link>
              </p>
            )}
            {totals.geruestCost > 0 && (
              <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2 mt-2">
                <span>Summe Gerüst</span>
                <span className="text-orange-700">{eur(totals.geruestCost)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Kran */}
      {totals && (
        <div className="card border-l-4 border-l-purple-500 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Kran</h3>
            <Link to={`/projects/${projectId}/kran`} className="text-xs text-primary-600 hover:text-primary-800 border border-primary-200 rounded px-2 py-0.5 hover:bg-primary-50 transition-colors">
              Verwalten →
            </Link>
          </div>
          <div className="space-y-2 text-sm">
            {(['demolition', 'renovation', 'specialConstruction'] as const).map((phase) => {
              const cost = phases?.[phase]?.kranCost ?? 0;
              if (cost === 0) return null;
              return (
                <div key={phase} className="flex justify-between">
                  <span className="text-gray-500">{PHASE_NAMES[phase]}</span>
                  <span>{eur(cost)}</span>
                </div>
              );
            })}
            {kraene.length === 0 && (
              <p className="text-gray-400 text-xs">Noch kein Kran gebucht –{' '}
                <Link to={`/projects/${projectId}/kran`} className="text-primary-600 hover:underline">jetzt buchen</Link>
              </p>
            )}
            {totals.kranCost > 0 && (
              <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2 mt-2">
                <span>Summe Kran</span>
                <span className="text-purple-700">{eur(totals.kranCost)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gesamtkosten */}
      {totals && (
        <div className="card bg-primary-50 border border-primary-200 mb-6">
          <h3 className="font-bold text-primary-900 text-lg mb-4">Gesamtkosten Projekt</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 text-center">
            {[
              { label: 'Materialkosten', val: totals.materialCost },
              { label: 'Entsorgungskosten', val: totals.disposalCost },
              { label: 'Arbeitskosten', val: totals.laborCost },
              { label: 'Containerkosten', val: totals.containerCost },
              { label: 'Gerüstkosten', val: totals.geruestCost },
              { label: 'Krankosten', val: totals.kranCost },
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
