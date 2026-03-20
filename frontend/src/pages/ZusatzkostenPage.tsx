import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  getProject, getPositions, createPosition, updatePosition, deletePosition,
  getTemplates, createTemplate, updateTemplate, deleteTemplateApi,
} from '../api/projects';
import type { Position, PositionTemplate, PositionUnit, PhaseType } from '../types';

const UNITS: PositionUnit[] = ['m²', 'm³', 'lfm', 'Stück', 'Sack', 'kg', 'Psch', 't'];

interface ModuleConfig {
  label: string;
  bereich: string;
  defaultName: string;
  examples: string[];
}

const MODULE_CONFIG: Record<string, ModuleConfig> = {
  baunebenkosten: {
    label: 'Baunebenkosten',
    bereich: 'Baunebenkosten',
    defaultName: 'Architektenhonorar',
    examples: [
      'Architektenhonorar', 'Fachplaner (Statik)', 'SiGeKo',
      'Genehmigungen und Behörden', 'Projektsteuerung und Bauleitung', 'Versicherungen',
    ],
  },
  planungskosten: {
    label: 'Planungskosten',
    bereich: 'Planungskosten',
    defaultName: 'Bauplanung',
    examples: [
      'Bauplanung', 'Statik', 'Energieberatung', 'Ausführungsplanung', 'Vermessung', 'Bodengutachten',
    ],
  },
  ausstellung: {
    label: 'Ausstattung',
    bereich: 'Ausstattung',
    defaultName: 'Ausstattungskosten',
    examples: [
      'Ausstattungskosten', 'Musterwohnung', 'Broschüren und Werbematerial', 'Besichtigungsorganisation',
    ],
  },
  vertrieb: {
    label: 'Vertriebskosten',
    bereich: 'Vertrieb',
    defaultName: 'Maklerprovision',
    examples: [
      'Maklerprovision', 'Werbung', 'Exposé', 'Notarkosten', 'Grunderwerbsteuer',
    ],
  },
};

interface FormState {
  name: string;
  unit: PositionUnit;
  quantity: number;
  pricePerUnit: number;
  description: string;
}

function emptyForm(config: ModuleConfig): FormState {
  return { name: config.defaultName, unit: 'Psch', quantity: 1, pricePerUnit: 0, description: '' };
}

function formFromTemplate(t: PositionTemplate): FormState {
  return { name: t.name, unit: t.unit, quantity: 1, pricePerUnit: t.materialCostPerUnit, description: t.description || '' };
}

