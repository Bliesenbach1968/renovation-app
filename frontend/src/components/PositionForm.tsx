import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { useSearchParams } from 'react-router-dom';
import { createPosition, updatePosition, getTemplates, createTemplate } from '../api/projects';
import type { Floor, Room, Position, PositionTemplate, PhaseType, PositionUnit } from '../types';
import { BEREICHE_ENTKERNUNG_RENOVIERUNG, BEREICHE_HIERARCHIE } from '../data/bereiche';

const UNITS: PositionUnit[] = ['m²', 'm³', 'lfm', 'Stück', 'Sack', 'kg', 'Psch', 't'];

const THICKNESS_KEYWORDS = [
  'estrich', 'dämmung', 'dämmstoff', 'wärmedämmung', 'trittschalldämmung',
  'putz', 'glattstrich', 'beton', 'abdichtung', 'bodenplatte', 'bodenaufbau',
  'spachtel', 'ausgleichsmasse', 'wandaufbau', 'deckenaufbau', 'unterboden',
];
function hasThicknessField(name: string) {
  const lower = (name || '').toLowerCase();
  return THICKNESS_KEYWORDS.some(k => lower.includes(k));
}
function nameHasEmbeddedThickness(name: string) {
  const stripped = (name || '').replace(/\s*\(\d+\s*mm\)$/i, '');
  return /\d+\s*mm/i.test(stripped);
}
const PHASE_LABELS: Record<string, string> = {
  demolition: 'Entkernung', renovation: 'Renovierung', specialConstruction: 'Sonderarbeiten', all: 'Alle Phasen',
};

export const BEREICHE_SONDERARBEITEN = ['Dachausbau', 'Betonsanierung', 'Balkone', 'Container & Entsorgung', 'Gerüst', 'Kran', 'Pauschal'];
export const BEREICH_UNTERPUNKTE: Record<string, string[]> = {};

export function getBereicheForPhase(phase: string, _projectFloors: Floor[] = []): string[] {
  return phase === 'specialConstruction'
    ? BEREICHE_SONDERARBEITEN
    : BEREICHE_ENTKERNUNG_RENOVIERUNG;
}

