import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useState } from 'react';
import { getProject, getKraene, createKran, deleteKran } from '../api/projects';
import type { Kran } from '../types';

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

const PHASE_NAMES: Record<string, string> = {
  demolition: 'Entkernung', renovation: 'Renovierung', specialConstruction: 'Sonderarbeiten',
};

const KRAN_TYPES = ['Turmdrehkran', 'Mobilkran', 'Autokran', 'Raupenkran', 'Sonstiges'];

export default function KranPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: project } = useQuery(['project', projectId], () => getProject(projectId!));
  const { data: kraene = [] } = useQuery(['kraene', projectId], () => getKraene(projectId!));

  const deleteMutation = useMutation(
    (id: string) => deleteKran(projectId!, id),
    { onSuccess: () => { qc.invalidateQueries(['kraene', projectId]); qc.invalidateQueries(['summary', projectId]); } }
  );

  const addMutation = useMutation(
    (body: Partial<Kran>) => createKran(projectId!, body),
    { onSuccess: () => { qc.invalidateQueries(['kraene', projectId]); qc.invalidateQueries(['summary', projectId]); setShowForm(false); } }
  );

  const totalCost = kraene.reduce((sum, k) => sum + k.totalCost, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/projects/${projectId}`} className="text-gray-400 hover:text-gray-600 text-sm">← Projekt</Link>
        <h1 className="text-2xl font-bold text-gray-900">Kran</h1>
        <span className="text-gray-400 text-sm">{project?.name}</span>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Gebuchte Kräne</h2>
          <button onClick={() => setShowForm(!showForm)} className="btn-secondary btn-sm">
            + Kran buchen
          </button>
        </div>

        {showForm && (
          <KranForm
            onSubmit={(body) => addMutation.mutate(body)}
            onCancel={() => setShowForm(false)}
          />
        )}

        {kraene.length > 0 ? (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="table-cell text-left font-medium text-gray-600">Typ</th>
                  <th className="table-cell text-left font-medium text-gray-600">Phase</th>
                  <th className="table-cell text-right font-medium text-gray-600">Miettage</th>
                  <th className="table-cell text-right font-medium text-gray-600">Preis/Tag</th>
                  <th className="table-cell text-right font-medium text-gray-600">Fahrer/Tag</th>
                  <th className="table-cell text-right font-medium text-gray-600">Gesamt</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {kraene.map((k) => (
                  <tr key={k._id} className="hover:bg-gray-50 group">
                    <td className="table-cell">{k.type}</td>
                    <td className="table-cell text-gray-500">{PHASE_NAMES[k.phaseType] ?? k.phaseType}</td>
                    <td className="table-cell text-right">{k.rentalDays}</td>
                    <td className="table-cell text-right">{eur(k.pricePerDay)}</td>
                    <td className="table-cell text-right">{eur(k.operatorCostPerDay)}</td>
                    <td className="table-cell text-right font-semibold">{eur(k.totalCost)}</td>
                    <td className="table-cell">
                      <button
                        onClick={() => { if (confirm('Kran löschen?')) deleteMutation.mutate(k._id); }}
                        className="opacity-0 group-hover:opacity-100 btn-danger btn-sm px-2"
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end pt-3 border-t border-gray-100 mt-2">
              <span className="text-sm font-semibold text-gray-700">
                Gesamtkosten Kran: <span className="text-primary-700 ml-2">{eur(totalCost)}</span>
              </span>
            </div>
          </>
        ) : (
          <p className="text-gray-400 text-sm py-6 text-center">Noch kein Kran gebucht</p>
        )}
      </div>
    </div>
  );
}

function KranForm({ onSubmit, onCancel }: { onSubmit: (b: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    type: 'Turmdrehkran',
    rentalDays: 10,
    pricePerDay: 800,
    operatorCostPerDay: 350,
    phaseType: 'demolition',
    notes: '',
  });

  const preview = +(form.rentalDays * (form.pricePerDay + form.operatorCostPerDay)).toFixed(2);

  return (
    <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="label">Typ</label>
          <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))} className="input">
            {KRAN_TYPES.map(t => <option key={t}>{t}</option>)}
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
          <label className="label">Miettage</label>
          <input value={form.rentalDays} onChange={(e) => setForm(f => ({ ...f, rentalDays: +e.target.value }))} type="number" min="1" className="input" />
        </div>
        <div>
          <label className="label">Preis/Tag (€)</label>
          <input value={form.pricePerDay} onChange={(e) => setForm(f => ({ ...f, pricePerDay: +e.target.value }))} type="number" step="0.01" className="input" />
        </div>
        <div>
          <label className="label">Fahrerkosten/Tag (€)</label>
          <input value={form.operatorCostPerDay} onChange={(e) => setForm(f => ({ ...f, operatorCostPerDay: +e.target.value }))} type="number" step="0.01" className="input" />
        </div>
        <div>
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
