import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from 'react-query';
import { copyUnit } from '../api/projects';
import type { Unit, Floor } from '../types';

interface Props {
  projectId: string;
  sourceUnit: Unit;
  /** Alle Etagen des Projekts (für Ziel-Dropdown) */
  floors: Floor[];
  /** Alle vorhandenen Wohnungen (für Vorschau-Namen-Konflikt-Prüfung) */
  allUnits: Unit[];
  onClose: () => void;
}

/** Gibt die Etagen-ID der Quelle zurück (Wert oder Objekt). */
function getFloorId(floorRef: Floor | string): string {
  return typeof floorRef === 'string' ? floorRef : floorRef._id;
}

/** Gibt den Etagen-Level zurück. */
function getFloorLevel(floors: Floor[], floorId: string): number {
  return floors.find(f => f._id === floorId)?.level ?? 0;
}

/** Nächste logische Wohnungsnummer aus vorhandenen Nummern vorschlagen. */
function suggestNextUnitNumber(existingNumbers: string[]): string {
  const nums = existingNumbers.filter(Boolean);
  if (nums.length === 0) return '';
  const parsed = nums.map(n => {
    const m = n.match(/^([A-Za-z\-_]*)(\d+)([A-Za-z\-_]*)$/);
    if (!m) return null;
    return { prefix: m[1], num: parseInt(m[2], 10), pad: m[2].length, suffix: m[3] };
  }).filter(Boolean) as { prefix: string; num: number; pad: number; suffix: string }[];
  if (parsed.length === 0) return '';
  const first = parsed[0];
  if (!parsed.every(p => p.prefix === first.prefix && p.suffix === first.suffix)) return '';
  const nextNum = Math.max(...parsed.map(p => p.num)) + 1;
  return `${first.prefix}${String(nextNum).padStart(first.pad, '0')}${first.suffix}`;
}

/** Etagenkürzel (muss mit Backend-copyUtils übereinstimmen). */
function floorAbbrev(level: number): string {
  if (level === -3) return 'TG2';
  if (level === -2) return 'TG';
  if (level === -1) return 'KG';
  if (level ===  0) return 'EG';
  if (level === 20) return 'DG';
  if (level >= 1 && level <= 19) return `${level}.OG`;
  return `E${level}`;
}

/** Vorschau des generierten Namens (spiegelt Backend-Logik). */
function previewName(
  sourceName: string,
  sourceLevel: number,
  targetLevel: number,
  existingNames: string[]
): string {
  const existing = new Set(existingNames);

  function sameFloor() {
    const match = sourceName.match(/^([\s\S]*?)(\d+)$/);
    if (match) {
      const base = match[1];
      let n = parseInt(match[2], 10) + 1;
      let c = `${base}${n}`;
      while (existing.has(c)) { n++; c = `${base}${n}`; }
      return c;
    }
    return kopie(sourceName);
  }

  function otherFloor() {
    const src = floorAbbrev(sourceLevel);
    const tgt = floorAbbrev(targetLevel);
    const re = new RegExp(`(${escRe(src)})(\\d+)(?!.*${escRe(src)}\\d)`);
    let candidate: string;
    if (re.test(sourceName)) {
      candidate = sourceName.replace(re, `${tgt}1`);
    } else {
      const trailing = sourceName.match(/^([\s\S]*?)(\d+)$/);
      candidate = trailing ? `${trailing[1]}${tgt}1` : `${sourceName} ${tgt}1`;
    }
    if (!existing.has(candidate)) return candidate;
    const base = candidate.replace(new RegExp(`${escRe(tgt)}\\d+$`), tgt);
    let n = 2;
    let next = `${base}${n}`;
    while (existing.has(next)) { n++; next = `${base}${n}`; }
    return next;
  }

  function kopie(name: string) {
    let c = `${name} (Kopie)`;
    let n = 2;
    while (existing.has(c)) { c = `${name} (Kopie ${n++})`; }
    return c;
  }

  function escRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  return sourceLevel === targetLevel ? sameFloor() : otherFloor();
}

