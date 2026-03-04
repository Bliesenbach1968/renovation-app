/**
 * FinanceConfigurator
 * ───────────────────
 * Formular zur Eingabe aller Finanzierungsparameter:
 *  - Ankauf (Datum, Kaufpreis, Nebenkosten)
 *  - Zinsmodell (Staffel oder Index+Marge)
 *  - Day-Count, Kapitalisierung, Lag-Tage
 *  - Optionaler Tilgungsplan
 */

import { useState, useEffect } from 'react';
import type { FinanceParamsDto, StaffelEntryDto, IndexMarginEntryDto, AmortizationEntryDto } from '../api/finance';

interface Props {
  initial?: Partial<FinanceParamsDto> | null;
  onSubmit: (params: Partial<FinanceParamsDto>) => void;
  isLoading?: boolean;
}

const EMPTY_STAFFEL: StaffelEntryDto = { startDate: '', annualRate: 0.05 };
const EMPTY_INDEX: IndexMarginEntryDto  = { startDate: '', indexName: '3M-EURIBOR', indexRate: 0.032, margin: 0.02, floor: 0 };
const EMPTY_AMORT: AmortizationEntryDto = { startDate: '', frequency: 'monthly' };

function fmtDate(d?: string | null): string {
  if (!d) return '';
  return d.slice(0, 10);
}

