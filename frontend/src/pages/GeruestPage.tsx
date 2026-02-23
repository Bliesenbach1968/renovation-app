import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useState } from 'react';
import { getProject, getGerueste, createGeruest, deleteGeruest } from '../api/projects';
import type { Geruest } from '../types';

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

const PHASE_NAMES: Record<string, string> = {
  demolition: 'Entkernung', renovation: 'Renovierung', specialConstruction: 'Sonderarbeiten',
};

const GERUEST_TYPES = ['Fassadengerüst', 'Innengerüst', 'Hängegerüst', 'Schutzgerüst', 'Sonstiges'];

export default function GeruestPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: project } = useQuery(['project', projectId], () => getProject(projectId!));
  const { data: gerueste = [] } = useQuery(['gerueste', projectId], () => getGerueste(projectId!));

  const deleteMutation = useMutation(
    (id: string) => deleteGeruest(projectId!, id),
    { onSuccess: () => { qc.invalidateQueries(['gerueste', projectId]); qc.invalidateQueries(['summary', projectId]); } }
  );

  const addMutation = useMutation(
    (body: Partial<Geruest>) => createGeruest(projectId!, body),
    { onSuccess: () => { qc.invalidateQueries(['gerueste', projectId]); qc.invalidateQueries(['summary', projectId]); setShowForm(false); } }
  );

  const totalCost = gerueste.reduce((sum, g) => sum + g.totalCost, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/projects/${projectId}`} className="text-gray-400 hover:text-gray-600 text-sm">← Projekt</Link>
        <h1 className="text-2xl font-bold text-gray-900">Gerüst</h1>
        <span className="text-gray-400 text-sm">{project?.name}</span>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Gebuchte Gerüste</h2>
          <button onClick={() => setShowForm(!showForm)} className="btn-secondary btn-sm">
            + Gerüst buchen
          </button>
        </div>

        {showForm && (
          <GeruestForm
            onSubmit={(body) => addMutation.mutate(body)}
            onCancel={() => setShowForm(false)}
          />
        )}

        {gerueste.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="table-cell text-left font-medium text-gray-600">Typ</th>
                  <th className="table-cell text-left font-medium text-gray-600">Phase</th>
                  <th className="table-cell text-right font-medium text-gray-600">Fläche (m²)</th>
                  <th className="table-cell text-right font-medium text-gray-600">Wochen</th>
                  <th className="table-cell text-right font-medium text-gray-600">Preis/m²/Wo.</th>
                  <th className="table-cell text-right font-medium text-gray-600">Auf-/Abbau</th>
                  <th className="table-cell text-right font-medium text-gray-600">Gesamt</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {gerueste.map((g) => (
                  <tr key={g._id} className="hover:bg-gray-50 group">
                    <td className="table-cell">{g.type}</td>
                    <td className="table-cell text-gray-500">{PHASE_NAMES[g.phaseType] ?? g.phaseType}</td>
                    <td className="table-cell text-right">{g.areaSqm}</td>
                    <td className="table-cell text-right">{g.rentalWeeks}</td>
                    <td className="table-cell text-right">{eur(g.pricePerSqmPerWeek)}</td>
                    <td className="table-cell text-right">{eur(g.assemblyDisassemblyCost)}</td>
                    <td className="table-cell text-right font-semibold">{eur(g.totalCost)}</td>
                    <td className="table-cell">
                      <button
                        onClick={() => { if (confirm('Gerüst löschen?')) deleteMutation.mutate(g._id); }}
                        className="opacity-0 group-hover:opacity-100 btn-danger btn-sm px-2"
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end pt-3 border-t border-gray-100 mt-2">
              <span className="text-sm font-semibold text-gray-700">
                Gesamtkosten Gerüst: <span className="text-primary-700 ml-2">{eur(totalCost)}</span>
              </span>
            </div>
          </>
        ) : (
          <p className="text-gray-400 text-sm py-6 text-center">Noch kein Gerüst gebucht</p>
        )}
      </div>
    </div>
  );
}

function GeruestForm({ onSubmit, onCancel }: { onSubmit: (b: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    type: 'Fassadengerüst',
    areaSqm: 100,
    rentalWeeks: 4,
    pricePerSqmPerWeek: 2.5,
    assemblyDisassemblyCost: 500,
    phaseType: 'demolition',
    notes: '',
  });

  const preview = +(form.areaSqm * form.rentalWeeks * form.pricePerSqmPerWeek + form.assemblyDisassemblyCost).toFixed(2);

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="label">Typ</label>
          <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))} className="input">
            {GERUEST_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Phase</label>
          <select value={form.phaseType} onChange={(e) => setForm(f => ({ ...f, phaseType: e.target.value }))} className="input">
            <option value="demolition">Entkernung</option>
            <option value="renovation">Renovierung</option>
            <option value="specialConstruction">Sonderarbeiten</option>
          </select>
        </div>
        <div>
          <label className="label">Fläche (m²)</label>
          <input value={form.areaSqm} onChange={(e) => setForm(f => ({ ...f, areaSqm: +e.target.value }))} type="number" min="0" step="0.1" className="input" />
        </div>
        <div>
          <label className="label">Mietwochen</label>
          <input value={form.rentalWeeks} onChange={(e) => setForm(f => ({ ...f, rentalWeeks: +e.target.value }))} type="number" min="1" className="input" />
        </div>
        <div>
          <label className="label">Preis/m²/Woche (€)</label>
          <input value={form.pricePerSqmPerWeek} onChange={(e) => setForm(f => ({ ...f, pricePerSqmPerWeek: +e.target.value }))} type="number" step="0.01" className="input" />
        </div>
        <div>
          <label className="label">Auf-/Abbaukosten (€)</label>
          <input value={form.assemblyDisassemblyCost} onChange={(e) => setForm(f => ({ ...f, assemblyDisassemblyCost: +e.target.value }))} type="number" step="0.01" className="input" />
        </div>
        <div className="md:col-span-3">
          <label className="label">Notiz</label>
          <input value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} className="input" placeholder="Optional" />
        </div>
      </div>
      <p className="text-sm text-primary-700 font-medium mb-3">
        Gesamtkosten: {preview.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
      </p>
      <div className="flex gap-2">
        <button onClick={() => onSubmit(form)} className="btn-primary btn-sm">Buchen</button>
        <button onClick={onCancel} className="btn-secondary btn-sm">Abbrechen</button>
      </div>
    </div>
  );
}
