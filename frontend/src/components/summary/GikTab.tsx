import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { getGikData, updateGikData } from '../../api/gik';
import { updateVertriebPreise } from '../../api/projects';
import type { Project, ProjectSummary, Unit, Room, GikData } from '../../types';
import type { FinanceSummary } from '../../domain/finance/VariableInterestEngine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EUR = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
const N2  = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur = (v: number | null | undefined) => v != null ? EUR.format(v) : '–';
const n2  = (v: number | null | undefined) => v != null ? N2.format(v) : '–';

function parseDE(s: string): number | null {
  if (!s?.trim()) return null;
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

const ZIMMER_EXCLUDED = ['bathroom', 'kitchen', 'hallway'];
type GIKUnit = { type: 'WE' | 'DG'; weCode?: string; title: string; totalArea: number; zimmer: number };

function buildGIKUnits(units: Unit[], rooms: Room[]): GIKUnit[] {
  return units.flatMap((u) => {
    const name  = u.name ?? '';
    const num   = u.number ?? '';
    const weM   = (num + ' ' + name).toUpperCase().match(/\b(WE\d+[A-Z]?)\b/);
    const isDG  = /(^|\s)(dachgeschoss|dachgeschoß|dg)(\s|$)/i.test(name) || /(^|\s)(dachgeschoss|dachgeschoß|dg)(\s|$)/i.test(num);
    if (!weM && !isDG) return [];
    const unitRooms = rooms.filter((r) => {
      if (!r.unitId) return false;
      const uid = typeof r.unitId === 'string' ? r.unitId : (r.unitId as Unit)._id;
      return uid === u._id;
    });
    const totalArea = +unitRooms.reduce((s, r) => s + (r.dimensions?.area ?? 0), 0).toFixed(2);
    const zimmer    = unitRooms.filter((r) => !ZIMMER_EXCLUDED.includes(r.type)).length;
    return [{
      type: (isDG ? 'DG' : 'WE') as 'WE' | 'DG',
      weCode: weM ? weM[1] : undefined,
      title: name || num,
      totalArea,
      zimmer,
    }];
  }).sort((a, b) => {
    const norm = (s: string) => s.replace(/^WE\s*/i, '');
    const pa = norm(a.weCode ?? '').match(/^(\d+)([A-Za-z]*)$/);
    const pb = norm(b.weCode ?? '').match(/^(\d+)([A-Za-z]*)$/);
    if (pa && pb) {
      const na = parseInt(pa[1], 10), nb = parseInt(pb[1], 10);
      if (na !== nb) return na - nb;
      return (pa[2] || '').localeCompare(pb[2] || '', 'de', { sensitivity: 'base' });
    }
    return (a.weCode ?? '').localeCompare(b.weCode ?? '', 'de', { sensitivity: 'base' });
  });
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
}

// ─── Collapse-Card ────────────────────────────────────────────────────────────

function Section({
  title, badge, defaultOpen = true, accent = 'border-slate-200',
  children,
}: {
  title: string; badge?: string; defaultOpen?: boolean; accent?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border ${accent} bg-white mb-4 overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
        aria-expanded={open}
      >
        <span className="font-semibold text-gray-900 text-sm">{title}</span>
        <span className="flex items-center gap-2">
          {badge && <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">{badge}</span>}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  );
}

// ─── Inline-Edit-Feld ─────────────────────────────────────────────────────────

function EditField({
  label, value, onChange, suffix = '', hint, readOnly = false,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  suffix?: string; hint?: string; readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</label>
      <div className="flex items-center gap-1">
        {readOnly ? (
          <span className="text-sm font-semibold text-gray-900">{value || '–'}</span>
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400 bg-yellow-50"
            aria-label={label}
          />
        )}
        {suffix && <span className="text-xs text-gray-400 whitespace-nowrap">{suffix}</span>}
      </div>
      {hint && <p className="text-[10px] text-gray-400 italic">{hint}</p>}
    </div>
  );
}

// ─── GIK Hauptkomponente ──────────────────────────────────────────────────────

interface Props {
  project: Project;
  summary: ProjectSummary;
  units:   Unit[];
  rooms:   Room[];
  financeSummary: FinanceSummary | null;
  projectId: string;
}

export default function GikTab({ project, summary, units, rooms, financeSummary, projectId }: Props) {
  const queryClient = useQueryClient();

  // ── Remote data ──────────────────────────────────────────────────────────
  const { data: gikData } = useQuery<GikData>(
    ['gikData', projectId],
    () => getGikData(projectId),
    { retry: false },
  );

  // ── Local edit state ─────────────────────────────────────────────────────
  const [grz,    setGrz]    = useState('');
  const [bgf,    setBgf]    = useState('');
  const [manGS,  setManGS]  = useState('');
  const [preise, setPreise] = useState<Record<string, { preisQm: string; festpreis: string }>>({});
  const [dirty,  setDirty]  = useState(false);

  // Seed local state when remote data arrives
  useEffect(() => {
    if (!gikData) return;
    setGrz(gikData.grz    != null ? String(gikData.grz).replace('.', ',') : '');
    setBgf(gikData.bgf    != null ? String(gikData.bgf).replace('.', ',') : '');
    setManGS(gikData.manualGrundstueckCost != null
      ? N2.format(gikData.manualGrundstueckCost)
      : '');
  }, [gikData]);

  useEffect(() => {
    setPreise(
      Object.fromEntries(
        Object.entries(project.vertriebPreise ?? {}).map(([k, v]) => [k, { ...v }])
      )
    );
  }, [project.vertriebPreise]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const gikMutation = useMutation(
    (body: Partial<Pick<GikData, 'grz' | 'bgf' | 'manualGrundstueckCost'>>) =>
      updateGikData(projectId, body),
    { onSuccess: () => queryClient.invalidateQueries(['gikData', projectId]) },
  );

  const preiseMutation = useMutation(
    (p: Record<string, { preisQm: string; festpreis: string }>) =>
      updateVertriebPreise(projectId, p),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['project', projectId]);
        setDirty(false);
      },
    },
  );

  // ── Computed: Gebäudekennzahlen ───────────────────────────────────────────
  const wohnflaeche = +rooms.reduce((s, r) => s + (r.dimensions?.area ?? 0), 0).toFixed(2);
  const demoPhase   = project.phases?.find((p) => p.type === 'demolition');
  const renoPhase   = project.phases?.find((p) => p.type === 'renovation');

  // ── Computed: GIK Kosten (Positionen 1–8) ────────────────────────────────
  const grundstueckCost: number | null =
    (financeSummary?.totalAcquisition ?? null) ??
    (gikData?.manualGrundstueckCost ?? null) ??
    (parseDE(manGS));

  const gikPositionen = [
    { nr: 1, label: 'Grundstück',                                       cost: grundstueckCost,                                                             editable: financeSummary?.totalAcquisition == null },
    { nr: 2, label: 'Abriss / vorbereitende Maßnahmen',                  cost: summary.phases.demolition?.subtotal ?? 0,                                   editable: false, hint: 'Entkernung' },
    { nr: 3, label: 'Baukosten [Renovierung + Sonderarbeiten]',          cost: (summary.phases.renovation?.subtotal ?? 0) + (summary.phases.specialConstruction?.subtotal ?? 0), editable: false, hint: 'Renovierung + Sonderarbeiten' },
    { nr: 4, label: 'Ausstattung',                                       cost: summary.phases.ausstellung?.subtotal    ?? 0,                                editable: false },
    { nr: 5, label: 'Planung',                                           cost: summary.phases.planungskosten?.subtotal ?? 0,                                editable: false },
    { nr: 6, label: 'Baunebenkosten',                                    cost: summary.phases.baunebenkosten?.subtotal ?? 0,                                editable: false },
    { nr: 7, label: 'Finanzierung',                                      cost: financeSummary?.totalInterest ?? null,                                       editable: false, hint: financeSummary ? undefined : 'Finanzierung nicht konfiguriert' },
    { nr: 8, label: 'Vertrieb',                                          cost: summary.phases.vertrieb?.subtotal ?? 0,                                      editable: false },
  ] as const;

  const totalKosten = gikPositionen.reduce((s, p) => s + (p.cost ?? 0), 0);
  const perM2 = (c: number | null) => (c != null && wohnflaeche > 0 ? c / wohnflaeche : null);

  // ── Computed: Erlöse ─────────────────────────────────────────────────────
  const gikUnits = buildGIKUnits(units, rooms);

  function unitErloes(weCode: string | undefined, totalArea: number) {
    const key = weCode ?? 'Dachgeschoss';
    const p   = preise[key] ?? { preisQm: '', festpreis: '' };
    const fp  = parseDE(p.festpreis);
    const qm  = parseDE(p.preisQm);
    return fp ?? (qm != null && totalArea > 0 ? +(qm * totalArea).toFixed(2) : null);
  }

  const totalWEErloes = gikUnits.reduce((s, u) => s + (unitErloes(u.weCode, u.totalArea) ?? 0), 0);

  const spAnzahl   = project.anzahlStellplaetze ?? 0;
  const spPPreis   = preise['Stellplätze'];
  const spPerStk   = parseDE(spPPreis?.festpreis ?? '');
  const spTotal    = spPerStk != null && spAnzahl > 0 ? +(spPerStk * spAnzahl).toFixed(2) : null;

  const totalErloes  = +(totalWEErloes + (spTotal ?? 0)).toFixed(2);
  const gewinn       = +(totalErloes - totalKosten).toFixed(2);
  const marge        = totalKosten > 0 ? +((gewinn / totalKosten) * 100).toFixed(2) : null;
  const isProfit     = gewinn >= 0;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveGik = () => {
    gikMutation.mutate({
      grz:  parseDE(grz)   ?? undefined,
      bgf:  parseDE(bgf)   ?? undefined,
      manualGrundstueckCost: parseDE(manGS) ?? undefined,
    });
  };

  const updatePreis = useCallback((key: string, field: 'preisQm' | 'festpreis', val: string) => {
    setPreise((prev) => ({ ...prev, [key]: { ...(prev[key] ?? { preisQm: '', festpreis: '' }), [field]: val } }));
    setDirty(true);
  }, []);

  const handleSavePreise = () => preiseMutation.mutate(preise);

  const saving = gikMutation.isLoading || preiseMutation.isLoading;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl">

      {/* ── Gebäudekennzahlen ─────────────────────────────────────────────── */}
      <Section title="Gebäudekennzahlen" accent="border-slate-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <KennzahlCard label="Wohnfläche" value={wohnflaeche > 0 ? `${n2(wohnflaeche)} m²` : '–'} />
          <KennzahlCard label="Wohneinheiten" value={String(project.anzahlWohnungen ?? 0)} />
          <KennzahlCard label="Gewerbeeinheiten" value={String(project.anzahlGewerbe ?? 0)} />
          <KennzahlCard label="PKW-Stellplätze" value={String(project.anzahlStellplaetze ?? 0)} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <EditField
            label="GRZ (Grundflächenzahl)"
            value={grz}
            onChange={setGrz}
            hint="z. B. 0,4"
          />
          <EditField
            label="BGF (Bruttogeschossfläche)"
            value={bgf}
            onChange={setBgf}
            suffix="m²"
            hint="Manuell eintragen"
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Grundstücksfläche</span>
            <span className="text-sm font-semibold text-gray-900">
              {project.grundstueckFlaeche != null ? `${n2(project.grundstueckFlaeche)} m²` : '–'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Closing',            d: fmtDate(project.timeline?.plannedStart) },
            { label: 'Beginn Abbruch',     d: fmtDate(demoPhase?.timeline?.plannedStart) },
            { label: 'Beginn Innenausbau', d: fmtDate(renoPhase?.timeline?.plannedStart) },
            { label: 'Fertigstellung',     d: fmtDate(project.timeline?.plannedEnd) },
          ].map(({ label, d }) => (
            <KennzahlCard key={label} label={label} value={d ?? '–'} muted={!d} />
          ))}
        </div>

        <button
          type="button"
          onClick={handleSaveGik}
          disabled={saving}
          className="btn btn-sm btn-primary"
        >
          {saving ? 'Wird gespeichert…' : 'GRZ / BGF speichern'}
        </button>
      </Section>

      {/* ── Gesamtinvestitionskosten ──────────────────────────────────────── */}
      <Section
        title="Gesamtinvestitionskosten"
        badge={eur(totalKosten)}
        accent="border-blue-200"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse" role="table">
            <thead>
              <tr className="bg-slate-700 text-white">
                <th className="text-center py-2 px-3 font-semibold w-8 text-xs">#</th>
                <th className="text-left   py-2 px-3 font-semibold text-xs">Position</th>
                <th className="text-right  py-2 px-3 font-semibold text-xs">Kosten brutto</th>
                <th className="text-right  py-2 px-3 font-semibold text-xs">€/m² Wfl.</th>
              </tr>
            </thead>
            <tbody>
              {gikPositionen.map((pos) => (
                <tr key={pos.nr} className="border-b border-gray-100 hover:bg-gray-50 even:bg-slate-50/40">
                  <td className="py-2.5 px-3 text-center">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-white bg-slate-600">{pos.nr}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <p className="font-medium text-gray-900">{pos.label}</p>
                    {'hint' in pos && pos.hint && <p className="text-[10px] text-gray-400 italic">{pos.hint}</p>}
                    {pos.nr === 1 && !financeSummary?.totalAcquisition && (
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={manGS}
                          onChange={(e) => setManGS(e.target.value)}
                          placeholder="0,00"
                          className="w-32 text-xs border border-gray-200 rounded px-2 py-1 bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-primary-400"
                          aria-label="Grundstückskosten manuell"
                        />
                        <span className="text-[10px] text-gray-400">€ manuell</span>
                        <button
                          type="button"
                          onClick={handleSaveGik}
                          disabled={saving}
                          className="btn btn-xs btn-secondary"
                        >
                          OK
                        </button>
                      </div>
                    )}
                    {pos.nr === 7 && !financeSummary && (
                      <Link to={`/projects/${projectId}/finance`} className="text-[10px] text-blue-600 hover:underline">
                        Finanzierung einrichten →
                      </Link>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-semibold text-gray-900">
                    {pos.cost != null ? (
                      <span className={pos.cost === 0 ? 'text-gray-300' : ''}>{eur(pos.cost)}</span>
                    ) : (
                      <span className="text-amber-500 text-xs italic">ausstehend</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-500 text-xs">
                    {perM2(pos.cost) != null ? eur(perM2(pos.cost)) : '–'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-700 text-white">
                <td />
                <td className="py-3 px-3 font-bold text-sm">Gesamtinvestitionskosten</td>
                <td className="py-3 px-3 text-right font-bold text-sm">{eur(totalKosten)}</td>
                <td className="py-3 px-3 text-right text-xs">{eur(perM2(totalKosten))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Section>

      {/* ── Erlöse WE + GE ───────────────────────────────────────────────── */}
      <Section
        title="Erlöse WE + GE"
        badge={gikUnits.length > 0 ? eur(totalWEErloes) : undefined}
        accent="border-green-200"
      >
        {gikUnits.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Keine Wohneinheiten vorhanden.</p>
        ) : (
          <>
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-sm border-collapse" role="table">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600 w-20">WE Nr.</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-gray-600">Bezeichnung</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600">Fläche m²</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600">Zimmer</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600">€/m²</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600">Erlös WE</th>
                  </tr>
                </thead>
                <tbody>
                  {gikUnits.map((u) => {
                    const key     = u.weCode ?? 'Dachgeschoss';
                    const p       = preise[key] ?? { preisQm: '', festpreis: '' };
                    const erloes  = unitErloes(u.weCode, u.totalArea);
                    return (
                      <tr key={key} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-500 text-xs">{u.type === 'DG' ? 'DG' : (u.weCode ?? '–')}</td>
                        <td className="py-2 px-3 font-medium text-gray-800">{u.title}</td>
                        <td className="py-2 px-3 text-right text-gray-600 text-xs">{u.totalArea > 0 ? `${n2(u.totalArea)} m²` : '–'}</td>
                        <td className="py-2 px-3 text-right text-gray-600 text-xs">{u.zimmer || '–'}</td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="text"
                            value={p.preisQm}
                            onChange={(e) => updatePreis(key, 'preisQm', e.target.value)}
                            placeholder="0,00"
                            className="w-24 text-xs text-right border border-gray-200 rounded px-2 py-1 bg-yellow-50 focus:outline-none focus:ring-1 focus:ring-primary-400"
                            aria-label={`€/m² für ${u.title}`}
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-gray-900 text-sm">
                          {erloes != null ? eur(erloes) : <span className="text-amber-400 text-xs">–</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-green-50 border-t-2 border-green-200">
                    <td colSpan={2} className="py-2 px-3 text-xs font-bold text-green-800">Gesamt WE + GE</td>
                    <td className="py-2 px-3 text-right text-xs text-green-700">
                      {n2(gikUnits.reduce((s, u) => s + u.totalArea, 0))} m²
                    </td>
                    <td />
                    <td />
                    <td className="py-2 px-3 text-right font-bold text-green-800">{eur(totalWEErloes)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <button
              type="button"
              onClick={handleSavePreise}
              disabled={saving || !dirty}
              className="btn btn-sm btn-success"
            >
              {preiseMutation.isLoading ? 'Wird gespeichert…' : 'Preise speichern'}
            </button>
            {dirty && <span className="ml-2 text-xs text-amber-600">Ungespeicherte Änderungen</span>}
          </>
        )}
      </Section>

      {/* ── Erlöse Stellplätze ────────────────────────────────────────────── */}
      <Section
        title="Erlöse Stellplätze"
        badge={spTotal != null ? eur(spTotal) : undefined}
        accent="border-green-200"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Anzahl Stellplätze</span>
            <span className="text-2xl font-bold text-gray-900">{spAnzahl}</span>
          </div>
          <EditField
            label="€ / Stück"
            value={preise['Stellplätze']?.festpreis ?? ''}
            onChange={(v) => updatePreis('Stellplätze', 'festpreis', v)}
            hint="Festpreis pro Stellplatz"
          />
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Erlöse gesamt</span>
            <span className="text-xl font-bold text-green-700">{spTotal != null ? eur(spTotal) : '–'}</span>
          </div>
          <button
            type="button"
            onClick={handleSavePreise}
            disabled={saving || !dirty}
            className="btn btn-sm btn-success h-fit"
          >
            {preiseMutation.isLoading ? 'Wird gespeichert…' : 'Speichern'}
          </button>
        </div>
      </Section>

      {/* ── Wirtschaftlichkeitsrechnung ───────────────────────────────────── */}
      <Section
        title="Wirtschaftlichkeitsrechnung"
        accent={isProfit ? 'border-green-300' : 'border-red-300'}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <WirtschaftCard label="Gesamterlöse" value={eur(totalErloes)} accent="text-green-700" />
          <WirtschaftCard label="Gesamtkosten" value={eur(totalKosten)} accent="text-gray-900" />
          <WirtschaftCard
            label={isProfit ? 'Gesamtgewinn' : 'Gesamtverlust'}
            value={eur(Math.abs(gewinn))}
            accent={isProfit ? 'text-green-700' : 'text-red-600'}
            bold
          />
          <WirtschaftCard
            label="Marge"
            value={marge != null ? `${N2.format(marge)} %` : '–'}
            accent={marge != null ? (marge >= 10 ? 'text-green-700' : marge >= 0 ? 'text-amber-600' : 'text-red-600') : 'text-gray-400'}
            bold
          />
          <WirtschaftCard
            label="Kosten/m²"
            value={wohnflaeche > 0 ? eur(totalKosten / wohnflaeche) : '–'}
            accent="text-blue-700"
          />
        </div>

        {/* Zusammenfassung-Balken */}
        {totalErloes > 0 && totalKosten > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
              <span>Kosten</span>
              <span>Erlöse</span>
            </div>
            <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`absolute left-0 h-full rounded-full transition-all ${isProfit ? 'bg-green-500' : 'bg-red-400'}`}
                style={{ width: `${Math.min(100, (totalKosten / totalErloes) * 100).toFixed(1)}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1 text-right">
              Kosten = {N2.format((totalKosten / totalErloes) * 100)} % der Erlöse
            </p>
          </div>
        )}
      </Section>
    </div>
  );
}

// ─── Hilfs-Karten ─────────────────────────────────────────────────────────────

function KennzahlCard({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">{label}</p>
      <p className={`text-sm font-semibold ${muted ? 'text-gray-300 italic' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

function WirtschaftCard({ label, value, accent, bold = false }: { label: string; value: string; accent: string; bold?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{label}</p>
      <p className={`text-base leading-tight ${bold ? 'font-bold' : 'font-semibold'} ${accent}`}>{value}</p>
    </div>
  );
}