export default function FinanceConfigurator({ initial, onSubmit, isLoading }: Props) {
  // ── Basisfelder ──────────────────────────────────────────────────────
  const [acquisitionDate,    setAcquisitionDate]    = useState(fmtDate(initial?.acquisitionDate) || '2026-01-15');
  const [purchasePrice,      setPurchasePrice]      = useState(initial?.purchasePrice       ?? 1_000_000);
  const [feesPct,            setFeesPct]            = useState(initial?.acquisitionFeesPct  ?? 9);
  const [feesFixed,          setFeesFixed]          = useState(initial?.acquisitionFeesFixed ?? '');
  const [feesMode,           setFeesMode]           = useState<'pct' | 'fixed'>('pct');

  const [rateModelType,      setRateModelType]      = useState<'staffel' | 'indexMargin'>(initial?.rateModelType || 'staffel');
  const [staffelRows,        setStaffelRows]        = useState<StaffelEntryDto[]>(
    initial?.staffelSchedule?.length ? initial.staffelSchedule : [
      { startDate: '2026-01-15', annualRate: 0.05 },
      { startDate: '2026-07-01', annualRate: 0.04 },
    ]
  );
  const [indexRows,          setIndexRows]          = useState<IndexMarginEntryDto[]>(
    initial?.indexMarginEntries?.length ? initial.indexMarginEntries : [
      { startDate: '2026-01-01', indexName: '3M-EURIBOR', indexRate: 0.032, margin: 0.02, floor: 0 },
    ]
  );

  const [dayCount,           setDayCount]           = useState<'ACT/360' | 'ACT/365' | '30E/360'>(initial?.dayCount || 'ACT/360');
  const [interestMode,       setInterestMode]       = useState<'capitalize' | 'payMonthly'>(initial?.interestMode || 'payMonthly');
  const [lagDays,            setLagDays]            = useState(initial?.lagDays ?? 0);
  const [currency,           setCurrency]           = useState(initial?.currency || 'EUR');

  const [amortRows,          setAmortRows]          = useState<AmortizationEntryDto[]>(initial?.amortizationPlan || []);
  const [showAmort,          setShowAmort]          = useState((initial?.amortizationPlan?.length ?? 0) > 0);

  const [calcEndDate,        setCalcEndDate]        = useState(fmtDate(initial?.calcEndDate) || '');

  // Sync wenn initial-Prop sich ändert
  useEffect(() => {
    if (!initial) return;
    if (initial.acquisitionDate)   setAcquisitionDate(fmtDate(initial.acquisitionDate));
    if (initial.purchasePrice)     setPurchasePrice(initial.purchasePrice);
    if (initial.acquisitionFeesPct != null) { setFeesPct(initial.acquisitionFeesPct!); setFeesMode('pct'); }
    if (initial.acquisitionFeesFixed != null) { setFeesFixed(initial.acquisitionFeesFixed!); setFeesMode('fixed'); }
    if (initial.rateModelType)     setRateModelType(initial.rateModelType);
    if (initial.staffelSchedule?.length)    setStaffelRows(initial.staffelSchedule);
    if (initial.indexMarginEntries?.length) setIndexRows(initial.indexMarginEntries);
    if (initial.dayCount)          setDayCount(initial.dayCount);
    if (initial.interestMode)      setInterestMode(initial.interestMode);
    if (initial.lagDays != null)   setLagDays(initial.lagDays);
    if (initial.currency)          setCurrency(initial.currency);
    if (initial.amortizationPlan?.length) { setAmortRows(initial.amortizationPlan); setShowAmort(true); }
    if (initial.calcEndDate)       setCalcEndDate(fmtDate(initial.calcEndDate));
  }, [initial]);

  // ── Staffel-Zeilen ────────────────────────────────────────────────────
  const updateStaffel = (i: number, field: keyof StaffelEntryDto, val: string | number) => {
    setStaffelRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  };
  const addStaffel    = () => setStaffelRows(r => [...r, { ...EMPTY_STAFFEL }]);
  const removeStaffel = (i: number) => setStaffelRows(r => r.filter((_, idx) => idx !== i));

  // ── Index-Zeilen ──────────────────────────────────────────────────────
  const updateIndex = (i: number, field: keyof IndexMarginEntryDto, val: string | number) => {
    setIndexRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  };
  const addIndex    = () => setIndexRows(r => [...r, { ...EMPTY_INDEX }]);
  const removeIndex = (i: number) => setIndexRows(r => r.filter((_, idx) => idx !== i));

  // ── Tilgungs-Zeilen ────────────────────────────────────────────────────
  const updateAmort  = (i: number, field: keyof AmortizationEntryDto, val: any) => {
    setAmortRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  };
  const addAmort     = () => setAmortRows(r => [...r, { ...EMPTY_AMORT }]);
  const removeAmort  = (i: number) => setAmortRows(r => r.filter((_, idx) => idx !== i));

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params: Partial<FinanceParamsDto> = {
      acquisitionDate,
      purchasePrice: +purchasePrice,
      acquisitionFeesPct:   feesMode === 'pct'   ? +feesPct   : undefined,
      acquisitionFeesFixed: feesMode === 'fixed' ? +feesFixed : undefined,
      rateModelType,
      staffelSchedule:    rateModelType === 'staffel'     ? staffelRows : [],
      indexMarginEntries: rateModelType === 'indexMargin' ? indexRows   : [],
      dayCount,
      interestMode,
      lagDays: +lagDays,
      currency,
      amortizationPlan: showAmort ? amortRows : [],
      calcEndDate: calcEndDate || undefined,
    };
    onSubmit(params);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const sectionClass = 'bg-white rounded-xl border border-gray-200 p-4 space-y-3';
  const labelClass   = 'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1';
  const inputClass   = 'input text-sm';
  const selectClass  = 'input text-sm';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* ── Ankauf ─────────────────────────────────────────────────── */}
      <div className={sectionClass}>
        <h3 className="font-semibold text-gray-800 text-sm">Ankauf</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Ankaufsdatum</label>
            <input type="date" className={inputClass} value={acquisitionDate}
              onChange={e => setAcquisitionDate(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>Kaufpreis (€)</label>
            <input type="number" className={inputClass} min={0} step={1000}
              value={purchasePrice} onChange={e => setPurchasePrice(+e.target.value)} required />
          </div>
        </div>
        <div>
          <label className={labelClass}>Erwerbsnebenkosten</label>
          <div className="flex gap-2 mb-2">
            {(['pct', 'fixed'] as const).map(m => (
              <button type="button" key={m}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${feesMode === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                onClick={() => setFeesMode(m)}>
                {m === 'pct' ? 'Prozentsatz' : 'Festbetrag'}
              </button>
            ))}
          </div>
          {feesMode === 'pct' ? (
            <div className="flex items-center gap-2">
              <input type="number" className={`${inputClass} w-28`} min={0} max={30} step={0.1}
                value={feesPct} onChange={e => setFeesPct(+e.target.value)} />
              <span className="text-sm text-gray-500">%  = {((+purchasePrice || 0) * (+feesPct || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>
            </div>
          ) : (
            <input type="number" className={`${inputClass} w-48`} min={0} step={1000}
              value={feesFixed as number} onChange={e => setFeesFixed(+e.target.value)} />
          )}
        </div>
      </div>

      {/* ── Zinsmodell ─────────────────────────────────────────────── */}
      <div className={sectionClass}>
        <h3 className="font-semibold text-gray-800 text-sm">Zinsmodell</h3>
        <div className="flex gap-2 mb-3">
          {(['staffel', 'indexMargin'] as const).map(m => (
            <button type="button" key={m}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${rateModelType === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
              onClick={() => setRateModelType(m)}>
              {m === 'staffel' ? 'Zinsstaffel' : 'Index + Marge'}
            </button>
          ))}
        </div>

        {rateModelType === 'staffel' && (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-1 text-[11px] font-semibold text-gray-400 px-1">
              <span className="col-span-5">Gültig ab</span>
              <span className="col-span-5">Jahreszins (%)</span>
              <span className="col-span-2" />
            </div>
            {staffelRows.map((row, i) => (
              <div key={i} className="grid grid-cols-12 gap-1 items-center">
                <input type="date" className={`${inputClass} col-span-5 text-xs`}
                  value={fmtDate(row.startDate)} onChange={e => updateStaffel(i, 'startDate', e.target.value)} required />
                <input type="number" className={`${inputClass} col-span-5 text-xs`}
                  min={0} max={50} step={0.01}
                  value={+(row.annualRate * 100).toFixed(4)}
                  onChange={e => updateStaffel(i, 'annualRate', +e.target.value / 100)} required />
                <button type="button" onClick={() => removeStaffel(i)}
                  className="col-span-2 text-gray-400 hover:text-red-500 text-center text-lg leading-none">×</button>
              </div>
            ))}
            <button type="button" onClick={addStaffel}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1">+ Zeile</button>
          </div>
        )}

        {rateModelType === 'indexMargin' && (
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-1 text-[11px] font-semibold text-gray-400 px-1">
              <span className="col-span-3">Gültig ab</span>
              <span className="col-span-3">Index</span>
              <span className="col-span-2">Satz %</span>
              <span className="col-span-2">Marge %</span>
              <span className="col-span-1">Floor</span>
              <span className="col-span-1" />
            </div>
            {indexRows.map((row, i) => (
              <div key={i} className="grid grid-cols-12 gap-1 items-center">
                <input type="date" className={`${inputClass} col-span-3 text-xs`}
                  value={fmtDate(row.startDate)} onChange={e => updateIndex(i, 'startDate', e.target.value)} />
                <input type="text" className={`${inputClass} col-span-3 text-xs`}
                  value={row.indexName} onChange={e => updateIndex(i, 'indexName', e.target.value)} />
                <input type="number" className={`${inputClass} col-span-2 text-xs`} min={-5} max={30} step={0.01}
                  value={+(row.indexRate * 100).toFixed(4)} onChange={e => updateIndex(i, 'indexRate', +e.target.value / 100)} />
                <input type="number" className={`${inputClass} col-span-2 text-xs`} min={0} max={20} step={0.01}
                  value={+(row.margin * 100).toFixed(4)} onChange={e => updateIndex(i, 'margin', +e.target.value / 100)} />
                <input type="number" className={`${inputClass} col-span-1 text-xs`} min={0} max={20} step={0.01}
                  value={+((row.floor ?? 0) * 100).toFixed(4)} onChange={e => updateIndex(i, 'floor', +e.target.value / 100)} />
                <button type="button" onClick={() => removeIndex(i)}
                  className="col-span-1 text-gray-400 hover:text-red-500 text-center text-lg leading-none">×</button>
              </div>
            ))}
            <button type="button" onClick={addIndex}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1">+ Zeile</button>
          </div>
        )}
      </div>

      {/* ── Berechnungseinstellungen ───────────────────────────────── */}
      <div className={sectionClass}>
        <h3 className="font-semibold text-gray-800 text-sm">Berechnungseinstellungen</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className={labelClass}>Day-Count</label>
            <select className={selectClass} value={dayCount} onChange={e => setDayCount(e.target.value as any)}>
              <option value="ACT/360">ACT/360</option>
              <option value="ACT/365">ACT/365</option>
              <option value="30E/360">30E/360</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Zinsmodus</label>
            <select className={selectClass} value={interestMode} onChange={e => setInterestMode(e.target.value as any)}>
              <option value="capitalize">Kapitalisiert</option>
              <option value="payMonthly">Monatlich zahlen</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Lag-Tage</label>
            <input type="number" className={inputClass} min={0} max={90} step={1}
              value={lagDays} onChange={e => setLagDays(+e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Währung</label>
            <select className={selectClass} value={currency} onChange={e => setCurrency(e.target.value)}>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="CHF">CHF</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Berechnungsende (optional)</label>
          <input type="date" className={`${inputClass} w-48`} value={calcEndDate}
            onChange={e => setCalcEndDate(e.target.value)} />
          <p className="text-xs text-gray-400 mt-1">Leer lassen = automatisch (letzter Kostenfall + 6 Monate)</p>
        </div>
      </div>

      {/* ── Optionaler Tilgungsplan ────────────────────────────────── */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">Tilgungsplan (optional)</h3>
          <button type="button"
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            onClick={() => { setShowAmort(v => !v); if (showAmort) setAmortRows([]); }}>
            {showAmort ? '▲ Ausblenden' : '▼ Einblenden'}
          </button>
        </div>
        {showAmort && (
          <div className="space-y-2 mt-2">
            <div className="grid grid-cols-12 gap-1 text-[11px] font-semibold text-gray-400 px-1">
              <span className="col-span-3">Startdatum</span>
              <span className="col-span-3">Betrag (€)</span>
              <span className="col-span-2">Pct %</span>
              <span className="col-span-3">Rhythmus</span>
              <span className="col-span-1" />
            </div>
            {amortRows.map((row, i) => (
              <div key={i} className="grid grid-cols-12 gap-1 items-center">
                <input type="date" className={`${inputClass} col-span-3 text-xs`}
                  value={fmtDate(row.startDate)} onChange={e => updateAmort(i, 'startDate', e.target.value)} />
                <input type="number" className={`${inputClass} col-span-3 text-xs`} min={0} step={1000}
                  value={row.amount ?? ''} onChange={e => updateAmort(i, 'amount', e.target.value ? +e.target.value : undefined)} placeholder="Betrag" />
                <input type="number" className={`${inputClass} col-span-2 text-xs`} min={0} max={100} step={0.5}
                  value={row.pct ?? ''} onChange={e => updateAmort(i, 'pct', e.target.value ? +e.target.value : undefined)} placeholder="%" />
                <select className={`${selectClass} col-span-3 text-xs`}
                  value={row.frequency} onChange={e => updateAmort(i, 'frequency', e.target.value)}>
                  <option value="monthly">monatlich</option>
                  <option value="quarterly">quartalsweise</option>
                  <option value="annual">jährlich</option>
                </select>
                <button type="button" onClick={() => removeAmort(i)}
                  className="col-span-1 text-gray-400 hover:text-red-500 text-center text-lg leading-none">×</button>
              </div>
            ))}
            <button type="button" onClick={addAmort}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Zeile</button>
          </div>
        )}
      </div>

      {/* ── Absenden ───────────────────────────────────────────────── */}
      <button type="submit" disabled={isLoading}
        className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
        {isLoading ? (
          <><span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Berechne…</>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a1 1 0 001-1V6a1 1 0 00-1-1H4a1 1 0 00-1 1v12a1 1 0 001 1z" />
            </svg>
            Neu berechnen
          </>
        )}
      </button>
    </form>
  );
}