interface MultiItem {
  label: string;
  name: string;
  quantity: number;
  unit: PositionUnit;
  materialCostPerUnit: number;
  disposalCostPerUnit: number;
  laborHoursPerUnit: number;
  checked: boolean;
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
  defaultBereich?: string;
  roomDimensions?: { length?: number; width?: number; height?: number; area?: number; volume?: number };
  projectFloors?: Floor[];
  projectUnits?: { _id: string; name: string; number?: string; floorId: string | { _id: string } }[];
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
  defaultHourlyRate, defaultBereich, roomDimensions, projectFloors = [], projectUnits = [], onClose, onSuccess,
}: Props) {
  const isEdit = !!editPosition;
  const qc = useQueryClient();
  const [internalRoomId, setInternalRoomId] = useState(roomId || '');

  const [searchParams] = useSearchParams();
  const urlBereich = defaultBereich || searchParams.get('bereich') || '';
  const urlUnterpunkt = searchParams.get('unterpunkt') || '';

  const selectedRoom = rooms?.find(r => r._id === internalRoomId);
  const effectiveDimensions = selectedRoom?.dimensions ?? roomDimensions;

  const floorArea = effectiveDimensions?.area ?? (effectiveDimensions?.length && effectiveDimensions?.width
    ? +(effectiveDimensions.length * effectiveDimensions.width).toFixed(2) : undefined);
  const wallArea = effectiveDimensions?.length && effectiveDimensions?.width && effectiveDimensions?.height
    ? +(2 * (effectiveDimensions.length + effectiveDimensions.width) * effectiveDimensions.height).toFixed(2)
    : undefined;
  const perimeter = effectiveDimensions?.length && effectiveDimensions?.width
    ? +(2 * (effectiveDimensions.length + effectiveDimensions.width)).toFixed(2)
    : undefined;

  const initUnterpunkt = editPosition?.bereichUnterpunkt || initialTemplate?.bereichUnterpunkt || urlUnterpunkt || '';
  const initParts = initUnterpunkt ? initUnterpunkt.split(' > ') : [];
  const [sub1, setSub1] = useState(initParts[0] || '');
  const [sub2, setSub2] = useState(initParts[1] || '');
  const [sub3, setSub3] = useState(initParts[2] || '');

  // Multi-Auswahl State
  const [multiItems, setMultiItems] = useState<MultiItem[]>([]);
  const [multiAtSub1, setMultiAtSub1] = useState(false); // Multi-Modus auf sub1-Ebene (Kategorie)
  const [multiAtSub2, setMultiAtSub2] = useState(false); // Multi-Modus auf sub2-Ebene (Detail)
  const [multiSubmitting, setMultiSubmitting] = useState(false);
  const [multiError, setMultiError] = useState('');

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

  const katIsWand  = sub1.toLowerCase().includes('wand');
  const katIsBoden = sub1.toLowerCase().includes('boden');

  const sub1Options = watchedValues.bereich ? (BEREICHE_HIERARCHIE[watchedValues.bereich] ?? []) : [];
  const sub1Node = sub1Options.find(n => n.label === sub1);
  const sub2Options = sub1Node?.children ?? [];
  const sub2Node = sub2Options.find(n => n.label === sub2);
  const sub3Options = sub2Node?.children ?? [];

  // Hilfsfunktion: MultiItems aus einer Options-Liste bauen
  const buildMultiItems = (options: { label: string }[], preCheckedLabel = '') =>
    options.map(n => ({
      label: n.label,
      name: n.label.replace(/^[a-z]+[.)]\s*/i, '').trim(),
      quantity: 0,
      unit: (watchedValues.unit || 'Stück') as PositionUnit,
      materialCostPerUnit: +(watchedValues.materialCostPerUnit ?? 0),
      disposalCostPerUnit: +(watchedValues.disposalCostPerUnit ?? 0),
      laborHoursPerUnit: +(watchedValues.laborHoursPerUnit ?? 0),
      checked: n.label === preCheckedLabel,
    }));

  // Wenn sub3-Optionen sich ändern → Multi-Items initialisieren (nur wenn NICHT schon sub1/sub2-Multi aktiv)
  const sub3Key = sub3Options.map(n => n.label).join('|');
  useEffect(() => {
    if (multiAtSub1 || multiAtSub2) return; // sub1/sub2-Multi haben Vorrang
    if (sub3Options.length > 0 && !isEdit) {
      setMultiItems(buildMultiItems(sub3Options));
      setSub3('');
      setMultiError('');
    } else {
      setMultiItems([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub3Key, isEdit, multiAtSub1, multiAtSub2]);

  // Ob Multi-Modus aktiv ist (sub3-Ebene ODER sub2-Ebene ODER sub1-Ebene ohne Kinder)
  const isMultiMode = (sub3Options.length > 0 || multiAtSub2 || multiAtSub1) && !isEdit;

  // Gesamtvorschau für alle angehakten Multi-Items (per-item Material/Entsorgung)
  const multiPreview = isMultiMode
    ? multiItems.filter(i => i.checked).reduce((acc, item) => {
        const p = calcPreview({
          ...watchedValues,
          quantity: item.quantity,
          materialCostPerUnit: item.materialCostPerUnit,
          disposalCostPerUnit: item.disposalCostPerUnit,
          laborHoursPerUnit: item.laborHoursPerUnit,
        });
        return {
          mat: +(acc.mat + p.mat).toFixed(2),
          dis: +(acc.dis + p.dis).toFixed(2),
          lab: +(acc.lab + p.lab).toFixed(2),
          total: +(acc.total + p.total).toFixed(2),
        };
      }, { mat: 0, dis: 0, lab: 0, total: 0 })
    : null;

  const extractKeyword = (label: string) => label.replace(/^[a-z0-9]+[.)]\s*/i, '').trim();

  const handleSub1Change = (val: string) => {
    setSub2(''); setSub3('');
    setMultiAtSub2(false); setMultiItems([]); setMultiError('');
    if (!isEdit && val) {
      // Prüfen ob gewählte sub1-Option Kinder hat
      const selectedNode = sub1Options.find(n => n.label === val);
      const hasChildren = (selectedNode?.children?.length ?? 0) > 0;
      if (!hasChildren) {
        // Keine Kinder → Multi-Modus auf sub1-Ebene aktivieren
        setMultiAtSub1(true);
        setSub1('');
        setMultiItems(buildMultiItems(sub1Options, val));
        setMultiError('');
        setValue('bereichUnterpunkt', watchedValues.bereich || '');
        return;
      }
    }
    setSub1(val);
    setMultiAtSub1(false);
    setValue('bereichUnterpunkt', val);
    if (!editPosition) {
      const kw = val ? extractKeyword(val) : '';
      setNameInput(kw);
      if (kw) setShowSuggestions(true);
    }
  };
  const handleSub2Change = (val: string) => {
    setSub3('');
    setValue('bereichUnterpunkt', [sub1, val].filter(Boolean).join(' > '));
    if (!isEdit && val) {
      // Prüfen ob gewählte sub2-Option Kinder hat
      const selectedNode = sub2Options.find(n => n.label === val);
      const hasChildren = (selectedNode?.children?.length ?? 0) > 0;
      if (!hasChildren) {
        // Keine Kinder → Multi-Modus auf sub2-Ebene aktivieren
        setMultiAtSub2(true);
        setSub2('');
        setMultiItems(buildMultiItems(sub2Options, val));
        setMultiError('');
        setValue('bereichUnterpunkt', sub1); // Unterpunkt auf sub1-Ebene, item.label kommt per Item
        return;
      }
    }
    setSub2(val);
    setMultiAtSub2(false);
    if (!isEdit) {
      const kw = val ? extractKeyword(val) : (sub1 ? extractKeyword(sub1) : '');
      setNameInput(kw);
      if (kw) setShowSuggestions(true);
    }
  };
  const handleSub3Change = (val: string) => {
    setSub3(val);
    setValue('bereichUnterpunkt', [sub1, sub2, val].filter(Boolean).join(' > '));
    if (!editPosition) {
      const kw = val ? extractKeyword(val) : (sub2 ? extractKeyword(sub2) : '');
      setNameInput(kw);
      if (kw) setShowSuggestions(true);
    }
  };

  const watchedName = watch('name');
  useEffect(() => {
    if (hasThicknessField(watchedName) && !nameHasEmbeddedThickness(watchedName) && !watchedValues.estrichThickness) {
      setValue('estrichThickness', 60);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedName]);

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

  const phaseFiltered = showAllPhases
    ? allTemplates
    : allTemplates.filter(t =>
        (t.phaseType === phaseType || t.phaseType === 'all') &&
        (!watchedValues.bereich || !t.bereich || t.bereich === watchedValues.bereich)
      );

  const suggestions = (() => {
    if (nameInput.length < 1) return phaseFiltered.slice(0, 30);
    const q = nameInput.toLowerCase();
    const matched = phaseFiltered.filter(t =>
      t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
    );
    matched.sort((a, b) => {
      const aName = a.name.toLowerCase().includes(q);
      const bName = b.name.toLowerCase().includes(q);
      if (aName && !bName) return -1;
      if (!aName && bName) return 1;
      const aStarts = a.name.toLowerCase().startsWith(q);
      const bStarts = b.name.toLowerCase().startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return 0;
    });
    return matched.slice(0, 15);
  })();

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
      setValue('quantity', effectiveDimensions?.volume ?? 0);
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
  );

  const effectiveRoomId = roomId || internalRoomId;

  // Nach erfolgreichem Speichern: im Edit-Modus schließen, im Neu-Modus offen bleiben
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const handleSaveSuccess = (count = 1) => {
    if (isEdit) {
      onSuccess(); // schließt Modal
      return;
    }
    // Daten refreshen ohne Modal zu schließen
    qc.invalidateQueries(['positions', projectId]);
    qc.invalidateQueries(['project', projectId]);
    qc.invalidateQueries(['projects']);
    // Erfolgs-Toast zeigen
    const msg = count === 1 ? '1 Position gespeichert' : `${count} Positionen gespeichert`;
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3000);
    // Formular zurücksetzen (Bereich/Kosten bleiben, nur Name/Menge leeren)
    setValue('name', '');
    setValue('quantity', 0);
    setNameInput('');
    setSelectedTemplate('');
    // Multi: Häkchen und Mengen zurücksetzen (Ebene beibehalten)
    setMultiItems(prev => prev.map(i => ({ ...i, checked: false, quantity: 0 })));
    setMultiError('');
    // multiAtSub1/multiAtSub2 bleiben aktiv, damit der User weitere Positionen anlegen kann
  };

  // Einzel-Submit
  const onSubmit = (data: FormValues) => {
    mutation.mutate({
      ...data, roomId: effectiveRoomId || undefined, phaseType,
      templateId: selectedTemplate || undefined,
      bereich: data.bereich || undefined,
      bereichUnterpunkt: data.bereichUnterpunkt || undefined,
    } as any, { onSuccess: () => handleSaveSuccess(1) });
  };

  // Multi-Submit: eine Position je angehaktem Item
  const handleMultiSubmit = async () => {
    const data = watchedValues;
    const checkedItems = multiItems.filter(i => i.checked);
    if (checkedItems.length === 0) {
      setMultiError('Bitte mindestens eine Spezifikation auswählen.');
      return;
    }
    const emptyQty = checkedItems.filter(i => i.quantity <= 0);
    if (emptyQty.length > 0) {
      setMultiError(`Menge fehlt bei: ${emptyQty.map(i => i.name || i.label).join(', ')}`);
      return;
    }
    setMultiSubmitting(true);
    setMultiError('');
    try {
      for (const item of checkedItems) {
        await createPosition(projectId, {
          name: item.name || item.label,
          category: data.category,
          bereich: data.bereich || undefined,
          bereichUnterpunkt: multiAtSub1
            ? item.label
            : multiAtSub2
              ? [sub1, item.label].filter(Boolean).join(' > ')
              : [sub1, sub2, item.label].filter(Boolean).join(' > '),
          description: data.description,
          unit: item.unit,
          quantity: item.quantity,
          materialCostPerUnit: item.materialCostPerUnit,
          disposalCostPerUnit: item.disposalCostPerUnit,
          laborHoursPerUnit: item.laborHoursPerUnit,
          laborHourlyRate: +(data.laborHourlyRate ?? 0),
          roomId: effectiveRoomId || undefined,
          phaseType,
        } as any);
      }
      handleSaveSuccess(checkedItems.length);
    } catch (err: any) {
      setMultiError(err?.response?.data?.message || 'Fehler beim Anlegen der Positionen.');
    } finally {
      setMultiSubmitting(false);
    }
  };

  const grouped = suggestions.reduce((acc, t) => {
    const key = t.bereich || t.category || 'Sonstige';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {} as Record<string, PositionTemplate[]>);

  const checkedCount = multiItems.filter(i => i.checked).length;

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
                  {rooms.map(r => {
                    const unit = projectUnits.find(u => u._id === (typeof r.unitId === 'string' ? r.unitId : (r.unitId as any)?._id));
                    const floorId = unit ? (typeof unit.floorId === 'string' ? unit.floorId : (unit.floorId as any)?._id) : (typeof r.floorId === 'string' ? r.floorId : (r.floorId as any)?._id);
                    const floor = projectFloors.find(f => f._id === floorId);
                    const unitLabel = unit ? `${unit.number ? unit.number + ' ' : ''}${unit.name}`.trim() : '';
                    const suffix = [unitLabel, floor?.name].filter(Boolean).join(' · ');
                    return (
                      <option key={r._id} value={r._id}>
                        {r.name}{r.dimensions?.area ? ` (${r.dimensions.area} m²)` : ''}{suffix ? ` – ${suffix}` : ''}
                      </option>
                    );
                  })}
                </select>
                {internalRoomId && (floorArea != null || wallArea != null) && (
                  <div className="flex gap-2 mt-1.5">
                    {floorArea != null && !katIsWand && (
                      <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-2 py-0.5">
                        Boden: <strong>{floorArea} m²</strong>
                      </span>
                    )}
                    {wallArea != null && !katIsBoden && (
                      <span className="inline-flex items-center gap-1 text-xs bg-slate-50 text-slate-700 border border-slate-200 rounded px-2 py-0.5">
                        Wand: <strong>{wallArea} m²</strong>
                      </span>
                    )}
                    {perimeter != null && !katIsWand && (
                      <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-2 py-0.5">
                        Umfang: <strong>{perimeter} lfm</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Bereich – kaskadierend */}
            <div>
              <label className="label">Bereich</label>
              <select
                {...register('bereich')}
                className="input"
                onChange={(e) => { setValue('bereich', e.target.value); setValue('bereichUnterpunkt', ''); setSub1(''); setSub2(''); setSub3(''); setMultiAtSub1(false); setMultiAtSub2(false); setMultiItems([]); setMultiError(''); }}
              >
                <option value="">– kein Bereich –</option>
                {bereiche.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {sub1Options.length > 0 && !multiAtSub1 && (
              <div>
                <label className="label">Kategorie</label>
                <select value={sub1} onChange={(e) => handleSub1Change(e.target.value)} className="input">
                  <option value="">– bitte wählen –</option>
                  {sub1Options.map((n) => <option key={n.label} value={n.label}>{n.label}</option>)}
                </select>
              </div>
            )}
            {/* Detail-Dropdown – ausblenden wenn multi auf sub2-Ebene aktiv */}
            {sub1 && sub2Options.length > 0 && !multiAtSub2 && (
              <div>
                <label className="label">Detail</label>
                <select value={sub2} onChange={(e) => handleSub2Change(e.target.value)} className="input">
                  <option value="">– bitte wählen –</option>
                  {sub2Options.map((n) => <option key={n.label} value={n.label}>{n.label}</option>)}
                </select>
              </div>
            )}

            {/* ── MULTI-MODUS: Mehrfachauswahl (sub2 oder sub3 Ebene) ── */}
            {isMultiMode && (
              <div className="col-span-2 md:col-span-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label !mb-0">
                    {multiAtSub1 ? 'Kategorie' : multiAtSub2 ? 'Detail' : 'Spezifikationen'}
                    {checkedCount > 0 && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                        {checkedCount} gewählt
                      </span>
                    )}
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 accent-primary-600"
                      checked={multiItems.length > 0 && multiItems.every(i => i.checked)}
                      onChange={e => setMultiItems(prev => prev.map(i => ({ ...i, checked: e.target.checked })))}
                    />
                    Alle auswählen
                  </label>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Tabellen-Header */}
                  <div className="grid items-center bg-gray-50 px-3 py-1.5 border-b border-gray-200 text-xs font-medium text-gray-500"
                    style={{ gridTemplateColumns: '20px 1fr 68px 58px 60px 60px 58px', gap: '5px' }}>
                    <span />
                    <span>Bezeichnung</span>
                    <span className="text-right">Menge</span>
                    <span className="text-center">Einheit</span>
                    <span className="text-right">Mat. €</span>
                    <span className="text-right">Entso. €</span>
                    <span className="text-right">Std./Einh.</span>
                  </div>
                  {/* Item-Zeilen */}
                  <div className="divide-y divide-gray-100">
                    {multiItems.map((item, idx) => (
                      <div
                        key={item.label}
                        className={`grid items-center px-3 py-2 transition-colors ${item.checked ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                        style={{ gridTemplateColumns: '20px 1fr 68px 58px 60px 60px 58px', gap: '5px' }}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-primary-600"
                          checked={item.checked}
                          onChange={e => {
                            setMultiItems(prev => prev.map((it, i) => i === idx ? { ...it, checked: e.target.checked } : it));
                            setMultiError('');
                          }}
                        />
                        <input
                          type="text"
                          value={item.name}
                          onChange={e => setMultiItems(prev => prev.map((it, i) => i === idx ? { ...it, name: e.target.value } : it))}
                          className={`text-sm border rounded px-2 py-1 w-full transition-colors focus:outline-none focus:ring-1 focus:ring-primary-400
                            ${item.checked ? 'border-primary-300 bg-white text-gray-800' : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                          placeholder={item.label}
                          disabled={!item.checked}
                        />
                        <input
                          type="number"
                          value={item.quantity || ''}
                          onChange={e => {
                            setMultiItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: +e.target.value } : it));
                            setMultiError('');
                          }}
                          className={`text-sm border rounded px-1.5 py-1 w-full text-right transition-colors focus:outline-none focus:ring-1 focus:ring-primary-400
                            ${item.checked ? 'border-primary-300 bg-white text-gray-800' : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                          min={0} step="0.01" placeholder="0"
                          disabled={!item.checked}
                        />
                        <select
                          value={item.unit}
                          onChange={e => setMultiItems(prev => prev.map((it, i) => i === idx ? { ...it, unit: e.target.value as PositionUnit } : it))}
                          disabled={!item.checked}
                          className={`text-xs border rounded px-1 py-1 w-full text-center cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary-400 transition-colors
                            ${item.checked ? 'border-primary-300 bg-white text-gray-700' : 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed'}`}
                        >
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <input
                          type="number"
                          value={item.materialCostPerUnit || ''}
                          onChange={e => setMultiItems(prev => prev.map((it, i) => i === idx ? { ...it, materialCostPerUnit: +e.target.value } : it))}
                          className={`text-xs border rounded px-1.5 py-1 w-full text-right transition-colors focus:outline-none focus:ring-1 focus:ring-primary-400
                            ${item.checked ? 'border-primary-300 bg-white text-gray-800' : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                          min={0} step="0.01" placeholder="0"
                          disabled={!item.checked}
                        />
                        <input
                          type="number"
                          value={item.disposalCostPerUnit || ''}
                          onChange={e => setMultiItems(prev => prev.map((it, i) => i === idx ? { ...it, disposalCostPerUnit: +e.target.value } : it))}
                          className={`text-xs border rounded px-1.5 py-1 w-full text-right transition-colors focus:outline-none focus:ring-1 focus:ring-primary-400
                            ${item.checked ? 'border-primary-300 bg-white text-gray-800' : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                          min={0} step="0.01" placeholder="0"
                          disabled={!item.checked}
                        />
                        <input
                          type="number"
                          value={item.laborHoursPerUnit || ''}
                          onChange={e => setMultiItems(prev => prev.map((it, i) => i === idx ? { ...it, laborHoursPerUnit: +e.target.value } : it))}
                          className={`text-xs border rounded px-1.5 py-1 w-full text-right transition-colors focus:outline-none focus:ring-1 focus:ring-primary-400
                            ${item.checked ? 'border-primary-300 bg-white text-gray-800' : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                          min={0} step="0.01" placeholder="0"
                          disabled={!item.checked}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Schnellmengen für Raummaße */}
                {checkedCount > 0 && (floorArea || wallArea || perimeter) && (
                  <div className="flex flex-wrap gap-1 mt-1.5 items-center">
                    <span className="text-xs text-gray-400">Menge für alle:</span>
                    {floorArea && !katIsWand  && <button type="button" onClick={() => setMultiItems(prev => prev.map(i => i.checked ? { ...i, quantity: floorArea } : i))} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 hover:bg-emerald-100">Boden {floorArea} m²</button>}
                    {wallArea  && !katIsBoden && <button type="button" onClick={() => setMultiItems(prev => prev.map(i => i.checked ? { ...i, quantity: wallArea }  : i))} className="text-xs bg-slate-50 text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 hover:bg-slate-100">Wand {wallArea} m²</button>}
                    {perimeter && !katIsWand  && <button type="button" onClick={() => setMultiItems(prev => prev.map(i => i.checked ? { ...i, quantity: perimeter } : i))} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 hover:bg-amber-100">Umfang {perimeter} lfm</button>}
                  </div>
                )}
              </div>
            )}

            {/* ── EINZEL-MODUS: normale sub3-Auswahl ── */}
            {!isMultiMode && sub2 && sub3Options.length > 0 && (
              <div>
                <label className="label">Spezifikation</label>
                <select value={sub3} onChange={(e) => handleSub3Change(e.target.value)} className="input">
                  <option value="">– bitte wählen –</option>
                  {sub3Options.map((n) => <option key={n.label} value={n.label}>{n.label}</option>)}
                </select>
              </div>
            )}

            {/* Bezeichnung – nur im Einzel-Modus */}
            {!isMultiMode && (
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
            )}

            {/* Menge – nur im Einzel-Modus */}
            {!isMultiMode && (
              <div>
                <label className="label">Menge *</label>
                <input {...register('quantity', { required: true, valueAsNumber: true, min: 0 })} type="number" step="0.01" className="input" />
                {(floorArea || wallArea || perimeter) && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {floorArea && !katIsWand  && <button type="button" onClick={() => setValue('quantity', floorArea)} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 hover:bg-emerald-100">Boden {floorArea} m²</button>}
                    {wallArea  && !katIsBoden && <button type="button" onClick={() => setValue('quantity', wallArea)}  className="text-xs bg-slate-50 text-slate-700 border border-slate-200 rounded px-1.5 py-0.5 hover:bg-slate-100">Wand {wallArea} m²</button>}
                    {perimeter && !katIsWand  && <button type="button" onClick={() => setValue('quantity', perimeter)} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 hover:bg-amber-100">Umfang {perimeter} lfm</button>}
                  </div>
                )}
              </div>
            )}

            {/* Einheit – nur im Einzel-Modus (Multi-Modus hat Einheit pro Zeile) */}
            {!isMultiMode && (
              <div>
                <label className="label">Einheit</label>
                <select {...register('unit')} className="input">
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            )}

            {/* Dicke (nur Einzel-Modus, bedingt) */}
            {!isMultiMode && hasThicknessField(watchedValues.name) && (
              <div>
                <label className="label">Dicke (mm)</label>
                <input {...register('estrichThickness', { valueAsNumber: true })} type="number" className="input" />
              </div>
            )}

            {/* Material & Entsorgung – nur im Einzel-Modus (Multi: pro Zeile) */}
            {!isMultiMode && (
              <>
                <div>
                  <label className="label">Materialkosten/Einheit (€)</label>
                  <input {...register('materialCostPerUnit', { valueAsNumber: true, min: 0 })} type="number" step="0.01" className="input" />
                </div>
                <div>
                  <label className="label">Entsorgung/Einheit (€)</label>
                  <input {...register('disposalCostPerUnit', { valueAsNumber: true, min: 0 })} type="number" step="0.01" className="input" />
                </div>
              </>
            )}
            {/* Arbeitsstunden – nur Einzel-Modus (Multi: pro Zeile) */}
            {!isMultiMode && (
              <div>
                <label className="label">Arbeitsstunden/Einheit</label>
                <input {...register('laborHoursPerUnit', { valueAsNumber: true, min: 0 })} type="number" step="0.01" className="input" />
              </div>
            )}
            {/* Stundensatz – immer geteilt */}
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
            <h4 className="text-sm font-semibold text-slate-800 mb-2">
              {isMultiMode && checkedCount > 0 ? `Kostenvorschau (${checkedCount} Position${checkedCount > 1 ? 'en' : ''} gesamt)` : 'Kostenvorschau'}
            </h4>
            {(() => {
              const p = multiPreview ?? preview;
              return (
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div><p className="text-slate-500 text-xs">Materialkosten</p><p className="font-semibold">{p.mat.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</p></div>
                  <div><p className="text-slate-500 text-xs">Entsorgung</p><p className="font-semibold">{p.dis.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</p></div>
                  <div><p className="text-slate-500 text-xs">Arbeitskosten</p><p className="font-semibold">{p.lab.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</p></div>
                  <div className="bg-slate-200 rounded p-2"><p className="text-slate-600 text-xs">Gesamt</p><p className="font-bold text-slate-800">{p.total.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</p></div>
                </div>
              );
            })()}
          </div>

          {/* Als Vorlage speichern – nur Einzel-Modus */}
          {!isEdit && !isMultiMode && (
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

          {/* Erfolgs-Toast (nur Neu-Modus) */}
          {saveToast && (
            <div className="mt-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg px-4 py-2 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              {saveToast}
            </div>
          )}

          {/* Fehler */}
          {multiError && (
            <div className="mt-3 bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-2 text-sm">
              {multiError}
            </div>
          )}
          {mutation.error != null && (
            <div className="mt-3 bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-2 text-sm">
              {(mutation.error as any).response?.data?.message || 'Fehler beim Speichern'}
            </div>
          )}
        </form>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-200">
          {isMultiMode ? (
            <button
              type="button"
              onClick={handleMultiSubmit}
              disabled={multiSubmitting || checkedCount === 0}
              className="btn-primary"
            >
              {multiSubmitting
                ? 'Anlegen…'
                : checkedCount === 0
                ? 'Position anlegen'
                : `${checkedCount} Position${checkedCount > 1 ? 'en' : ''} anlegen`}
            </button>
          ) : (
            <button onClick={handleSubmit(onSubmit)} disabled={mutation.isLoading} className="btn-primary">
              {mutation.isLoading ? 'Speichern...' : isEdit ? 'Speichern' : 'Position anlegen'}
            </button>
          )}
          <button onClick={onClose} className="btn-secondary">
            {isEdit ? 'Abbrechen' : 'Schließen'}
          </button>
        </div>
      </div>
    </div>
  );
}
