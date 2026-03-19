import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { getProject, getUnits, getRooms, getFloors } from '../api/projects';
import type { Unit, Room, Floor } from '../types';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Extract the WE-key from a unit (number or name). Returns e.g. "WE01" or null. */
function getWeKey(unit: Unit): string | null {
  const candidates = [unit.number ?? '', unit.name ?? ''];
  for (const s of candidates) {
    const m = s.toUpperCase().match(/\b(WE\d+[A-Z]?)\b/);
    if (m) return m[1];
  }
  return null;
}

/** Returns true if the unit is a Dachgeschoss (without a WE-key). */
function isDachgeschoss(unit: Unit): boolean {
  const n = (unit.name ?? '').toLowerCase();
  const num = (unit.number ?? '').toLowerCase();
  return /\b(dachgeschoss|dachgeschoß|dg)\b/.test(n) || /\b(dachgeschoss|dachgeschoß|dg)\b/.test(num);
}

/** Numeric sort helper for WE-keys: WE1 < WE1a < WE02 < WE10 */
function weOrder(key: string): [number, string] {
  const m = key.match(/^WE(\d+)([A-Za-z]*)$/i);
  if (m) return [parseInt(m[1], 10), m[2].toLowerCase()];
  return [9999, key];
}

/** Format number as German locale with 2 decimals + m² */
function fmtM2(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m²';
}

/** Get floor area of a room (dimensions.area, never wall area). */
function roomArea(r: Room): number | null {
  return r.dimensions?.area ?? null;
}

/** Resolve unitId string from a room */
function roomUnitId(r: Room): string | null {
  if (!r.unitId) return null;
  return typeof r.unitId === 'string' ? r.unitId : (r.unitId as Unit)._id;
}

// ── Price storage (localStorage) ────────────────────────────────────────────

type PriceEntry = { preisQm: string; festpreis: string };
type PriceMap   = Record<string, PriceEntry>; // key → prices

