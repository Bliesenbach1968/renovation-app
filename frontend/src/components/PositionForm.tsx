import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useSearchParams } from 'react-router-dom';
import { createPosition, updatePosition, getTemplates, createTemplate } from '../api/projects';
import type { Floor, Room, Position, PositionTemplate, PhaseType, PositionUnit } from '../types';
import { BEREICHE_ENTKERNUNG_RENOVIERUNG, BEREICHE_HIERARCHIE } from '../data/bereiche';

const UNITS: PositionUnit[] = ['m²', 'm³', 'lfm', 'Stück', 'Sack', 'kg', 'Psch', 't'];

// Positionsnamen, bei denen eine Dickenangabe (mm) sinnvoll ist
const THICKNESS_KEYWORDS = [
  'estrich', 'dämmung', 'dämmstoff', 'wärmedämmung', 'trittschalldämmung',
  'putz', 'glattstrich', 'beton', 'abdichtung', 'bodenplatte', 'bodenaufbau',
  'spachtel', 'ausgleichsmasse', 'wandaufbau', 'deckenaufbau', 'unterboden',
];
function hasThicknessField(name: string) {
  const lower = (name || '').toLowerCase();
  return THICKNESS_KEYWORDS.some(k => lower.includes(k));
}
// Prüft ob der Name bereits eine eingebettete mm-Angabe enthält (nicht am Ende – z.B. "Standard 60mm")
function nameHasEmbeddedThickness(name: string) {
  const stripped = (name || '').replace(/\s*\(\d+\s*mm\)$/i, '');
  return /\d+\s*mm/i.test(stripped);
}
const PHASE_LABELS: Record<string, string> = {
  demolition: 'Entkernung', renovation: 'Renovierung', specialConstruction: 'Sonderarbeiten', all: 'Alle Phasen',
};

export const BEREICHE_SONDERARBEITEN = ['Dachausbau', 'Balkone', 'Betonsanierung', 'Container & Entsorgung', 'Gerüst', 'Kran'];
// Legacy-Exporte für Kompatibilität
export const BEREICH_UNTERPUNKTE: Record<string, string[]> = {};

export function getBereicheForPhase(phase: string, _projectFloors: Floor[] = []): string[] {
  return phase === 'specialConstruction'
    ? BEREICHE_SONDERARBEITEN
    : BEREICHE_ENTKERNUNG_RENOVIERUNG;
}

interface Props {
  projectId: string;
  roomId?: string;
  rooms?: Room[];
  phaseType: PhaseType;
  templates: PositionTemplate[];
  editPosition: Position | null;
  initialTemplate?: PositionTemplate | null;
  defaultHourlyRate: number;
  roomDimensions?: { length?: number; width?: number; height?: number; area?: number; volume?: number };
  projectFloors?: Floor[];
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  name: string; category: string; bereich: string; bereichUnterpunkt: string; description: string;
  unit: PositionUnit; quantity: number; estrichThickness: number;
  materialCostPerUnit: number; disposalCostPerUnit: number;
  laborHoursPerUnit: number; laborHourlyRate: number;
  templateId: string;
}

function calcPreview(v: Partial<FormValues>) {
  const qty = +(v.quantity ?? 0);
  const mat = +(qty * (v.materialCostPerUnit ?? 0)).toFixed(2);
  const dis = +(qty * (v.disposalCostPerUnit ?? 0)).toFixed(2);
  const lab = +(qty * (v.laborHoursPerUnit ?? 0) * (v.laborHourlyRate ?? 0)).toFixed(2);
  return { mat, dis, lab, total: +(mat + dis + lab).toFixed(2) };
}

