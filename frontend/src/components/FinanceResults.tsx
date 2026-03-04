/**
 * FinanceResults
 * ──────────────
 * Zeigt KPI-Kacheln, Cashflow-Tabelle, Schuldsaldo-Liniendiagramm
 * und Monats-Zinsbalken an.
 * Keine externen Chart-Abhängigkeiten – nutzt inline SVG.
 */

import type { FinanceSummary, SchedulePeriod } from '../domain/finance/VariableInterestEngine';

interface Props {
  summary: FinanceSummary;
  schedule: SchedulePeriod[];
}

// ── Formatter ────────────────────────────────────────────────────────────────

const eur = (n: number, d = 0) =>
  n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: d, minimumFractionDigits: d });

const pct = (n: number) => `${n.toFixed(4).replace('.', ',')} %`;

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

// ── Mini-SVG-Charts ───────────────────────────────────────────────────────────

function LineChart({ data, height = 120 }: { data: number[]; height?: number }) {
  if (!data.length) return null;
  const W = 560, H = height, PAD = 10;
  const max = Math.max(...data, 1);
  const min = 0;
  const xs = data.map((_, i) => PAD + (i / Math.max(data.length - 1, 1)) * (W - PAD * 2));
  const ys = data.map(v => H - PAD - ((v - min) / (max - min)) * (H - PAD * 2));
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const area = `${path} L${xs[xs.length - 1]},${H - PAD} L${xs[0]},${H - PAD} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0071E3" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0071E3" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#lineGrad)" />
      <path d={path} fill="none" stroke="#0071E3" strokeWidth="2" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={ys[i]} r="2.5" fill="#0071E3" />
      ))}
    </svg>
  );
}

function BarChart({ data, height = 90 }: { data: number[]; height?: number }) {
  if (!data.length) return null;
  const W = 560, H = height, PAD = 4;
  const max = Math.max(...data, 1);
  const barW = Math.max(1, (W - PAD * 2) / data.length - 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {data.map((v, i) => {
        const x = PAD + i * ((W - PAD * 2) / data.length);
        const bH = ((v / max) * (H - PAD * 2)) || 1;
        return (
          <rect key={i} x={x} y={H - PAD - bH} width={barW} height={bH}
            fill="#34C759" rx="1" opacity="0.85" />
        );
      })}
    </svg>
  );
}

// ── KPI-Kachel ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-1">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold ${accent || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function FinanceResults({ summary, schedule }: Props) {
  const balances  = schedule.map(s => s.endingBalance);
  const interests = schedule.map(s => s.interest);

  return (
    <div className="space-y-5">

      {/* ── KPI-Kacheln ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="All-in"        value={eur(summary.totalAllIn)} accent="text-blue-700" />
        <KpiCard label="Gesamtzinsen"  value={eur(summary.totalInterest)} accent="text-orange-600" />
        <KpiCard label="Peak Debt"     value={eur(summary.peakDebt)} />
        <KpiCard label="Ankauf"        value={eur(summary.totalAcquisition)} />
        <KpiCard label="Projektkosten" value={eur(summary.totalProjectCosts)} />
        <KpiCard label="Ø Zinssatz"    value={pct(summary.averageRate)}
          sub={`${summary.periodsCount} Perioden`} />
      </div>

      {/* ── Schuldsaldo-Liniendiagramm ─────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Schuldsaldo (je Periode)</h3>
        <LineChart data={balances} height={130} />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
          <span>{fmtDate(schedule[0]?.periodStart)}</span>
          <span>{fmtDate(schedule[schedule.length - 1]?.periodEnd)}</span>
        </div>
      </div>

      {/* ── Zinsen je Monat Balkendiagramm ─────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Zinsen je Periode (€)</h3>
        <BarChart data={interests} height={90} />
        <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
          <span>{fmtDate(schedule[0]?.periodStart)}</span>
          <span>{fmtDate(schedule[schedule.length - 1]?.periodEnd)}</span>
        </div>
      </div>

      {/* ── Cashflow-Tabelle ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Zinsplan je Periode</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wide text-[10px]">
                <th className="px-3 py-2 text-left">Periode</th>
                <th className="px-3 py-2 text-right">Anfangssaldo</th>
                <th className="px-3 py-2 text-right">Abruf</th>
                <th className="px-3 py-2 text-right">Tilgung</th>
                <th className="px-3 py-2 text-right">Zins p.a.</th>
                <th className="px-3 py-2 text-right">Zinsbetrag</th>
                <th className="px-3 py-2 text-right">Endsaldo</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row, i) => (
                <tr key={i} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">
                    {fmtDate(row.periodStart)} – {fmtDate(row.periodEnd)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-700 font-mono">
                    {eur(row.startingBalance)}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono ${row.drawdown > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {row.drawdown > 0 ? `+${eur(row.drawdown)}` : '–'}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-mono ${row.amortization > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {row.amortization > 0 ? `-${eur(row.amortization)}` : '–'}
                  </td>
                  <td className="px-3 py-1.5 text-right text-gray-500 font-mono">
                    {row.rateApplied.toFixed(4).replace('.', ',')} %
                  </td>
                  <td className="px-3 py-1.5 text-right text-orange-600 font-mono">
                    {eur(row.interest)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold font-mono text-gray-900">
                    {eur(row.endingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                <td className="px-3 py-2 text-gray-700">Gesamt</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right text-red-600 font-mono">
                  +{eur(schedule.reduce((s, r) => s + r.drawdown, 0))}
                </td>
                <td className="px-3 py-2 text-right text-green-600 font-mono">
                  -{eur(schedule.reduce((s, r) => s + r.amortization, 0))}
                </td>
                <td className="px-3 py-2 text-right text-gray-500 font-mono">
                  Ø {pct(summary.averageRate)}
                </td>
                <td className="px-3 py-2 text-right text-orange-600 font-mono">
                  {eur(summary.totalInterest)}
                </td>
                <td className="px-3 py-2 text-right font-bold font-mono">
                  {eur(schedule[schedule.length - 1]?.endingBalance ?? 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