export default function CopyApartmentDialog({ projectId, sourceUnit, floors, allUnits, onClose }: Props) {
  const qc = useQueryClient();
  const sourceFloorId = getFloorId(sourceUnit.floorId);
  const sourceLevel   = getFloorLevel(floors, sourceFloorId);

  const [targetFloorId, setTargetFloorId] = useState(sourceFloorId);
  const [copyRooms, setCopyRooms]         = useState(true);
  const [nameOverride, setNameOverride]   = useState('');
  const [numberOverride, setNumberOverride] = useState('');

  // Vorschau-Name bei jedem Wechsel der Ziel-Etage neu berechnen
  const targetLevel = getFloorLevel(floors, targetFloorId);
  const existingInTarget = allUnits
    .filter(u => getFloorId(u.floorId) === targetFloorId)
    .map(u => u.name);
  const suggestedName = previewName(sourceUnit.name, sourceLevel, targetLevel, existingInTarget);
  const suggestedNumber = suggestNextUnitNumber(allUnits.map(u => u.number || ''));

  // Wenn Etage wechselt → Name-Override zurücksetzen
  useEffect(() => { setNameOverride(''); }, [targetFloorId]);

  const finalName   = nameOverride.trim()   || suggestedName;
  const finalNumber = numberOverride.trim() || suggestedNumber || undefined;

  const mutation = useMutation(
    () => copyUnit(projectId, sourceUnit._id, {
      targetFloorId,
      newName: finalName,
      newNumber: finalNumber,
      copyRooms,
    }),
    {
      onSuccess: () => {
        qc.invalidateQueries(['units', projectId]);
        qc.invalidateQueries(['rooms', projectId]);
        onClose();
      },
    }
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 mt-16">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-lg text-slate-800">Wohnung kopieren</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            title="Schließen"
          >×</button>
        </div>

        {/* Quelle */}
        <p className="text-sm text-slate-500 mb-4">
          Quelle: <span className="font-medium text-slate-700">{sourceUnit.name}</span>
        </p>

        <div className="space-y-4">

          {/* Ziel-Etage */}
          <div>
            <label className="label">Ziel-Etage</label>
            <select
              value={targetFloorId}
              onChange={e => setTargetFloorId(e.target.value)}
              className="input"
            >
              {floors.map(f => (
                <option key={f._id} value={f._id}>
                  {f.name}{f._id === sourceFloorId ? ' (aktuelle Etage)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Neue Wohnungsnummer */}
          {(sourceUnit.number || suggestedNumber) && (
            <div>
              <label className="label">Neue Wohnungsnummer</label>
              <input
                value={numberOverride}
                onChange={e => setNumberOverride(e.target.value)}
                placeholder={suggestedNumber || sourceUnit.number}
                className="input"
              />
              {!numberOverride.trim() && suggestedNumber && (
                <p className="text-xs text-slate-400 mt-1">Vorschlag: „{suggestedNumber}"</p>
              )}
            </div>
          )}

          {/* Neuer Name */}
          <div>
            <label className="label">Neuer Name</label>
            <input
              value={nameOverride}
              onChange={e => setNameOverride(e.target.value)}
              placeholder={suggestedName}
              className="input"
            />
            {!nameOverride.trim() && (
              <p className="text-xs text-slate-400 mt-1">Vorschlag: „{suggestedName}"</p>
            )}
          </div>

          {/* Räume mitkopieren */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={copyRooms}
              onChange={e => setCopyRooms(e.target.checked)}
              className="w-4 h-4 accent-primary-600"
            />
            <span className="text-sm text-slate-700">Räume mitkopieren</span>
          </label>

        </div>

        {/* Fehler */}
        {mutation.isError && (
          <p className="mt-3 text-sm text-red-600">
            Fehler beim Kopieren. Bitte erneut versuchen.
          </p>
        )}

        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isLoading || !finalName}
            className="btn-primary flex-1"
          >
            {mutation.isLoading ? 'Kopiere…' : 'Wohnung kopieren'}
          </button>
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
        </div>

      </div>
    </div>
  );
}
