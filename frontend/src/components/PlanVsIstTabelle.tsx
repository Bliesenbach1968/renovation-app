import type { BereichVergleichRow, PhaseType } from '../types';

const PHASE_NAMES: Record<PhaseType, string> = {
  demolition: 'Entkernung',
  renovation: 'Renovierung',
  specialConstruction: 'Sonderarbeiten',
  baunebenkosten: 'Baunebenkosten',
  planungskosten: 'Planungskosten',
  ausstellung: 'Ausstellung',
  vertrieb: 'Vertrieb',
};
const PHASE_ORDER: PhaseType[] = ['demolition', 'renovation', 'specialConstruction'];

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

/** Farbklasse für die Delta-Spalte anhand Abweichung in % */
function deltaColor(pct: number | null): string {
  if (pct === null) return 'text-gray-400';
  if (pct === 0)    return 'text-green-600';
  if (Math.abs(pct) <= 2) return 'text-green-600';
  if (Math.abs(pct) < 5)  return 'text-amber-600';
  return 'text-red-600 font-semibold';
}

function deltaLabel(row: BereichVergleichRow): string {
  if (row.delta === null)        return '–';
  if (row.plan === 0)            return '∞';
  if (row.deltaPercent === null) return '–';
  const sign = row.deltaPercent > 0 ? '+' : '';
  return `${sign}${row.deltaPercent.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

interface Props {
  rows: BereichVergleichRow[];
  /** true wenn mindestens eine Phase aktiviert wurde → Planwerte vorhanden */
  planVorhanden: boolean;
}

export function PlanVsIstTabelle({ rows, planVorhanden }: Props) {
  if (!planVorhanden) {
    return (
      <p className="text-sm text-amber-600 italic py-2">
        Plankosten werden beim Aktivieren einer Phase eingefroren und hier angezeigt.
      </p>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-gray-400 italic py-2">Keine Positionen vorhanden.</p>;
  }

  // Zeilen nach Phase gruppieren
  const byPhase: Partial<Record<PhaseType, BereichVergleichRow[]>> = {};
  for (const row of rows) {
    if (!byPhase[row.phaseType]) byPhase[row.phaseType] = [];
    byPhase[row.phaseType]!.push(row);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left py-2 px-3 font-semibold text-gray-700 w-32">Phase</th>
            <th className="text-left py-2 px-3 font-semibold text-gray-700">Bereich</th>
            <th className="text-right py-2 px-3 font-semibold text-gray-700">Plan (€)</th>
            <th className="text-right py-2 px-3 font-semibold text-gray-700">Ist (€)</th>
            <th className="text-right py-2 px-3 font-semibold text-gray-700">Δ (€)</th>
            <th className="text-right py-2 px-3 font-semibold text-gray-700">Δ (%)</th>
          </tr>
        </thead>
        <tbody>
          {PHASE_ORDER.filter((p) => byPhase[p]).map((phase) => {
            const phaseRows = byPhase[phase]!;
            // Subtotals je Phase aus den granularen Zeilen
            const subtotalIst   = phaseRows.reduce((s, r) => s + r.ist, 0);
            const subtotalPlan  = phaseRows.every((r) => r.plan !== null)
              ? phaseRows.reduce((s, r) => s + (r.plan ?? 0), 0)
              : null;
            const subtotalDelta = subtotalPlan !== null ? subtotalIst - subtotalPlan : null;
            const subtotalPct   = subtotalPlan !== null && subtotalPlan !== 0
              ? +((subtotalDelta! / subtotalPlan) * 100).toFixed(1)
              : null;

            return (
              <>
                {/* Phase-Header-Zeile */}
                <tr key={`${phase}-header`} className="bg-gray-100 border-t-2 border-gray-300">
                  <td colSpan={6} className="py-1.5 px-3 font-semibold text-gray-800 text-xs uppercase tracking-wide">
                    {PHASE_NAMES[phase]}
                  </td>
                </tr>

                {/* Bereich-Zeilen */}
                {phaseRows.map((row, i) => (
                  <tr key={`${phase}-${i}`} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3 text-gray-400" />
                    <td className="py-2 px-3 text-gray-700">{row.bereich ?? <span className="italic text-gray-400">Ohne Bereich</span>}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{row.plan !== null ? eur(row.plan) : <span className="text-gray-400">–</span>}</td>
                    <td className="py-2 px-3 text-right text-gray-900">{eur(row.ist)}</td>
                    <td className={`py-2 px-3 text-right ${deltaColor(row.deltaPercent)}`}>
                      {row.delta !== null ? eur(row.delta) : '–'}
                    </td>
                    <td className={`py-2 px-3 text-right ${deltaColor(row.deltaPercent)}`}>
                      {deltaLabel(row)}
                    </td>
                  </tr>
                ))}

                {/* Subtotal je Phase */}
                <tr key={`${phase}-subtotal`} className="border-t border-gray-300 bg-gray-50 font-semibold">
                  <td className="py-2 px-3 text-gray-500 text-xs">Gesamt</td>
                  <td className="py-2 px-3 text-gray-700">{PHASE_NAMES[phase]}</td>
                  <td className="py-2 px-3 text-right">{subtotalPlan !== null ? eur(subtotalPlan) : '–'}</td>
                  <td className="py-2 px-3 text-right">{eur(subtotalIst)}</td>
                  <td className={`py-2 px-3 text-right ${deltaColor(subtotalPct)}`}>
                    {subtotalDelta !== null ? eur(subtotalDelta) : '–'}
                  </td>
                  <td className={`py-2 px-3 text-right ${deltaColor(subtotalPct)}`}>
                    {subtotalPct !== null ? `${subtotalPct > 0 ? '+' : ''}${subtotalPct.toLocaleString('de-DE', { minimumFractionDigits: 1 })} %` : '–'}
                  </td>
                </tr>
              </>
            );
          })}
        </tbody>
      </table>
      <p className="text-xs text-gray-400 mt-2">* Container, Gerüst und Kran sind nicht in der Bereich-Aufschlüsselung enthalten.</p>
    </div>
  );
}
