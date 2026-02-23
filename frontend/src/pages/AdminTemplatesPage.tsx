import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import { getTemplates, createTemplate, updateTemplate, deleteTemplateApi } from '../api/projects';
import { useAuth } from '../context/AuthContext';
import type { PositionTemplate, PositionUnit, PhaseType } from '../types';
import {
  BEREICHE_STATIC,
  BEREICHE_ENTKERNUNG_EXTRA,
  BEREICHE_SONDERARBEITEN,
  AUSSENANLAGE_UNTERPUNKTE,
  BEREICH_UNTERPUNKTE,
} from '../components/PositionForm';

const UNITS: PositionUnit[] = ['m²', 'm³', 'lfm', 'Stück', 'Sack', 'kg', 'Psch', 't'];
const PHASE_LABELS: Record<string, string> = {
  demolition: 'Entkernung', renovation: 'Renovierung', specialConstruction: 'Sonderarbeiten', all: 'Alle Phasen',
};

function getBereicheForPhaseAdmin(phase: string): string[] {
  if (phase === 'specialConstruction') return BEREICHE_SONDERARBEITEN;
  return [...BEREICHE_STATIC, ...BEREICHE_ENTKERNUNG_EXTRA];
}

interface FormValues {
  name: string; category: string; phaseType: string; unit: PositionUnit;
  bereich: string; aussenanlageUnterpunkt: string; bereichUnterpunkt: string;
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
  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({ defaultValues: initial as FormValues });
  const watchedPhase = watch('phaseType');
  const watchedBereich = watch('bereich');
  const bereiche = getBereicheForPhaseAdmin(watchedPhase);
  const showBereichUnterpunkt = watchedBereich ? watchedBereich in BEREICH_UNTERPUNKTE : false;
  const bereichUnterpunktOptionen = watchedBereich ? (BEREICH_UNTERPUNKTE[watchedBereich] ?? []) : [];

  return (
    <div className="border border-primary-200 bg-primary-50/30 rounded-xl p-4 mt-2 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="label">Bezeichnung *</label>
          <input {...register('name', { required: true })} className="input" />
        </div>
        <div>
          <label className="label">Kategorie</label>
          <input {...register('category')} className="input" placeholder="z.B. Boden, Wand" />
        </div>
        <div>
          <label className="label">Phase</label>
          <select {...register('phaseType')} className="input">
            {Object.entries(PHASE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Bereich</label>
          <select
            {...register('bereich')}
            className="input"
            onChange={(e) => { setValue('bereich', e.target.value); setValue('bereichUnterpunkt', ''); }}
          >
            <option value="">– kein Bereich –</option>
            {bereiche.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        {showBereichUnterpunkt && (
          <div>
            <label className="label">{watchedBereich} – Unterpunkt</label>
            <select {...register('bereichUnterpunkt')} className="input">
              <option value="">– bitte wählen –</option>
              {bereichUnterpunktOptionen.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        )}
        {watchedBereich === 'Außenanlage' && (
          <div>
            <label className="label">Außenanlage – Unterpunkt</label>
            <select {...register('aussenanlageUnterpunkt')} className="input">
              <option value="">– bitte wählen –</option>
              {AUSSENANLAGE_UNTERPUNKTE.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Einheit</label>
          <select {...register('unit')} className="input">
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Materialkosten/Einheit (€)</label>
          <input {...register('materialCostPerUnit', { valueAsNumber: true })} type="number" step="0.01" className="input" />
        </div>
        <div>
          <label className="label">Entsorgung/Einheit (€)</label>
          <input {...register('disposalCostPerUnit', { valueAsNumber: true })} type="number" step="0.01" className="input" />
        </div>
        <div>
          <label className="label">Arbeitsstunden/Einheit</label>
          <input {...register('laborHoursPerUnit', { valueAsNumber: true })} type="number" step="0.01" className="input" />
        </div>
        <div>
          <label className="label">Stundensatz (€/Std)</label>
          <input {...register('laborHourlyRate', { valueAsNumber: true })} type="number" step="0.5" className="input" />
        </div>
        <div className="col-span-2 md:col-span-3">
          <label className="label">Beschreibung</label>
          <textarea {...register('description')} className="input" rows={2} />
        </div>
      </div>
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
      {isSystem && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Systemvorlagen können nicht direkt bearbeitet werden – die Änderungen werden als neue eigene Vorlage gespeichert.
        </p>
      )}
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
    unit: t.unit, bereich: t.bereich || '', aussenanlageUnterpunkt: t.aussenanlageUnterpunkt || '',
    bereichUnterpunkt: t.bereichUnterpunkt || '',
    materialCostPerUnit: t.materialCostPerUnit,
    disposalCostPerUnit: t.disposalCostPerUnit, laborHoursPerUnit: t.laborHoursPerUnit,
    laborHourlyRate: t.laborHourlyRate, description: t.description || '',
  });

  // Bereiche for filter: all static bereiche
  const allBereiche = [...BEREICHE_STATIC, ...BEREICHE_ENTKERNUNG_EXTRA];

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
            initial={{ phaseType: 'demolition', unit: 'm²', bereich: '', aussenanlageUnterpunkt: '', bereichUnterpunkt: '', materialCostPerUnit: 0, disposalCostPerUnit: 0, laborHoursPerUnit: 0, laborHourlyRate: 45 }}
            isSystem={false}
            onSaveNew={(data) => createMutation.mutate({
              ...data,
              phaseType: data.phaseType as PhaseType | 'all',
              bereich: data.bereich || undefined,
              aussenanlageUnterpunkt: data.bereich === 'Außenanlage' ? (data.aussenanlageUnterpunkt || undefined) : undefined,
              bereichUnterpunkt: (data.bereich && data.bereich in BEREICH_UNTERPUNKTE) ? (data.bereichUnterpunkt || undefined) : undefined,
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
                            ? <span className="badge bg-blue-50 text-blue-600 text-xs shrink-0">System</span>
                            : <span className="badge bg-emerald-50 text-emerald-600 text-xs shrink-0">Eigene</span>
                          }
                          {t.bereich && (
                            <span className="badge bg-violet-50 text-violet-600 text-xs shrink-0">
                              {t.bereich}
                              {t.bereichUnterpunkt ? ` · ${t.bereichUnterpunkt}` : t.aussenanlageUnterpunkt ? ` · ${t.aussenanlageUnterpunkt}` : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {PHASE_LABELS[t.phaseType]} · {t.unit}
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
                          aussenanlageUnterpunkt: data.bereich === 'Außenanlage' ? (data.aussenanlageUnterpunkt || undefined) : undefined,
                          bereichUnterpunkt: (data.bereich && data.bereich in BEREICH_UNTERPUNKTE) ? (data.bereichUnterpunkt || undefined) : undefined,
                          isSystemDefault: false,
                        })}
                        onUpdate={!t.isSystemDefault ? (data) => updateMutation.mutate({
                          id: t._id,
                          body: {
                            ...data,
                            phaseType: data.phaseType as PhaseType | 'all',
                            bereich: data.bereich || undefined,
                            aussenanlageUnterpunkt: data.bereich === 'Außenanlage' ? (data.aussenanlageUnterpunkt || undefined) : undefined,
                            bereichUnterpunkt: (data.bereich && data.bereich in BEREICH_UNTERPUNKTE) ? (data.bereichUnterpunkt || undefined) : undefined,
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
