import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useState } from 'react';
import { getProject, getContainers, getContainerSuggestion, createContainer, updateContainer, deleteContainer } from '../api/projects';
import type { Container } from '../types';

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export default function ContainerPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [showContainerForm, setShowContainerForm] = useState(false);
  const [editItem, setEditItem] = useState<Container | null>(null);

  const { data: project } = useQuery(['project', projectId], () => getProject(projectId!));
  const { data: containers = [] } = useQuery(['containers', projectId], () => getContainers(projectId!));
  const { data: suggestion } = useQuery(['containerSuggestion', projectId], () => getContainerSuggestion(projectId!));

  const invalidate = () => {
    qc.invalidateQueries(['containers', projectId]);
    qc.invalidateQueries(['summary', projectId]);
  };

  const deleteMutation = useMutation(
    (id: string) => deleteContainer(projectId!, id),
    { onSuccess: invalidate }
  );

  const addContainerMutation = useMutation(
    (body: Partial<Container>) => createContainer(projectId!, body),
    {
      onSuccess: () => { invalidate(); setShowContainerForm(false); },
      onError: (err: any) => { alert(err?.response?.data?.message ?? 'Fehler beim Speichern'); },
    }
  );

  const editMutation = useMutation(
    ({ id, body }: { id: string; body: Partial<Container> }) => updateContainer(projectId!, id, body),
    {
      onSuccess: () => { invalidate(); setShowContainerForm(false); setEditItem(null); },
      onError: (err: any) => { alert(err?.response?.data?.message ?? 'Fehler beim Speichern'); },
    }
  );

  const totalContainerCost = containers.reduce((sum, c) => sum + c.totalCost, 0);

  function handleAddClick() {
    if (editItem) { setEditItem(null); setShowContainerForm(true); }
    else setShowContainerForm(f => !f);
  }

  function handleEditClick(c: Container) {
    setEditItem(c);
    setShowContainerForm(true);
  }

  function handleFormSubmit(body: Partial<Container>) {
    if (editItem) editMutation.mutate({ id: editItem._id, body });
    else addContainerMutation.mutate(body);
  }

  function handleFormCancel() {
    setShowContainerForm(false);
    setEditItem(null);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/projects/${projectId}`} className="text-gray-400 hover:text-gray-600 text-sm">← Projekt</Link>
        <h1 className="text-2xl font-bold text-gray-900">Container & Entsorgung</h1>
        <span className="text-gray-400 text-sm">{project?.name}</span>
      </div>

      {/* Vorschlag */}
      {suggestion && suggestion.suggestion?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="font-medium text-amber-800 mb-1">Container-Vorschlag (basierend auf Abrissmengen)</p>
          <p className="text-amber-600 text-sm mb-2">
            Geschätztes Volumen: {suggestion.estimatedVolumeCbm} m³ kompakt / {suggestion.bulkVolumeCbm} m³ Schüttung
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestion.suggestion.map((s: any, i: number) => (
              <span key={i} className="bg-amber-100 text-amber-800 px-3 py-1 rounded text-sm">
                {s.count}× {s.sizeCubicMeters} m³ Container
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Container-Management */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Gebuchte Container</h2>
          <button onClick={handleAddClick} className="btn-secondary btn-sm">
            + Container buchen
          </button>
        </div>

        {showContainerForm && (
          <ContainerForm
            key={editItem?._id ?? 'new'}
            initial={editItem ?? undefined}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />
        )}

        {containers.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="table-cell text-left font-medium text-gray-600">Typ</th>
                  <th className="table-cell text-right font-medium text-gray-600">Größe</th>
                  <th className="table-cell text-right font-medium text-gray-600">Anzahl</th>
                  <th className="table-cell text-right font-medium text-gray-600">Preis/Stk</th>
                  <th className="table-cell text-right font-medium text-gray-600">Gesamt</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {containers.map((c) => (
                  <tr key={c._id} className={`hover:bg-gray-50 group ${editItem?._id === c._id ? 'bg-primary-50' : ''}`}>
                    <td className="table-cell">{c.type}</td>
                    <td className="table-cell text-right">{c.sizeCubicMeters} m³</td>
                    <td className="table-cell text-right">{c.quantity}×</td>
                    <td className="table-cell text-right">{eur(c.pricePerContainer)}</td>
                    <td className="table-cell text-right font-semibold">{eur(c.totalCost)}</td>
                    <td className="table-cell">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => handleEditClick(c)}
                          className="opacity-0 group-hover:opacity-100 btn-secondary btn-sm px-2"
                          title="Bearbeiten"
                        >✏</button>
                        <button
                          onClick={() => { if (confirm('Container löschen?')) deleteMutation.mutate(c._id); }}
                          className="opacity-0 group-hover:opacity-100 btn-danger btn-sm px-2"
                          title="Löschen"
                        >✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end pt-3 border-t border-gray-100 mt-2">
              <span className="text-sm font-semibold text-gray-700">
                Gesamtkosten Container: <span className="text-primary-700 ml-2">{eur(totalContainerCost)}</span>
              </span>
            </div>
          </>
        ) : (
          <p className="text-gray-400 text-sm py-6 text-center">Noch keine Container gebucht</p>
        )}
      </div>
    </div>
  );
}

function ContainerForm({
  onSubmit,
  onCancel,
  initial,
}: {
  onSubmit: (b: any) => void;
  onCancel: () => void;
  initial?: Container;
}) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    type:             initial?.type             ?? 'Bauschutt',
    sizeCubicMeters:  initial?.sizeCubicMeters  ?? 10,
    quantity:         initial?.quantity         ?? 1,
    pricePerContainer: initial?.pricePerContainer ?? 350,
    phaseType:        'specialConstruction',
    notes:            initial?.notes            ?? '',
  });

  return (
    <div className="border border-primary-200 rounded-lg p-4 mb-4 bg-primary-50/30">
      {isEdit && (
        <p className="text-xs font-semibold text-primary-700 mb-3 uppercase tracking-wide">Container bearbeiten</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="label">Typ</label>
          <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))} className="input">
            {['Bauschutt', 'GemischterAbfall', 'Sondermuell', 'Holz', 'Metall'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Größe (m³)</label>
          <select value={form.sizeCubicMeters} onChange={(e) => setForm(f => ({ ...f, sizeCubicMeters: +e.target.value }))} className="input">
            {[5, 7, 10, 20].map(s => <option key={s} value={s}>{s} m³</option>)}
          </select>
        </div>
        <div>
          <label className="label">Anzahl</label>
          <input value={form.quantity} onChange={(e) => setForm(f => ({ ...f, quantity: +e.target.value }))} type="number" min="1" className="input" />
        </div>
        <div>
          <label className="label">Preis pro Stück (€)</label>
          <input value={form.pricePerContainer} onChange={(e) => setForm(f => ({ ...f, pricePerContainer: +e.target.value }))} type="number" step="0.01" className="input" />
        </div>
        <div>
          <label className="label">Notiz</label>
          <input value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} className="input" placeholder="Optional" />
        </div>
      </div>
      <p className="text-sm text-primary-700 font-medium mb-3">
        Gesamtkosten: {(form.quantity * form.pricePerContainer).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
      </p>
      <div className="flex gap-2">
        <button onClick={() => onSubmit(form)} className="btn-primary btn-sm">
          {isEdit ? 'Speichern' : 'Buchen'}
        </button>
        <button onClick={onCancel} className="btn-secondary btn-sm">Abbrechen</button>
      </div>
    </div>
  );
}