export default function PositionForm({
  projectId, roomId, rooms, phaseType, templates, editPosition, initialTemplate,
  defaultHourlyRate, roomDimensions, projectFloors = [], onClose, onSuccess,
}: Props) {
  const isEdit = !!editPosition;
  const qc = useQueryClient();
  const [internalRoomId, setInternalRoomId] = useState(roomId || '');

  const [searchParams] = useSearchParams();
  const urlBereich = searchParams.get('bereich') || '';
  const urlUnterpunkt = searchParams.get('unterpunkt') || '';

  const floorArea = roomDimensions?.area ?? (roomDimensions?.length && roomDimensions?.width
    ? +(roomDimensions.length * roomDimensions.width).toFixed(2) : undefined);
  const wallArea = roomDimensions?.length && roomDimensions?.width && roomDimensions?.height
    ? +(2 * (roomDimensions.length + roomDimensions.width) * roomDimensions.height).toFixed(2)
    : undefined;
  const perimeter = roomDimensions?.length && roomDimensions?.width
    ? +(2 * (roomDimensions.length + roomDimensions.width)).toFixed(2)
    : undefined;

  // Parse existing bereichUnterpunkt into sub-levels for cascading dropdowns
  const initUnterpunkt = editPosition?.bereichUnterpunkt || initialTemplate?.bereichUnterpunkt || urlUnterpunkt || '';
  const initParts = initUnterpunkt ? initUnterpunkt.split(' > ') : [];
  const [sub1, setSub1] = useState(initParts[0] || '');
  const [sub2, setSub2] = useState(initParts[1] || '');
  const [sub3, setSub3] = useState(initParts[2] || '');

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: editPosition
      ? {
          name: editPosition.name, category: editPosition.category,
          bereich: editPosition.bereich || '',
          bereichUnterpunkt: editPosition.bereichUnterpunkt || '',
          description: editPosition.description,
          unit: editPosition.unit, quantity: editPosition.quantity, estrichThickness: editPosition.estrichThickness,
          materialCostPerUnit: editPosition.materialCostPerUnit, disposalCostPerUnit: editPosition.disposalCostPerUnit,
          laborHoursPerUnit: editPosition.laborHoursPerUnit, laborHourlyRate: editPosition.laborHourlyRate,
        }
      : initialTemplate
      ? {
          name: initialTemplate.name, category: initialTemplate.category || '',
          bereich: initialTemplate.bereich || urlBereich,
          bereichUnterpunkt: initialTemplate.bereichUnterpunkt || '', description: '',
          unit: initialTemplate.unit, quantity: 0, estrichThickness: 45,
          materialCostPerUnit: initialTemplate.materialCostPerUnit,
          disposalCostPerUnit: initialTemplate.disposalCostPerUnit,
          laborHoursPerUnit: initialTemplate.laborHoursPerUnit,
          laborHourlyRate: initialTemplate.laborHourlyRate || defaultHourlyRate,
        }
      : {
          unit: 'm²', quantity: 0, laborHourlyRate: defaultHourlyRate, estrichThickness: 45,
          materialCostPerUnit: 0, disposalCostPerUnit: 0, laborHoursPerUnit: 0,
          bereich: urlBereich, bereichUnterpunkt: '',
        },
  });

  const watchedValues = watch();
  const preview = calcPreview(watchedValues);
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const bereiche = getBereicheForPhase(phaseType, projectFloors);

  // Cascading dropdown options
  const sub1Options = watchedValues.bereich ? (BEREICHE_HIERARCHIE[watchedValues.bereich] ?? []) : [];
  const sub1Node = sub1Options.find(n => n.label === sub1);
  const sub2Options = sub1Node?.children ?? [];
  const sub2Node = sub2Options.find(n => n.label === sub2);
  const sub3Options = sub2Node?.children ?? [];

  const handleSub1Change = (val: string) => {
    setSub1(val); setSub2(''); setSub3('');
    setValue('bereichUnterpunkt', val);
  };
  const handleSub2Change = (val: string) => {
    setSub2(val); setSub3('');
    setValue('bereichUnterpunkt', [sub1, val].filter(Boolean).join(' > '));
  };
  const handleSub3Change = (val: string) => {
    setSub3(val);
    setValue('bereichUnterpunkt', [sub1, sub2, val].filter(Boolean).join(' > '));
  };

  // Wenn Dicke-Feld eingeblendet wird und noch leer → Standardwert 60 setzen
  // (nur wenn der Name keine eingebettete mm-Angabe hat)
  const watchedName = watch('name');
  useEffect(() => {
    if (hasThicknessField(watchedName) && !nameHasEmbeddedThickness(watchedName) && !watchedValues.estrichThickness) {
      setValue('estrichThickness', 60);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedName]);

  // Wenn Dicke geändert wird → Name live aktualisieren (z.B. "Estrich entfernen (45 mm)")
  // (nicht wenn der Name bereits eine eingebettete mm-Angabe enthält)
  const watchedThickness = watch('estrichThickness');
  useEffect(() => {
    const currentName = watchedValues.name || '';
    if (!hasThicknessField(currentName)) return;
    if (nameHasEmbeddedThickness(currentName)) return;
    const baseName = currentName.replace(/\s*\(\d+\s*mm\)$/i, '').trim();
    const newName = watchedThickness ? `${baseName} (${watchedThickness} mm)` : baseName;
    if (newName !== currentName) {
      setValue('name', newName);
      setNameInput(newName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedThickness]);

  const { data: allTemplates = [] } = useQuery(['templates', 'all'], () => getTemplates());

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAllPhases, setShowAllPhases] = useState(false);
  const [nameInput, setNameInput] = useState(editPosition?.name || '');
  const suggestRef = useRef<HTMLDivElement>(null);

  // Phase- und Bereich-Filter für Vorlagen
  const phaseFiltered = showAllPhases
    ? allTemplates
    : allTemplates.filter(t =>
        (t.phaseType === phaseType || t.phaseType === 'all') &&
        (!watchedValues.bereich || !t.bereich || t.bereich === watchedValues.bereich)
      );

  const suggestions = nameInput.length >= 1
    ? phaseFiltered.filter(t =>
        t.name.toLowerCase().includes(nameInput.toLowerCase()) ||
        t.category.toLowerCase().includes(nameInput.toLowerCase())
      ).slice(0, 15)
    : phaseFiltered.slice(0, 30);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node))
        setShowSuggestions(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const applyTemplate = (t: PositionTemplate) => {
    const displayName = (t.estrichThickness && !nameHasEmbeddedThickness(t.name))
      ? `${t.name} (${t.estrichThickness} mm)`
      : t.name;
    setValue('name', displayName);
    setNameInput(displayName);
    if (t.estrichThickness) setValue('estrichThickness', t.estrichThickness);
    setValue('category', t.category);
    if (t.bereich) setValue('bereich', t.bereich);
    if (t.bereichUnterpunkt) {
      setValue('bereichUnterpunkt', t.bereichUnterpunkt);
      const parts = t.bereichUnterpunkt.split(' > ');
      setSub1(parts[0] || ''); setSub2(parts[1] || ''); setSub3(parts[2] || '');
    }
    setValue('unit', t.unit);
    setValue('materialCostPerUnit', t.materialCostPerUnit);
    setValue('disposalCostPerUnit', t.disposalCostPerUnit);
    setValue('laborHoursPerUnit', t.laborHoursPerUnit);
    setValue('laborHourlyRate', t.laborHourlyRate);
    setValue('description', t.description || '');
    setSelectedTemplate(t._id);
    setShowSuggestions(false);
    const cat = t.category.toLowerCase();
    if (t.unit === 'm²') {
      setValue('quantity', cat.includes('wand') ? (wallArea ?? floorArea ?? 0) : (floorArea ?? 0));
    } else if (t.unit === 'lfm') {
      setValue('quantity', perimeter ?? 0);
    } else if (t.unit === 'm³') {
      setValue('quantity', roomDimensions?.volume ?? 0);
    }
  };

  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [savePhaseType, setSavePhaseType] = useState<string>(phaseType);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const saveTemplateMutation = useMutation(
    () => createTemplate({
      name: watchedValues.name,
      category: watchedValues.category,
      bereich: watchedValues.bereich || undefined,
      bereichUnterpunkt: watchedValues.bereichUnterpunkt || undefined,
      description: watchedValues.description || undefined,
      unit: watchedValues.unit,
      phaseType: savePhaseType as any,
      materialCostPerUnit: +watchedValues.materialCostPerUnit,
      disposalCostPerUnit: +watchedValues.disposalCostPerUnit,
      laborHoursPerUnit: +watchedValues.laborHoursPerUnit,
      laborHourlyRate: +watchedValues.laborHourlyRate,
      isSystemDefault: false,
    }),
    {
      onSuccess: () => {
        qc.invalidateQueries(['templates']);
        setShowSaveTemplate(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      },
    }
  );

  const mutation = useMutation(
    (body: Partial<Position>) =>
      isEdit ? updatePosition(projectId, editPosition!._id, body) : createPosition(projectId, body),
    { onSuccess }
  );

  const effectiveRoomId = roomId || internalRoomId;

  const onSubmit = (data: FormValues) => {
    mutation.mutate({
      ...data, roomId: effectiveRoomId || undefined, phaseType,
      templateId: selectedTemplate || undefined,
      bereich: data.bereich || undefined,
      bereichUnterpunkt: data.bereichUnterpunkt || undefined,
    } as any);
  };

  const grouped = suggestions.reduce((acc, t) => {
    const key = t.bereich || t.category || 'Sonstige';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, PositionTemplate[]>);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="font-semibold text-lg">{isEdit ? 'Position bearbeiten' : 'Neue Position'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

            {/* Raum */}
            {!roomId && rooms && rooms.length > 0 && (
              <div className="col-span-2 md:col-span-3">
                <label className="label">Raum (optional)</label>
                <select value={internalRoomId} onChange={(e) => setInternalRoomId(e.target.value)} className="input">
                  <option value="">– Raum auswählen –</option>
                  {rooms.map(r => (
                    <option key={r._id} value={r._id}>
                      {r.name}{r.dimensions?.area ? ` (${r.dimensions.area} m²)` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Bereich – kaskadierend im Grid */}
            <div>
              <label className="label">Bereich</label>
              <select
                {...register('bereich')}
                className="input"
                onChange={(e) => { setValue('bereich', e.target.value); setValue('bereichUnterpunkt', ''); setSub1(''); setSub2(''); setSub3(''); }}
              >
                <option value="">– kein Bereich –</option>
                {bereiche.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {sub1Options.length > 0 && (
              <div>
                <label className="label">Unterkategorie</label>
                <select value={sub1} onChange={(e) => handleSub1Change(e.target.value)} className="input">
                  <option value="">– bitte wählen –</option>
                  {sub1Options.map((n) => <option key={n.label} value={n.label}>{n.label}</option>)}
                </select>
              </div>
            )}
            {sub1 && sub2Options.length > 0 && (
              <div>
                <label className="label">Detail</label>
                <select value={sub2} onChange={(e) => handleSub2Change(e.target.value)} className="input">
                  <option value="">– bitte wählen –</option>
                  {sub2Options.map((n) => <option key={n.label} value={n.label}>{n.label}</option>)}
                </select>
              </div>
            )}
            {sub2 && sub3Options.length > 0 && (
              <div>
                <label className="label">Spezifikation</label>
                <select value={sub3} onChange={(e) => handleSub3Change(e.target.value)} className="input">
                  <option value="">– bitte wählen –</option>
                  {sub3Options.map((n) => <option key={n.label} value={n.label}>{n.label}</option>)}
                </select>
              </div>
            )}

            {/* Bezeichnung – col-span-2 mit Autocomplete */}
            <div className="col-span-2 relative" ref={suggestRef}>
              <label className="label">Bezeichnung *</label>
              <input
                {...register('name', { required: 'Pflichtfeld' })}
                value={nameInput}
                onChange={(e) => { setNameInput(e.target.value); setValue('name', e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                className="input"
                placeholder="Tippen zum Suchen oder aus Vorlagen wählen…"
                autoComplete="off"
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              {showSuggestions && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-100 sticky top-0">
                    <span className="text-xs text-gray-500">
                      {showAllPhases
                        ? `Alle Phasen · ${suggestions.length} Vorlagen`
                        : `${PHASE_LABELS[phaseType]}${watchedValues.bereich ? ` · ${watchedValues.bereich}` : ''} · ${suggestions.length} Vorlagen`}
                    </span>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setShowAllPhases(v => !v); }}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${showAllPhases ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-primary-600 border-primary-300 hover:bg-primary-50'}`}
                    >
                      {showAllPhases ? 'Nur diese Phase' : 'Alle Positionen anzeigen'}
                    </button>
                  </div>
                  {suggestions.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-gray-400 text-center">
                      Keine Vorlagen gefunden
                      {watchedValues.bereich && (
                        <button type="button" onMouseDown={(e) => { e.preventDefault(); setValue('bereich', ''); }}
                          className="block mx-auto mt-1 text-primary-600 hover:underline">
                          Bereich-Filter aufheben
                        </button>
                      )}
                    </div>
                  ) : (
                    Object.entries(grouped).map(([cat, items]) => (
                      <div key={cat}>
                        <div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100 sticky top-8">{cat}</div>
                        {items.map((t) => (
                          <button key={t._id} type="button" onMouseDown={() => applyTemplate(t)}
                            className="w-full text-left px-3 py-2 hover:bg-primary-50 flex items-center justify-between gap-2 border-b border-gray-50">
                            <span className="text-sm text-gray-800 flex items-center gap-1.5 flex-wrap">
                              {t.name}
                              {t.estrichThickness ? <span className="text-xs text-slate-500">{t.estrichThickness} mm</span> : null}
                              {t.category && <span className="text-xs text-gray-400 italic">· {t.category}</span>}
                            </span>
                            <span className="text-xs text-gray-400 shrink-0">
                              {t.unit}
                              {showAllPhases && <span className="ml-1 text-gray-300">· {PHASE_LABELS[t.phaseType] || t.phaseType}</span>}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Kategorie */}
            <div>
              <label className="label">Kategorie</label>
              <input {...register('category')} className="input" placeholder="z.B. Boden, Wand, Installation" />
              {watchedValues.unit === 'm²' && floorArea && wallArea && (
                <div className="flex gap-1 mt-1">
                  <button type="button"
                    onClick={() => { setValue('category', 'Boden'); setValue('quantity', floorArea); }}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${watchedValues.category === 'Boden' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}>
                    Boden ({floorArea} m²)
                  </button>
                  <button type="button"
                    onClick={() => { setValue('category', 'Wand'); setValue('quantity', wallArea); }}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${watchedValues.category === 'Wand' ? 'bg-slate-500 text-white border-slate-500' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'}`}>
                    Wand ({wallArea} m²)
                  </button>
                </div>
              )}
            </div>

            {/* Menge */}
            <div>
              <label className="label">Menge *</label>
              <input {...register('quantity', { required: true, valueAsNumber: true, min: 0 })} type="number" step="0.01" className="input" />
              {(floorArea || wallArea || perimeter) && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {floorArea && <button type="button" onClick={() => setValue('quantity', floorArea)} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 hover:bg-emerald-100">Boden {floorArea} m²</button>}
                  {wallArea  && <button type="button" onClick={() => setValue('quantity', wallArea)}  className="text-xs bg-slate-50 text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 hover:bg-slate-100">Wand {wallArea} m²</button>}
                  {perimeter && <button type="button" onClick={() => setValue('quantity', perimeter)} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 hover:bg-amber-100">Umfang {perimeter} lfm</button>}
                </div>
              )}
            </div>

            {/* Einheit */}
            <div>
              <label className="label">Einheit</label>
              <select {...register('unit')} className="input">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            {/* Dicke (bedingt – für Estrich, Dämmung, Putz, Beton usw.) */}
            {hasThicknessField(watchedValues.name) && (
              <div>
                <label className="label">Dicke (mm)</label>
                <input {...register('estrichThickness', { valueAsNumber: true })} type="number" className="input" />
              </div>
            )}

            {/* Kosten */}
            <div>
              <label className="label">Materialkosten/Einheit (€)</label>
              <input {...register('materialCostPerUnit', { valueAsNumber: true, min: 0 })} type="number" step="0.01" className="input" />
            </div>
            <div>
              <label className="label">Entsorgung/Einheit (€)</label>
              <input {...register('disposalCostPerUnit', { valueAsNumber: true, min: 0 })} type="number" step="0.01" className="input" />
            </div>
            <div>
              <label className="label">Arbeitsstunden/Einheit</label>
              <input {...register('laborHoursPerUnit', { valueAsNumber: true, min: 0 })} type="number" step="0.01" className="input" />
            </div>
            <div>
              <label className="label">Stundensatz (€/Std)</label>
              <input {...register('laborHourlyRate', { valueAsNumber: true, min: 0 })} type="number" step="0.5" className="input" />
            </div>

            {/* Beschreibung */}
            <div className="col-span-2 md:col-span-3">
              <label className="label">Beschreibung / Notiz</label>
              <textarea {...register('description')} className="input" rows={2} />
            </div>
          </div>

          {/* Kostenvorschau */}
          <div className="mt-3 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-slate-800 mb-2">Kostenvorschau</h4>
            <div className="grid grid-cols-4 gap-2 text-sm">
              <div><p className="text-slate-500 text-xs">Materialkosten</p><p className="font-semibold">{preview.mat.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</p></div>
              <div><p className="text-slate-500 text-xs">Entsorgung</p><p className="font-semibold">{preview.dis.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</p></div>
              <div><p className="text-slate-500 text-xs">Arbeitskosten</p><p className="font-semibold">{preview.lab.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</p></div>
              <div className="bg-slate-200 rounded p-2"><p className="text-slate-600 text-xs">Gesamt</p><p className="font-bold text-slate-800">{preview.total.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</p></div>
            </div>
          </div>

          {/* Als Vorlage speichern */}
          {!isEdit && (
            <div className="mt-3 border border-dashed border-gray-300 rounded-lg p-3">
              {!showSaveTemplate ? (
                <button type="button" onClick={() => setShowSaveTemplate(true)}
                  className="text-sm text-gray-500 hover:text-primary-600 w-full text-left">
                  + Als neue Vorlage speichern{watchedValues.bereich ? ` (Bereich: ${watchedValues.bereich}${watchedValues.bereichUnterpunkt ? ` · ${watchedValues.bereichUnterpunkt}` : ''})` : ''}
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Als neue Vorlage speichern</p>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <label className="label text-xs">Für Phase</label>
                      <select value={savePhaseType} onChange={(e) => setSavePhaseType(e.target.value)} className="input text-sm">
                        <option value="demolition">Entkernung</option>
                        <option value="renovation">Renovierung</option>
                        <option value="specialConstruction">Sonderarbeiten</option>
                        <option value="all">Alle Phasen</option>
                      </select>
                    </div>
                    <div className="flex gap-2 items-end pb-0.5">
                      <button type="button" onClick={() => saveTemplateMutation.mutate()}
                        disabled={saveTemplateMutation.isLoading || !watchedValues.name}
                        className="btn-primary btn-sm">
                        {saveTemplateMutation.isLoading ? 'Speichern…' : 'Speichern'}
                      </button>
                      <button type="button" onClick={() => setShowSaveTemplate(false)} className="btn-secondary btn-sm">Abbrechen</button>
                    </div>
                  </div>
                  {saveTemplateMutation.isError && (
                    <p className="text-xs text-red-600">{(saveTemplateMutation.error as any)?.response?.data?.message || 'Fehler beim Speichern'}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {saveSuccess && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-2 text-sm">
              Vorlage wurde gespeichert.
            </div>
          )}

          {mutation.error != null && (
            <div className="mt-3 bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-2 text-sm">
              {(mutation.error as any).response?.data?.message || 'Fehler beim Speichern'}
            </div>
          )}
        </form>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={handleSubmit(onSubmit)} disabled={mutation.isLoading} className="btn-primary">
            {mutation.isLoading ? 'Speichern...' : isEdit ? 'Speichern' : 'Position anlegen'}
          </button>
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