function loadPrices(projectId: string): PriceMap {
  try {
    const raw = localStorage.getItem(`vertrieb_prices_${projectId}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function savePrices(projectId: string, map: PriceMap) {
  localStorage.setItem(`vertrieb_prices_${projectId}`, JSON.stringify(map));
}

// ── Sub-components ───────────────────────────────────────────────────────────

interface UnitEntry {
  key: string;           // "WE01" | "Dachgeschoss"
  displayTitle: string;  // "WE01" | "Dachgeschoss"
  unitName: string;      // e.g. "EG links"
  rooms: Room[];
  totalArea: number;
  hasDualFields: boolean; // WE + DG → true; Stellplätze → false
}

/** Parse a price string (German or English decimal) → number or null */
function parsePrice(s: string): number | null {
  if (!s.trim()) return null;
  // Replace German decimal comma, strip thousands separators
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
}

/** Format euro amount */
function fmtEur(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

interface PriceFieldsProps {
  entryKey: string;
  prices: PriceMap;
  hasDualFields: boolean;   // true = WE/DG (has €/m² + Erlös pro WE); false = Stellplätze
  totalArea: number;        // used for WE/DG m²-calculation
  stellplaetzeCount?: number; // only for Stellplätze: multiplies Erlöse(Stück) → total
  onChange: (key: string, field: 'preisQm' | 'festpreis', val: string) => void;
}
function PriceFields({ entryKey, prices, hasDualFields, totalArea, stellplaetzeCount, onChange }: PriceFieldsProps) {
  const p = prices[entryKey] ?? { preisQm: '', festpreis: '' };

  const isStellplaetze = stellplaetzeCount !== undefined;
  const festpreisLabel = isStellplaetze ? 'Erlöse (Stück) in €' : 'Erlös pro WE in €';

  // Compute display sum
  let sum: string | null = null;
  let sumLabel = '';
  if (isStellplaetze) {
    // Erlöse(Stück) × Anzahl Stellplätze
    const erloesStuck = parsePrice(p.festpreis);
    if (erloesStuck != null && stellplaetzeCount > 0) {
      sum = fmtEur(erloesStuck * stellplaetzeCount);
      sumLabel = 'Erlös gesamt';
    } else {
      sumLabel = 'Erlös gesamt';
    }
  } else {
    // WE / DG: Erlös pro WE has priority; else m² × €/m²
    const erloes = parsePrice(p.festpreis);
    const preisQm = parsePrice(p.preisQm);
    if (erloes != null) {
      sum = fmtEur(erloes);
      sumLabel = 'Erlös pro WE';
    } else if (preisQm != null && totalArea > 0) {
      sum = fmtEur(preisQm * totalArea);
      sumLabel = 'Summe (m² × Preis)';
    } else {
      sumLabel = 'Erlös';
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-end gap-3">
      {hasDualFields && (
        <label className="flex flex-col gap-0.5 text-xs text-gray-500">
          €/Quadratmeter
          <input
            type="text"
            value={p.preisQm}
            onChange={e => onChange(entryKey, 'preisQm', e.target.value)}
            placeholder="0,00"
            className="w-36 px-2 py-1 border border-gray-200 rounded text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
        </label>
      )}
      <label className="flex flex-col gap-0.5 text-xs text-gray-500">
        {festpreisLabel}
        <input
          type="text"
          value={p.festpreis}
          onChange={e => onChange(entryKey, 'festpreis', e.target.value)}
          placeholder="0,00"
          className="w-36 px-2 py-1 border border-gray-200 rounded text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </label>
      {/* Calculated sum */}
      <div className="flex flex-col gap-0.5 text-xs text-gray-500">
        {sumLabel}
        <div className={`px-3 py-1 rounded text-sm font-semibold border ${
          sum
            ? 'bg-primary-50 border-primary-200 text-primary-800'
            : 'bg-gray-50 border-gray-200 text-gray-400 italic font-normal'
        }`}>
          {sum ?? '–'}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function VertriebMaterialPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const { data: project }  = useQuery(['project', projectId],        () => getProject(projectId!));
  const { data: units = [] } = useQuery(['units', projectId],        () => getUnits(projectId!));
  const { data: rooms = [] } = useQuery(['rooms', projectId],        () => getRooms(projectId!));
  const { data: floors = [] } = useQuery(['floors', projectId],      () => getFloors(projectId!));

  const [prices, setPrices] = useState<PriceMap>({});

  // Load prices from localStorage once projectId is known
  useEffect(() => {
    if (projectId) setPrices(loadPrices(projectId));
  }, [projectId]);

  const handlePriceChange = (key: string, field: 'preisQm' | 'festpreis', val: string) => {
    setPrices(prev => {
      const next = {
        ...prev,
        [key]: { ...(prev[key] ?? { preisQm: '', festpreis: '' }), [field]: val },
      };
      if (projectId) savePrices(projectId, next);
      return next;
    });
  };

  // ── Build entries ──────────────────────────────────────────────────────────
  const entries = useMemo<UnitEntry[]>(() => {
    const floorById: Record<string, Floor> = {};
    for (const f of floors as Floor[]) floorById[f._id] = f;

    const weEntries: UnitEntry[]  = [];
    const dgEntries: UnitEntry[]  = [];
    const warnings: string[]      = [];

    for (const u of units as Unit[]) {
      const weKey = getWeKey(u);
      const isDg  = isDachgeschoss(u);

      const unitRooms = (rooms as Room[]).filter(r => roomUnitId(r) === u._id);

      // Deduplicate rooms by name (add areas)
      const deduped = new Map<string, { name: string; area: number | null }>();
      for (const r of unitRooms) {
        const area = roomArea(r);
        if (deduped.has(r.name)) {
          const existing = deduped.get(r.name)!;
          deduped.set(r.name, {
            name: r.name,
            area: existing.area != null && area != null ? +(existing.area + area).toFixed(2)
                : existing.area ?? area,
          });
        } else {
          deduped.set(r.name, { name: r.name, area });
        }
      }
      const dedupedRooms = Array.from(deduped.values());
      const totalArea = +dedupedRooms.reduce((s, r) => s + (r.area ?? 0), 0).toFixed(2);

      if (weKey && isDg) {
        // Has both WE-key and DG name → WE sort order, title = "Dachgeschoss"
        dgEntries.push({
          key: weKey,
          displayTitle: 'Dachgeschoss',
          unitName: u.name,
          rooms: unitRooms,
          totalArea,
          hasDualFields: true,
        });
      } else if (weKey) {
        // Check for duplicate WE keys
        if (weEntries.some(e => e.key === weKey)) {
          warnings.push(`Doppelte WE-Kennung: ${weKey} – Eintrag übersprungen`);
          continue;
        }
        weEntries.push({
          key: weKey,
          displayTitle: weKey,
          unitName: u.name,
          rooms: unitRooms,
          totalArea,
          hasDualFields: true,
        });
      } else if (isDg) {
        if (dgEntries.some(e => e.key === 'Dachgeschoss')) {
          // Consolidate: add rooms to existing DG entry
          const existing = dgEntries.find(e => e.key === 'Dachgeschoss')!;
          existing.rooms = [...existing.rooms, ...unitRooms];
          existing.totalArea = +(existing.totalArea + totalArea).toFixed(2);
        } else {
          dgEntries.push({
            key: 'Dachgeschoss',
            displayTitle: 'Dachgeschoss',
            unitName: u.name,
            rooms: unitRooms,
            totalArea,
            hasDualFields: true,
          });
        }
      }
      // Units without WE-key and not DG are ignored (floor-level rooms shown elsewhere)
    }

    // Sort WE numerically, DG after
    weEntries.sort((a, b) => {
      const [an, as_] = weOrder(a.key);
      const [bn, bs]  = weOrder(b.key);
      return an !== bn ? an - bn : as_ < bs ? -1 : as_ > bs ? 1 : 0;
    });

    return [...weEntries, ...dgEntries];
  }, [units, rooms, floors]);

  const stellplaetze = project?.anzahlStellplaetze ?? 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to={`/projects/${projectId}`} className="hover:text-primary-600">
          {project?.name ?? 'Projekt'}
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">Vertrieb</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Vertrieb</h1>
        <span className="text-sm text-gray-400">{entries.length} Einheiten · {stellplaetze} Stellplätze</span>
      </div>

      {entries.length === 0 && (
        <div className="card text-center py-12 text-gray-400">
          <p>Keine Wohnungen oder Dachgeschoss-Einheiten gefunden.</p>
          <p className="text-sm mt-1">Wohneinheiten werden erkannt, wenn ihr Name oder Nummer „WE…", „DG", „Dachgeschoss" enthält.</p>
        </div>
      )}

      <div className="space-y-4">
        {entries.map(entry => {
          const dedupedMap = new Map<string, number | null>();
          for (const r of entry.rooms) {
            const a = roomArea(r);
            if (dedupedMap.has(r.name)) {
              const ex = dedupedMap.get(r.name);
              dedupedMap.set(r.name, ex != null && a != null ? +(ex + a).toFixed(2) : ex ?? a);
            } else {
              dedupedMap.set(r.name, a);
            }
          }
          const roomList = Array.from(dedupedMap.entries());

          return (
            <div key={entry.key} className="card">
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {entry.displayTitle}
                    {entry.unitName && entry.displayTitle !== entry.unitName && (
                      <span className="ml-2 text-sm font-normal text-gray-500">{entry.unitName}</span>
                    )}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {roomList.length} {roomList.length === 1 ? 'Raum' : 'Räume'} —{' '}
                    Wohnfläche gesamt: <span className="font-medium text-emerald-700">{fmtM2(entry.totalArea)}</span>
                  </p>
                </div>
                <span className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full px-3 py-0.5 font-semibold whitespace-nowrap">
                  {fmtM2(entry.totalArea)}
                </span>
              </div>

              {/* Room list */}
              {roomList.length > 0 ? (
                <ul className="divide-y divide-gray-50 mb-1">
                  {roomList.map(([name, area]) => (
                    <li key={name} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="text-gray-700">{name}</span>
                      <span className={area != null ? 'text-gray-600 font-medium' : 'text-gray-400 italic'}>
                        {area != null ? fmtM2(area) : 'Größe unbekannt'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 italic mb-1">Keine Räume zugeordnet.</p>
              )}

              {/* Price fields */}
              <PriceFields
                entryKey={entry.key}
                prices={prices}
                hasDualFields={entry.hasDualFields}
                totalArea={entry.totalArea}
                onChange={handlePriceChange}
              />
            </div>
          );
        })}

        {/* Stellplätze */}
        <div className="card border-dashed">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Stellplätze</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Anzahl:{' '}
                <span className="font-semibold text-gray-800">{stellplaetze}</span>
              </p>
            </div>
            {stellplaetze > 0 && (
              <span className="text-xs bg-gray-100 border border-gray-200 text-gray-600 rounded-full px-3 py-0.5 font-semibold whitespace-nowrap">
                {stellplaetze} Stück
              </span>
            )}
          </div>
          <PriceFields
            entryKey="Stellplätze"
            prices={prices}
            hasDualFields={false}
            totalArea={0}
            stellplaetzeCount={stellplaetze}
            onChange={handlePriceChange}
          />
        </div>
      </div>
    </div>
  );
}
