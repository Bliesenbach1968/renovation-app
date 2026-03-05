import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { getTemplates, createTemplate, updateTemplate, deleteTemplateApi } from '../api/projects';
import { useAuth } from '../context/AuthContext';
import type { PositionTemplate, PositionUnit, PhaseType } from '../types';
import { BEREICHE_SONDERARBEITEN } from '../components/PositionForm';
import { BEREICHE_ENTKERNUNG_RENOVIERUNG, BEREICHE_HIERARCHIE } from '../data/bereiche';

const UNITS: PositionUnit[] = ['m²', 'm³', 'lfm', 'Stück', 'Sack', 'kg', 'Psch', 't'];
const PHASE_LABELS: Record<string, string> = {
  demolition: 'Entkernung', renovation: 'Renovierung', specialConstruction: 'Sonderarbeiten', all: 'Alle Phasen',
};

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

function getBereicheForPhaseAdmin(phase: string): string[] {
  if (phase === 'specialConstruction') return BEREICHE_SONDERARBEITEN;
  return BEREICHE_ENTKERNUNG_RENOVIERUNG;
}

interface FormValues {
  name: string; category: string; phaseType: string; unit: PositionUnit;
  bereich: string; bereichUnterpunkt: string;
  estrichThickness: number | null;
  materialCostPerUnit: number; disposalCostPerUnit: number;
  laborHoursPerUnit: number; laborHourlyRate: number; description: string;
}