function PositionFormInline({
  initial,
  title,
  onSave,
  onCancel,
  saveLabel = 'Speichern',
  isSaving = false,
  extraAction,
}: {
  initial: FormState;
  title: string;
  onSave: (f: FormState) => void;
  onCancel: () => void;
  saveLabel?: string;
  isSaving?: boolean;
  extraAction?: { label: string; onClick: (f: FormState) => void };
}) {
  const [f, setF] = useState<FormState>(initial);
  const set = (k: keyof FormState, v: string | number) => setF(prev => ({ ...prev, [k]: v }));
  const preview = +(f.quantity * f.pricePerUnit).toFixed(2);

  return (
    <div className="border border-primary-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
      <p className="text-sm font-semibold text-primary-700">{title}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="label">Bezeichnung *</label>
          <input
            value={f.name}
            onChange={e => set('name', e.target.value)}
            className="input"
            placeholder="z.B. Architektenhonorar"
          />
        </div>
        <div>
          <label className="label">Einheit</label>
          <select value={f.unit} onChange={e => set('unit', e.target.value as PositionUnit)} className="input">
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Menge</label>
          <input
            type="number" min="0" step="0.01"
            value={f.quantity}
            onChange={e => set('quantity', +e.target.value || 0)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Kosten pro Einheit (€)</label>
          <input
            type="number" min="0" step="0.01"
            value={f.pricePerUnit}
            onChange={e => set('pricePerUnit', +e.target.value || 0)}
            className="input"
          />
        </div>
        <div className="flex items-end">
          {preview > 0 && (
            <p className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
              Gesamt: {preview.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="label">Beschreibung</label>
          <textarea
            value={f.description}
            onChange={e => set('description', e.target.value)}
            className="input resize-none"
            rows={2}
            placeholder="Optionale Beschreibung..."
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          onClick={() => onSave(f)}
          disabled={!f.name || isSaving}
          className="btn-primary text-sm disabled:opacity-60"
        >
          {isSaving ? 'Speichern…' : saveLabel}
        </button>
        {extraAction && (
          <button
            onClick={() => extraAction.onClick(f)}
            disabled={!f.name || isSaving}
            className="text-sm px-3 py-1.5 rounded-lg border border-primary-300 bg-primary-50 hover:bg-primary-100 text-primary-700 transition-colors disabled:opacity-60"
          >
            {extraAction.label}
          </button>
        )}
        <button onClick={onCancel} className="btn-secondary text-sm">Abbrechen</button>
      </div>
    </div>
  );
}

function TemplateFormInline({
  initial,
  title,
  onSave,
  onCancel,
}: {
  initial: { name: string; unit: PositionUnit; pricePerUnit: number; description: string };
  title: string;
  onSave: (f: { name: string; unit: PositionUnit; pricePerUnit: number; description: string }) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState(initial);
  const set = (k: string, v: string | number) => setF(prev => ({ ...prev, [k]: v }));

  return (
    <div className="border border-amber-200 rounded-xl p-4 bg-amber-50/40 shadow-sm space-y-3">
      <p className="text-sm font-semibold text-amber-700">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="label">Bezeichnung *</label>
          <input value={f.name} onChange={e => set('name', e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Einheit</label>
          <select value={f.unit} onChange={e => set('unit', e.target.value as PositionUnit)} className="input">
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Kosten pro Einheit (€)</label>
          <input type="number" min="0" step="0.01" value={f.pricePerUnit} onChange={e => set('pricePerUnit', +e.target.value || 0)} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Beschreibung</label>
          <textarea value={f.description} onChange={e => set('description', e.target.value)} className="input resize-none" rows={2} />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave(f)} disabled={!f.name} className="btn-primary text-sm">Speichern</button>
        <button onClick={onCancel} className="btn-secondary text-sm">Abbrechen</button>
      </div>
    </div>
  );
}

export default function ZusatzkostenPage() {
  const { id: projectId, module: moduleKey } = useParams<{ id: string; module: string }>();
  const config = MODULE_CONFIG[moduleKey!];
  const qc = useQueryClient();

  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormInitial, setAddFormInitial] = useState<FormState | null>(null);
  const [editPos, setEditPos] = useState<Position | null>(null);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [editTemplate, setEditTemplate] = useState<PositionTemplate | null>(null);
  const [showTemplateSection, setShowTemplateSection] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: project } = useQuery(['project', projectId], () => getProject(projectId!));

  const { data: positions = [] } = useQuery(
    ['positions', 'modul', projectId, moduleKey],
    () => getPositions(projectId!, { phaseType: moduleKey }),
    { enabled: !!projectId && !!moduleKey },
  );

  const { data: templates = [] } = useQuery(
    ['templates', moduleKey],
    () => getTemplates(moduleKey),
    { enabled: !!moduleKey },
  );

  const invPos = () => qc.invalidateQueries(['positions', 'modul', projectId, moduleKey]);
  const invTpl = () => qc.invalidateQueries(['templates', moduleKey]);

  const handleError = (err: unknown) => {
    const msg = (err as any)?.response?.data?.message || (err as any)?.message || 'Unbekannter Fehler';
    setErrorMsg(msg);
  };

  const createPosMut = useMutation(
    (f: FormState) => createPosition(projectId!, {
      phaseType: moduleKey as PhaseType,
      bereich: config.bereich,
      name: f.name,
      unit: f.unit,
      quantity: f.quantity,
      materialCostPerUnit: f.pricePerUnit,
      disposalCostPerUnit: 0,
      laborHoursPerUnit: 0,
      laborHourlyRate: 0,
      description: f.description || undefined,
      category: config.label,
    }),
    {
      onSuccess: () => { invPos(); setShowAddForm(false); setAddFormInitial(null); setErrorMsg(null); },
      onError: handleError,
    },
  );

  const updatePosMut = useMutation(
    ({ id, f }: { id: string; f: FormState }) => updatePosition(projectId!, id, {
      name: f.name,
      unit: f.unit,
      quantity: f.quantity,
      materialCostPerUnit: f.pricePerUnit,
      disposalCostPerUnit: 0,
      laborHoursPerUnit: 0,
      description: f.description || undefined,
    }),
    {
      onSuccess: () => { invPos(); setEditPos(null); setErrorMsg(null); },
      onError: handleError,
    },
  );

  const deletePosMut = useMutation(
    (id: string) => deletePosition(projectId!, id),
    { onSuccess: invPos, onError: handleError },
  );

  const createTplMut = useMutation(
    (f: { name: string; unit: PositionUnit; pricePerUnit: number; description: string }) =>
      createTemplate({
        phaseType: moduleKey as PhaseType,
        bereich: config.bereich,
        name: f.name,
        unit: f.unit,
        materialCostPerUnit: f.pricePerUnit,
        disposalCostPerUnit: 0,
        laborHoursPerUnit: 0,
        laborHourlyRate: 0,
        description: f.description || undefined,
        category: config.label,
      }),
    { onSuccess: () => { invTpl(); setShowNewTemplate(false); }, onError: handleError },
  );

  const updateTplMut = useMutation(
    ({ id, f }: { id: string; f: { name: string; unit: PositionUnit; pricePerUnit: number; description: string } }) =>
      updateTemplate(id, {
        name: f.name, unit: f.unit,
        materialCostPerUnit: f.pricePerUnit,
        description: f.description || undefined,
      }),
    { onSuccess: () => { invTpl(); setEditTemplate(null); }, onError: handleError },
  );

  const deleteTplMut = useMutation(
    (id: string) => deleteTemplateApi(id),
    { onSuccess: invTpl, onError: handleError },
  );

  const positionsList = positions as Position[];
  const templatesList = templates as PositionTemplate[];
  const totalSum = positionsList.reduce((s, p) => s + p.totalCost, 0);

  const isCreating = createPosMut.isLoading;
  const isUpdating = updatePosMut.isLoading;

  if (!config) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-red-600">Unbekanntes Modul: {moduleKey}</p>
        <Link to="/" className="text-primary-600">← Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-6">
        <Link to={`/projects/${projectId}`} className="text-gray-400 hover:text-gray-600 text-sm">← Projekt</Link>
        <h1 className="text-xl font-bold text-gray-900">{project?.name} – {config.label}</h1>
        {totalSum > 0 && (
          <span className="ml-auto text-sm font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1 rounded-full">
            Gesamt: {totalSum.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          </span>
        )}
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          <span className="font-semibold shrink-0">Fehler:</span>
          <span className="flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="shrink-0 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Vorlagen-Bereich */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setShowTemplateSection(s => !s)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-primary-600 transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform ${showTemplateSection ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Vorlagen ({templatesList.length})
          </button>
          <button
            onClick={() => { setShowNewTemplate(true); setEditTemplate(null); }}
            className="text-xs px-2.5 py-1 rounded-lg border border-primary-300 bg-primary-50 hover:bg-primary-100 text-primary-700"
          >
            + Neue Vorlage
          </button>
        </div>

        {showTemplateSection && (
          <div className="space-y-2">
            {/* Quick-Add Buttons: Vorlage übernehmen und Formular vorausfüllen */}
            {templatesList.length > 0 && !showNewTemplate && !editTemplate && (
              <div className="flex flex-wrap gap-2 mb-3">
                {templatesList.map(t => (
                  <button
                    key={t._id}
                    onClick={() => {
                      setAddFormInitial(formFromTemplate(t));
                      setShowAddForm(true);
                      setEditPos(null);
                    }}
                    title={`Vorlage "${t.name}" übernehmen`}
                    className="text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-primary-300 hover:bg-primary-50 text-slate-700 shadow-sm transition-all"
                  >
                    {t.name}
                    {t.materialCostPerUnit > 0 && <span className="text-slate-400 ml-1">{t.materialCostPerUnit.toLocaleString('de-DE')} €/{t.unit}</span>}
                  </button>
                ))}
              </div>
            )}

            {/* Vorlagen verwalten */}
            {templatesList.map(t => (
              <div key={t._id}>
                {editTemplate?._id === t._id ? (
                  <TemplateFormInline
                    title={`Vorlage bearbeiten: ${t.name}`}
                    initial={{ name: t.name, unit: t.unit, pricePerUnit: t.materialCostPerUnit, description: t.description || '' }}
                    onSave={(f) => updateTplMut.mutate({ id: t._id, f })}
                    onCancel={() => setEditTemplate(null)}
                  />
                ) : (
                  <div className="group flex items-center justify-between bg-amber-50/40 border border-amber-100 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-700">{t.name}</span>
                      <span className="text-xs text-slate-400 ml-2">{t.unit}</span>
                      {t.materialCostPerUnit > 0 && (
                        <span className="text-xs text-slate-500 ml-2">{t.materialCostPerUnit.toLocaleString('de-DE')} €/{t.unit}</span>
                      )}
                      {t.description && <span className="text-xs text-slate-400 ml-2 truncate">· {t.description}</span>}
                    </div>
                    <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditTemplate(t)}
                        className="text-xs px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                      >✏</button>
                      <button
                        onClick={() => { if (confirm(`Vorlage "${t.name}" löschen?`)) deleteTplMut.mutate(t._id); }}
                        className="text-xs px-2 py-1 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-600"
                      >✕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {templatesList.length === 0 && !showNewTemplate && (
              <p className="text-xs text-slate-400 italic">Noch keine Vorlagen – "+ Neue Vorlage" klicken</p>
            )}

            {showNewTemplate && (
              <TemplateFormInline
                title="Neue Vorlage anlegen"
                initial={{ name: config.defaultName, unit: 'Psch', pricePerUnit: 0, description: '' }}
                onSave={(f) => createTplMut.mutate(f)}
                onCancel={() => setShowNewTemplate(false)}
              />
            )}
          </div>
        )}
      </div>

      {/* Positionen */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">
            Positionen ({positionsList.length})
          </h2>
          {!showAddForm && !editPos && (
            <button onClick={() => { setAddFormInitial(null); setShowAddForm(true); }} className="btn-primary text-sm">
              + Position hinzufügen
            </button>
          )}
        </div>

        {/* Add Form */}
        {showAddForm && !editPos && (
          <PositionFormInline
            title="Neue Position"
            initial={addFormInitial ?? emptyForm(config)}
            onSave={(f) => createPosMut.mutate(f)}
            onCancel={() => { setShowAddForm(false); setAddFormInitial(null); }}
            saveLabel="Position anlegen"
            isSaving={isCreating}
            extraAction={{
              label: 'Anlegen + als Vorlage speichern',
              onClick: (f) => {
                createPosMut.mutate(f);
                createTplMut.mutate({ name: f.name, unit: f.unit, pricePerUnit: f.pricePerUnit, description: f.description });
              },
            }}
          />
        )}

        {/* Position List */}
        {positionsList.length === 0 && !showAddForm && (
          <div className="card text-center py-10 text-gray-400">
            <p className="mb-3">Noch keine Positionen angelegt</p>
            <button onClick={() => { setAddFormInitial(null); setShowAddForm(true); }} className="btn-primary">+ Position hinzufügen</button>
          </div>
        )}

        {positionsList.map(p => (
          <div key={p._id}>
            {editPos?._id === p._id ? (
              <PositionFormInline
                title={`Bearbeiten: ${p.name}`}
                initial={{ name: p.name, unit: p.unit, quantity: p.quantity, pricePerUnit: p.materialCostPerUnit, description: p.description || '' }}
                onSave={(f) => updatePosMut.mutate({ id: p._id, f })}
                onCancel={() => setEditPos(null)}
                saveLabel="Änderungen speichern"
                isSaving={isUpdating}
              />
            ) : (
              <div className="group flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm hover:border-primary-200 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{p.name}</p>
                  <p className="text-xs text-slate-400">
                    {p.quantity} {p.unit}
                    {p.materialCostPerUnit > 0 && ` · ${p.materialCostPerUnit.toLocaleString('de-DE')} €/${p.unit}`}
                    {p.description && ` · ${p.description}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-3">
                  {p.totalCost > 0 && (
                    <span className="text-sm font-semibold text-emerald-700 shrink-0">
                      {p.totalCost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </span>
                  )}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditPos(p); setShowAddForm(false); }}
                      className="text-xs px-2 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"
                    >✏</button>
                    <button
                      onClick={() => { if (confirm(`Position "${p.name}" löschen?`)) deletePosMut.mutate(p._id); }}
                      className="text-xs px-2 py-1 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-600"
                    >✕</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