function TemplateForm({
  initial, isSystem, onSaveNew, onUpdate, onCancel,
}: {
  initial: Partial<FormValues>;
  isSystem: boolean;
  onSaveNew: (data: FormValues) => void;
  onUpdate?: (data: FormValues) => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: { estrichThickness: null, ...initial } as FormValues,
  });
  const watchedPhase = watch('phaseType');
  const watchedBereich = watch('bereich');
  const bereiche = getBereicheForPhaseAdmin(watchedPhase);

  // Cascading sub-levels
  const initParts = (initial.bereichUnterpunkt || '').split(' > ').filter(Boolean);
  const [sub1, setSub1] = useState(initParts[0] || '');
  const [sub2, setSub2] = useState(initParts[1] || '');
  const [sub3, setSub3] = useState(initParts[2] || '');

  const sub1Options = watchedBereich ? (BEREICHE_HIERARCHIE[watchedBereich] ?? []) : [];
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

  const watchedValues = watch();
  const watchedThickness = watch('estrichThickness');

  // Wenn Dicke-Feld eingeblendet wird und noch leer → Standardwert 60 setzen
  const watchedName = watch('name');
  useEffect(() => {
    if (hasThicknessField(watchedName) && !nameHasEmbeddedThickness(watchedName) && !watchedValues.estrichThickness) {
      setValue('estrichThickness', 60);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedName]);

  // Wenn Dicke geändert wird → Name live aktualisieren (z.B. "Estrich entfernen (45 mm)")
  useEffect(() => {
    const currentName = watchedValues.name || '';
    if (!hasThicknessField(currentName)) return;
    if (nameHasEmbeddedThickness(currentName)) return;
    const baseName = currentName.replace(/\s*\(\d+\s*mm\)$/i, '').trim();
    const newName = watchedThickness ? `${baseName} (${watchedThickness} mm)` : baseName;
    if (newName !== currentName) setValue('name', newName);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedThickness]);

  const matPerUnit = +(watchedValues.materialCostPerUnit ?? 0);
  const disPerUnit = +(watchedValues.disposalCostPerUnit ?? 0);
  const labPerUnit = +((watchedValues.laborHoursPerUnit ?? 0) * (watchedValues.laborHourlyRate ?? 0)).toFixed(2);
  const totalPerUnit = +(matPerUnit + disPerUnit + labPerUnit).toFixed(2);

  return (
    <div className="border border-primary-200 bg-primary-50/30 rounded-xl p-5 mt-2 space-y-4">

      {/* Phase */}
      <div>
        <label className="label">Phase</label>
        <select {...register('phaseType')} className="input">
          {Object.entries(PHASE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Bereich – kaskadierend */}
      <div className="space-y-2">
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
      </div>

      {/* Bezeichnung */}
      <div>
        <label className="label">Bezeichnung *</label>
        <input {...register('name', { required: true })} className="input" placeholder="Name der Vorlage" />
      </div>

      {/* Dicke (bedingt – für Estrich, Dämmung, Putz, Beton usw.) */}
      {hasThicknessField(watchedValues.name) && (
        <div>
          <label className="label">Dicke (mm)</label>
          <input
            {...register('estrichThickness', { valueAsNumber: true, setValueAs: v => v === '' ? null : +v })}
            type="number"
            className="input"
            placeholder="z.B. 45"
          />
        </div>
      )}

      {/* Kategorie + Einheit */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Kategorie</label>
          <input {...register('category')} className="input" placeholder="z.B. Boden, Wand" />
        </div>
        <div>
          <label className="label">Einheit</label>
          <select {...register('unit')} className="input">
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* Kosten */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Materialkosten / Einheit (€)</label>
          <input {...register('materialCostPerUnit', { valueAsNumber: true })} type="number" step="0.01" className="input" />
        </div>
        <div>
          <label className="label">Entsorgungskosten / Einheit (€)</label>
          <input {...register('disposalCostPerUnit', { valueAsNumber: true })} type="number" step="0.01" className="input" />
        </div>
        <div>
          <label className="label">Arbeitsstunden / Einheit</label>
          <input {...register('laborHoursPerUnit', { valueAsNumber: true })} type="number" step="0.01" className="input" />
        </div>
        <div>
          <label className="label">Stundensatz (€/Std)</label>
          <input {...register('laborHourlyRate', { valueAsNumber: true })} type="number" step="0.5" className="input" />
        </div>
      </div>

      {/* Beschreibung */}
      <div>
        <label className="label">Beschreibung / Notiz</label>
        <textarea {...register('description')} className="input" rows={2} />
      </div>

      {/* Kostenvorschau pro Einheit */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-slate-800 mb-2">Kostenvorschau</h4>
        <div className="grid grid-cols-4 gap-2 text-sm">
          <div><p className="text-slate-500 text-xs">Materialkosten</p><p className="font-semibold">{matPerUnit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</p></div>
          <div><p className="text-slate-500 text-xs">Entsorgung</p><p className="font-semibold">{disPerUnit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</p></div>
          <div><p className="text-slate-500 text-xs">Arbeitskosten</p><p className="font-semibold">{labPerUnit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</p></div>
          <div className="bg-slate-200 rounded p-2"><p className="text-slate-600 text-xs">Gesamt</p><p className="font-bold text-slate-800">{totalPerUnit.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</p></div>
        </div>
      </div>

      {isSystem && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Systemvorlagen können nicht direkt bearbeitet werden – die Änderungen werden als neue eigene Vorlage gespeichert.
        </p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={handleSubmit(onSaveNew)} className="btn-primary btn-sm">
          {isSystem ? 'Als neue Vorlage speichern' : 'Als Kopie speichern'}
        </button>
        {!isSystem && onUpdate && (
          <button type="button" onClick={handleSubmit(onUpdate)} className="btn-secondary btn-sm">
            Änderungen speichern
          </button>
        )}
        <button type="button" onClick={onCancel} className="btn-secondary btn-sm">Abbrechen</button>
      </div>
    </div>
  );
}

export default function AdminTemplatesPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [phaseFilter, setPhaseFilter] = useState('');
  const [bereichFilter, setBereichFilter] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery(
    ['templates', phaseFilter],
    () => getTemplates(phaseFilter || undefined)
  );

  const createMutation = useMutation(
    (body: Partial<PositionTemplate>) => createTemplate(body),
    { onSuccess: () => { qc.invalidateQueries('templates'); setShowNewForm(false); setEditingId(null); } }
  );

  const updateMutation = useMutation(
    ({ id, body }: { id: string; body: Partial<PositionTemplate> }) => updateTemplate(id, body),
    { onSuccess: () => { qc.invalidateQueries('templates'); setEditingId(null); } }
  );

  const deleteMutation = useMutation(
    (id: string) => deleteTemplateApi(id),
    { onSuccess: () => qc.invalidateQueries('templates') }
  );

  // Filter by bereich (client-side, since API doesn't support it)
  const filtered = bereichFilter
    ? templates.filter(t => t.bereich === bereichFilter)
    : templates;

  const grouped = filtered.reduce((acc: Record<string, PositionTemplate[]>, t) => {
    const key = t.bereich || t.category || 'Sonstiges';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const toFormValues = (t: PositionTemplate): FormValues => ({
    name: t.name, category: t.category, phaseType: t.phaseType,
    unit: t.unit, bereich: t.bereich || '',
    bereichUnterpunkt: t.bereichUnterpunkt || '',
    estrichThickness: t.estrichThickness ?? null,
    materialCostPerUnit: t.materialCostPerUnit,
    disposalCostPerUnit: t.disposalCostPerUnit, laborHoursPerUnit: t.laborHoursPerUnit,
    laborHourlyRate: t.laborHourlyRate, description: t.description || '',
  });

  const allBereiche = [...BEREICHE_ENTKERNUNG_RENOVIERUNG, ...BEREICHE_SONDERARBEITEN];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Positionsvorlagen</h1>
        <button onClick={() => { setShowNewForm(!showNewForm); setEditingId(null); }} className="btn-primary">
          + Neue Vorlage
        </button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={phaseFilter} onChange={(e) => { setPhaseFilter(e.target.value); setBereichFilter(''); }} className="input max-w-[200px]">
          <option value="">Alle Phasen</option>
          {Object.entries(PHASE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={bereichFilter} onChange={(e) => setBereichFilter(e.target.value)} className="input max-w-[220px]">
          <option value="">Alle Bereiche</option>
          {allBereiche.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {/* Neue Vorlage Formular */}
      {showNewForm && (
        <div className="card mb-6">
          <h2 className="font-semibold mb-4">Neue Vorlage anlegen</h2>
          <TemplateForm
            initial={{ phaseType: 'demolition', unit: 'm²', bereich: '', bereichUnterpunkt: '', estrichThickness: null, materialCostPerUnit: 0, disposalCostPerUnit: 0, laborHoursPerUnit: 0, laborHourlyRate: 45 }}
            isSystem={false}
            onSaveNew={(data) => createMutation.mutate({
              ...data,
              phaseType: data.phaseType as PhaseType | 'all',
              bereich: data.bereich || undefined,
              bereichUnterpunkt: data.bereichUnterpunkt || undefined,
              estrichThickness: data.estrichThickness || undefined,
              isSystemDefault: false,
            })}
            onCancel={() => setShowNewForm(false)}
          />
        </div>
      )}

      {isLoading ? (
        <div className="animate-pulse space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="card">
              <h3 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">{cat}</h3>
              <div className="space-y-2">
                {items.map((t) => (
                  <div key={t._id}>
                    <div className="flex items-start justify-between border border-gray-100 rounded-lg p-3 hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                          {t.isSystemDefault
                            ? <span className="badge bg-slate-100 text-slate-600 text-xs shrink-0">System</span>
                            : <span className="badge bg-emerald-50 text-emerald-600 text-xs shrink-0">Eigene</span>
                          }
                          {t.bereich && (
                            <span className="badge bg-violet-50 text-violet-600 text-xs shrink-0">
                              {t.bereich}
                              {t.bereichUnterpunkt ? ` · ${t.bereichUnterpunkt}` : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {PHASE_LABELS[t.phaseType]} · {t.unit}
                          {t.estrichThickness ? ` · Dicke: ${t.estrichThickness} mm` : ''}
                          {t.materialCostPerUnit > 0 ? ` · Material: ${t.materialCostPerUnit}€` : ''}
                          {t.disposalCostPerUnit > 0 ? ` · Entsorgung: ${t.disposalCostPerUnit}€` : ''}
                          {t.laborHoursPerUnit > 0 ? ` · ${t.laborHoursPerUnit}h/Einheit · ${t.laborHourlyRate}€/h` : ''}
                        </p>
                        {t.description && <p className="text-xs text-gray-400 mt-0.5 italic">{t.description}</p>}
                      </div>
                      <div className="flex gap-1 ml-2 shrink-0">
                        <button
                          onClick={() => setEditingId(editingId === t._id ? null : t._id)}
                          className="btn-secondary btn-sm px-2 text-xs"
                          title="Bearbeiten">✏ Bearbeiten</button>
                        {isAdmin && !t.isSystemDefault && (
                          <button
                            onClick={() => { if (confirm('Vorlage löschen?')) deleteMutation.mutate(t._id); }}
                            className="text-gray-300 hover:text-red-500 transition-colors px-1"
                            title="Löschen">✕</button>
                        )}
                      </div>
                    </div>

                    {/* Inline Edit Form */}
                    {editingId === t._id && (
                      <TemplateForm
                        initial={toFormValues(t)}
                        isSystem={t.isSystemDefault}
                        onSaveNew={(data) => createMutation.mutate({
                          ...data,
                          phaseType: data.phaseType as PhaseType | 'all',
                          bereich: data.bereich || undefined,
                          bereichUnterpunkt: data.bereichUnterpunkt || undefined,
                          estrichThickness: data.estrichThickness || undefined,
                          isSystemDefault: false,
                        })}
                        onUpdate={!t.isSystemDefault ? (data) => updateMutation.mutate({
                          id: t._id,
                          body: {
                            ...data,
                            phaseType: data.phaseType as PhaseType | 'all',
                            bereich: data.bereich || undefined,
                            bereichUnterpunkt: data.bereichUnterpunkt || undefined,
                            estrichThickness: data.estrichThickness || undefined,
                          },
                        }) : undefined}
                        onCancel={() => setEditingId(null)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-12 text-gray-400">
              Keine Vorlagen gefunden
              {bereichFilter && (
                <button onClick={() => setBereichFilter('')} className="block mx-auto mt-2 text-primary-600 hover:underline text-sm">
                  Bereich-Filter aufheben
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
