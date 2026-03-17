import React, { useState, useMemo, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  getProject, getFloors, getRooms, createFloor, createRoom, deleteRoom, deleteFloor,
  getUnits, createUnit, updateUnit, deleteUnit, getTemplates, getPositions, createPosition, updatePosition, deletePosition,
  getContainers, createContainer, updateContainer, deleteContainer,
  getGerueste, createGeruest, updateGeruest, deleteGeruest,
  getKraene, createKran, updateKran, deleteKran,
  copyRoom,
} from '../api/projects';
import type { Floor, Unit, Room, PhaseType, PositionTemplate, Position, Container, Geruest, Kran } from '../types';
import PositionForm, { getBereicheForPhase } from '../components/PositionForm';
import CopyApartmentDialog from '../components/CopyApartmentDialog';

const ROOM_TYPE_LABELS: Record<string, string> = {
  livingRoom: 'Wohnzimmer', bedroom: 'Schlafzimmer', bathroom: 'Bad/WC',
  kitchen: 'Küche', hallway: 'Flur', staircase: 'Treppenhaus',
  elevator: 'Aufzug', garage: 'Garage', basement: 'Keller',
  technicalRoom: 'Technikraum', balcony: 'Balkon', terrace: 'Terrasse',
  garden: 'Garten/Außenbereich', rooftop: 'Dach', other: 'Sonstiges',
};

const LEVEL_NAMES: Record<number, string> = {
  [-3]: 'Tiefgarage 2. UG', [-2]: 'Tiefgarage', [-1]: 'Keller',
  0: 'Erdgeschoss',
  1: '1. Obergeschoss',  2: '2. Obergeschoss',  3: '3. Obergeschoss',
  4: '4. Obergeschoss',  5: '5. Obergeschoss',  6: '6. Obergeschoss',
  7: '7. Obergeschoss',  8: '8. Obergeschoss',  9: '9. Obergeschoss',
  10: '10. Obergeschoss', 11: '11. Obergeschoss', 12: '12. Obergeschoss',
  13: '13. Obergeschoss', 14: '14. Obergeschoss', 15: '15. Obergeschoss',
  16: '16. Obergeschoss', 17: '17. Obergeschoss', 18: '18. Obergeschoss',
  19: '19. Obergeschoss', 20: 'Dachgeschoss',
};

const CONTAINER_TYPES = ['Bauschutt', 'GemischterAbfall', 'Sondermuell', 'Holz', 'Metall'];
const GERUEST_TYPES = ['Fassadengerüst', 'Innengerüst', 'Hängegerüst', 'Schutzgerüst', 'Traggerüst', 'Raumgerüst', 'Arbeitsgerüst', 'Sonstiges'];
const KRAN_TYPES = ['Turmdrehkran', 'Mobilkran', 'Autokran', 'Raupenkran', 'Sonstiges'];
function eur(n: number) { return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }); }

function ContainerPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Container | null>(null);
  const { data: items = [] } = useQuery(['containers', projectId], () => getContainers(projectId));
  const inv = () => { qc.invalidateQueries(['containers', projectId]); qc.invalidateQueries(['summary', projectId]); };
  const addMut = useMutation((b: any) => createContainer(projectId, b), { onSuccess: () => { inv(); setShowForm(false); } });
  const editMut = useMutation(({ id, b }: any) => updateContainer(projectId, id, b), { onSuccess: () => { inv(); setShowForm(false); setEditItem(null); } });
  const delMut = useMutation((id: string) => deleteContainer(projectId, id), { onSuccess: inv });

  const [form, setForm] = useState({ type: 'Bauschutt', sizeCubicMeters: 10, quantity: 1, pricePerContainer: 350, notes: '' });

  function openNew() { setEditItem(null); setForm({ type: 'Bauschutt', sizeCubicMeters: 10, quantity: 1, pricePerContainer: 350, notes: '' }); setShowForm(true); }
  function openEdit(c: Container) { setEditItem(c); setForm({ type: c.type, sizeCubicMeters: c.sizeCubicMeters, quantity: c.quantity, pricePerContainer: c.pricePerContainer, notes: c.notes ?? '' }); setShowForm(true); }
  function submit() {
    const body = { ...form, phaseType: 'specialConstruction' };
    if (editItem) editMut.mutate({ id: editItem._id, b: body });
    else addMut.mutate(body);
  }

  const total = (items as Container[]).reduce((s, c) => s + c.totalCost, 0);
  return (
    <div className="border border-primary-200/60 bg-primary-50/30 rounded-xl p-4 mb-4 shadow-sm">
      <h3 className="font-semibold text-slate-700 text-sm mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />Container & Entsorgung
      </h3>
      {showForm && (
        <div className="border border-primary-200 rounded-lg p-3 mb-3 bg-white space-y-2">
          {editItem && <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide">Bearbeiten</p>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div><label className="label">Typ</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input">
                {CONTAINER_TYPES.map(t => <option key={t}>{t}</option>)}
              </select></div>
            <div><label className="label">Größe (m³)</label>
              <select value={form.sizeCubicMeters} onChange={e => setForm(f => ({ ...f, sizeCubicMeters: +e.target.value }))} className="input">
                {[5,7,10,20].map(s => <option key={s} value={s}>{s} m³</option>)}
              </select></div>
            <div><label className="label">Anzahl</label>
              <input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: +e.target.value }))} className="input" /></div>
            <div><label className="label">Preis/Stk (€)</label>
              <input type="number" step="0.01" value={form.pricePerContainer} onChange={e => setForm(f => ({ ...f, pricePerContainer: +e.target.value }))} className="input" /></div>
            <div><label className="label">Notiz</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input" placeholder="Optional" /></div>
          </div>
          <p className="text-sm text-primary-700 font-medium">{eur(form.quantity * form.pricePerContainer)}</p>
          <div className="flex gap-2">
            <button onClick={submit} className="btn-primary btn-sm">{editItem ? 'Speichern' : 'Buchen'}</button>
            <button onClick={() => { setShowForm(false); setEditItem(null); }} className="btn-secondary btn-sm">Abbrechen</button>
          </div>
        </div>
      )}
      <button onClick={openNew} className="btn-primary w-full text-sm py-2 mb-3">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        + Container buchen
      </button>
      {(items as Container[]).length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-0.5">Gebuchte Container ({(items as Container[]).length})</p>
          {(items as Container[]).map(c => (
            <div key={c._id} className="group flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-800">{c.type} – {c.sizeCubicMeters} m³</span>
                <span className="text-xs text-slate-400 block">{c.quantity}× · {eur(c.totalCost)}</span>
              </div>
              <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(c)} className="text-xs px-2 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600">✏</button>
                <button onClick={() => { if (confirm('Container löschen?')) delMut.mutate(c._id); }} className="text-xs px-2 py-1 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-600">✕</button>
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-1 text-sm font-semibold text-slate-700">Gesamt: <span className="ml-2 text-primary-700">{eur(total)}</span></div>
        </div>
      )}
    </div>
  );
}

function GeruestPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Geruest | null>(null);
  const { data: items = [] } = useQuery(['gerueste', projectId], () => getGerueste(projectId));
  const inv = () => { qc.invalidateQueries(['gerueste', projectId]); qc.invalidateQueries(['summary', projectId]); };
  const addMut = useMutation((b: any) => createGeruest(projectId, b), { onSuccess: () => { inv(); setShowForm(false); } });
  const editMut = useMutation(({ id, b }: any) => updateGeruest(projectId, id, b), { onSuccess: () => { inv(); setShowForm(false); setEditItem(null); } });
  const delMut = useMutation((id: string) => deleteGeruest(projectId, id), { onSuccess: inv });

  const [form, setForm] = useState({ type: 'Fassadengerüst', areaSqm: 100, rentalWeeks: 4, pricePerSqmPerWeek: 2.5, assemblyDisassemblyCost: 500, notes: '' });

  function openNew() { setEditItem(null); setForm({ type: 'Fassadengerüst', areaSqm: 100, rentalWeeks: 4, pricePerSqmPerWeek: 2.5, assemblyDisassemblyCost: 500, notes: '' }); setShowForm(true); }
  function openEdit(g: Geruest) { setEditItem(g); setForm({ type: g.type, areaSqm: g.areaSqm, rentalWeeks: g.rentalWeeks, pricePerSqmPerWeek: g.pricePerSqmPerWeek, assemblyDisassemblyCost: g.assemblyDisassemblyCost, notes: g.notes ?? '' }); setShowForm(true); }
  function submit() {
    const body = { ...form, phaseType: 'specialConstruction' };
    if (editItem) editMut.mutate({ id: editItem._id, b: body });
    else addMut.mutate(body);
  }
  const preview = +(form.areaSqm * form.rentalWeeks * form.pricePerSqmPerWeek + form.assemblyDisassemblyCost).toFixed(2);
  const total = (items as Geruest[]).reduce((s, g) => s + g.totalCost, 0);
  return (
    <div className="border border-primary-200/60 bg-primary-50/30 rounded-xl p-4 mb-4 shadow-sm">
      <h3 className="font-semibold text-slate-700 text-sm mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />Gerüst
      </h3>
      {showForm && (
        <div className="border border-primary-200 rounded-lg p-3 mb-3 bg-white space-y-2">
          {editItem && <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide">Bearbeiten</p>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div><label className="label">Typ</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input">
                {GERUEST_TYPES.map(t => <option key={t}>{t}</option>)}
              </select></div>
            <div><label className="label">Fläche (m²)</label>
              <input type="number" step="0.1" value={form.areaSqm} onChange={e => setForm(f => ({ ...f, areaSqm: +e.target.value }))} className="input" /></div>
            <div><label className="label">Mietwochen</label>
              <input type="number" min="1" value={form.rentalWeeks} onChange={e => setForm(f => ({ ...f, rentalWeeks: +e.target.value }))} className="input" /></div>
            <div><label className="label">Preis/m²/Wo. (€)</label>
              <input type="number" step="0.01" value={form.pricePerSqmPerWeek} onChange={e => setForm(f => ({ ...f, pricePerSqmPerWeek: +e.target.value }))} className="input" /></div>
            <div><label className="label">Auf-/Abbau (€)</label>
              <input type="number" step="0.01" value={form.assemblyDisassemblyCost} onChange={e => setForm(f => ({ ...f, assemblyDisassemblyCost: +e.target.value }))} className="input" /></div>
            <div><label className="label">Notiz</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input" placeholder="Optional" /></div>
          </div>
          <p className="text-sm text-primary-700 font-medium">{eur(preview)}</p>
          <div className="flex gap-2">
            <button onClick={submit} className="btn-primary btn-sm">{editItem ? 'Speichern' : 'Buchen'}</button>
            <button onClick={() => { setShowForm(false); setEditItem(null); }} className="btn-secondary btn-sm">Abbrechen</button>
          </div>
        </div>
      )}
      <button onClick={openNew} className="btn-primary w-full text-sm py-2 mb-3">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        + Gerüst buchen
      </button>
      {(items as Geruest[]).length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-0.5">Gebuchte Gerüste ({(items as Geruest[]).length})</p>
          {(items as Geruest[]).map(g => (
            <div key={g._id} className="group flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-800">{g.type}</span>
                <span className="text-xs text-slate-400 block">{g.areaSqm} m² · {g.rentalWeeks} Wo. · {eur(g.totalCost)}</span>
              </div>
              <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(g)} className="text-xs px-2 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600">✏</button>
                <button onClick={() => { if (confirm('Gerüst löschen?')) delMut.mutate(g._id); }} className="text-xs px-2 py-1 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-600">✕</button>
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-1 text-sm font-semibold text-slate-700">Gesamt: <span className="ml-2 text-primary-700">{eur(total)}</span></div>
        </div>
      )}
    </div>
  );
}

function KranPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Kran | null>(null);
  const { data: items = [] } = useQuery(['kraene', projectId], () => getKraene(projectId));
  const inv = () => { qc.invalidateQueries(['kraene', projectId]); qc.invalidateQueries(['summary', projectId]); };
  const addMut = useMutation((b: any) => createKran(projectId, b), { onSuccess: () => { inv(); setShowForm(false); } });
  const editMut = useMutation(({ id, b }: any) => updateKran(projectId, id, b), { onSuccess: () => { inv(); setShowForm(false); setEditItem(null); } });
  const delMut = useMutation((id: string) => deleteKran(projectId, id), { onSuccess: inv });

  const [form, setForm] = useState({ type: 'Turmdrehkran', rentalDays: 10, pricePerDay: 800, operatorCostPerDay: 350, notes: '' });

  function openNew() { setEditItem(null); setForm({ type: 'Turmdrehkran', rentalDays: 10, pricePerDay: 800, operatorCostPerDay: 350, notes: '' }); setShowForm(true); }
  function openEdit(k: Kran) { setEditItem(k); setForm({ type: k.type, rentalDays: k.rentalDays, pricePerDay: k.pricePerDay, operatorCostPerDay: k.operatorCostPerDay, notes: k.notes ?? '' }); setShowForm(true); }
  function submit() {
    const body = { ...form, phaseType: 'specialConstruction' };
    if (editItem) editMut.mutate({ id: editItem._id, b: body });
    else addMut.mutate(body);
  }
  const preview = +(form.rentalDays * (form.pricePerDay + form.operatorCostPerDay)).toFixed(2);
  const total = (items as Kran[]).reduce((s, k) => s + k.totalCost, 0);
  return (
    <div className="border border-primary-200/60 bg-primary-50/30 rounded-xl p-4 mb-4 shadow-sm">
      <h3 className="font-semibold text-slate-700 text-sm mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />Kran
      </h3>
      {showForm && (
        <div className="border border-primary-200 rounded-lg p-3 mb-3 bg-white space-y-2">
          {editItem && <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide">Bearbeiten</p>}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div><label className="label">Typ</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input">
                {KRAN_TYPES.map(t => <option key={t}>{t}</option>)}
              </select></div>
            <div><label className="label">Miettage</label>
              <input type="number" min="1" value={form.rentalDays} onChange={e => setForm(f => ({ ...f, rentalDays: +e.target.value }))} className="input" /></div>
            <div><label className="label">Preis/Tag (€)</label>
              <input type="number" step="0.01" value={form.pricePerDay} onChange={e => setForm(f => ({ ...f, pricePerDay: +e.target.value }))} className="input" /></div>
            <div><label className="label">Fahrer/Tag (€)</label>
              <input type="number" step="0.01" value={form.operatorCostPerDay} onChange={e => setForm(f => ({ ...f, operatorCostPerDay: +e.target.value }))} className="input" /></div>
            <div><label className="label">Notiz</label>
              <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input" placeholder="Optional" /></div>
          </div>
          <p className="text-sm text-primary-700 font-medium">{eur(preview)}</p>
          <div className="flex gap-2">
            <button onClick={submit} className="btn-primary btn-sm">{editItem ? 'Speichern' : 'Buchen'}</button>
            <button onClick={() => { setShowForm(false); setEditItem(null); }} className="btn-secondary btn-sm">Abbrechen</button>
          </div>
        </div>
      )}
      <button onClick={openNew} className="btn-primary w-full text-sm py-2 mb-3">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        + Kran buchen
      </button>
      {(items as Kran[]).length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pb-0.5">Gebuchte Kräne ({(items as Kran[]).length})</p>
          {(items as Kran[]).map(k => (
            <div key={k._id} className="group flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-slate-800">{k.type}</span>
                <span className="text-xs text-slate-400 block">{k.rentalDays} Tage · {eur(k.totalCost)}</span>
              </div>
              <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(k)} className="text-xs px-2 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600">✏</button>
                <button onClick={() => { if (confirm('Kran löschen?')) delMut.mutate(k._id); }} className="text-xs px-2 py-1 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-600">✕</button>
              </div>
            </div>
          ))}
          <div className="flex justify-end pt-1 text-sm font-semibold text-slate-700">Gesamt: <span className="ml-2 text-primary-700">{eur(total)}</span></div>
        </div>
      )}
    </div>
  );
}

const SPECIAL_BEREICHE = ['Container & Entsorgung', 'Gerüst', 'Kran'];

const PINNABLE_BEREICHE = [
  'II. Treppenhaus',
  'III. Außenanlage',
  'IV. Elektrik',
  'VI. Dach',
  'VII. Fenster',
  'VIII. Fassade',
  'IX. Keller',
  'XI. Pauschale Kosten',
];

function BereichPositionsPanel({
  projectId, phase, bereich, unterpunkt, onAdd, onEdit, onDismiss,
}: {
  projectId: string;
  phase: string;
  bereich: string;
  unterpunkt?: string;
  onAdd: (template?: PositionTemplate) => void;
  onEdit: (position: Position) => void;
  onDismiss?: () => void;
}) {
  const qc = useQueryClient();

  const { data: allTemplates = [] } = useQuery(
    ['templates', phase],
    () => getTemplates(phase || undefined)
  );
  const templates = (allTemplates as PositionTemplate[]).filter(t =>
    t.bereich === bereich &&
    (!unterpunkt || !t.bereichUnterpunkt || t.bereichUnterpunkt === unterpunkt)
  );

  const { data: bereichPositions = [] } = useQuery(
    ['positions', 'bereich', projectId, phase, bereich, unterpunkt],
    () => getPositions(projectId, { phaseType: phase, bereich, noRoom: 'true' })
  );

  const deleteMutation = useMutation(
    (posId: string) => deletePosition(projectId, posId),
    { onSuccess: () => qc.invalidateQueries(['positions', 'bereich', projectId]) }
  );

  const filteredPositions = (bereichPositions as Position[]).filter(p =>
    !unterpunkt || !p.bereichUnterpunkt || p.bereichUnterpunkt === unterpunkt
  );

  const title = unterpunkt ? `${bereich} · ${unterpunkt}` : bereich;

  return (
    <div className="border border-primary-200/60 bg-primary-50/30 rounded-xl p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
          {title}
        </h3>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs px-2 py-1 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
            title="Panel ausblenden"
          >
            Löschen
          </button>
        )}
      </div>
      <div className="space-y-2">
        <button
          onClick={() => onAdd()}
          className="btn-primary w-full text-sm py-2"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          + Position hinzufügen
        </button>
        {templates.length > 0 && (
          <>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pt-1 pb-0.5">Oder aus Vorlage</p>
            {templates.map(t => (
              <button
                key={t._id}
                onClick={() => onAdd(t)}
                className="w-full flex items-center justify-between text-sm py-2.5 px-3.5 rounded-lg bg-white border border-slate-200 hover:border-primary-300 hover:bg-primary-50/50 transition-all duration-150 text-left shadow-sm hover:shadow-md"
              >
                <span className="font-medium text-slate-800">{t.name}</span>
                <span className="text-xs text-slate-400 shrink-0 ml-2 font-mono">
                  {t.unit}
                  {t.materialCostPerUnit > 0 && ` · ${t.materialCostPerUnit} €`}
                  {t.laborHoursPerUnit > 0 && ` · ${t.laborHoursPerUnit} h`}
                </span>
              </button>
            ))}
          </>
        )}

        {filteredPositions.length > 0 && (
          <>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pt-2 pb-0.5">
              Angelegte Positionen ({filteredPositions.length})
            </p>
            <div className="space-y-1">
              {filteredPositions.map(p => (
                <div key={p._id} className="group flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-slate-800 truncate block">{p.name}</span>
                    <span className="text-xs text-slate-400">
                      {p.quantity} {p.unit}
                      {p.totalCost > 0 && ` · ${p.totalCost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`}
                    </span>
                  </div>
                  <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(p)}
                      className="text-xs px-2 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600"
                    >✏</button>
                    <button
                      onClick={() => { if (confirm(`Position "${p.name}" löschen?`)) deleteMutation.mutate(p._id); }}
                      className="text-xs px-2 py-1 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-600"
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface PauschaleFormState {
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  description: string;
}

function emptyPauschaleForm(): PauschaleFormState {
  return { name: '', quantity: 1, unit: 'Psch', pricePerUnit: 0, description: '' };
}

function PauschaleInlineForm({
  initial,
  title,
  onSave,
  onCancel,
  saveLabel = 'Speichern',
}: {
  initial: PauschaleFormState;
  title: string;
  onSave: (f: PauschaleFormState) => void;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const [f, setF] = useState<PauschaleFormState>(initial);
  const set = (k: keyof PauschaleFormState, v: string | number) => setF(prev => ({ ...prev, [k]: v }));
  const preview = +(f.quantity * f.pricePerUnit).toFixed(2);

  return (
    <div className="border border-primary-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
      <p className="text-sm font-semibold text-primary-700">{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="label">Bezeichnung *</label>
          <input value={f.name} onChange={e => set('name', e.target.value)} className="input" placeholder="z.B. Pauschale Entkernung" />
        </div>
        <div>
          <label className="label">Einheit</label>
          <select value={f.unit} onChange={e => set('unit', e.target.value)} className="input">
            {['m²', 'm³', 'lfm', 'Stück', 'Sack', 'kg', 'Psch', 't'].map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Menge</label>
          <input type="number" min="0" step="0.01" value={f.quantity} onChange={e => set('quantity', +e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Kosten pro Einheit (€)</label>
          <input type="number" min="0" step="0.01" value={f.pricePerUnit} onChange={e => set('pricePerUnit', +e.target.value)} className="input" />
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
          <textarea value={f.description} onChange={e => set('description', e.target.value)} className="input resize-none" rows={2} placeholder="Optionale Beschreibung..." />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onSave(f)} disabled={!f.name} className="btn-primary text-sm">{saveLabel}</button>
        <button onClick={onCancel} className="btn-secondary text-sm">Abbrechen</button>
      </div>
    </div>
  );
}

function PauschalePanel({
  projectId, phase, onDismiss,
}: {
  projectId: string;
  phase: string;
  onDismiss?: () => void;
}) {
  const qc = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editPos, setEditPos] = useState<Position | null>(null);

  const { data: bereichPositions = [] } = useQuery(
    ['positions', 'bereich', projectId, phase, 'XI. Pauschale Kosten'],
    () => getPositions(projectId, { phaseType: phase, bereich: 'XI. Pauschale Kosten', noRoom: 'true' })
  );
  const positionsList = bereichPositions as Position[];

  const inv = () => qc.invalidateQueries(['positions', 'bereich', projectId]);

  const createMut = useMutation(
    (f: PauschaleFormState) => createPosition(projectId, {
      phaseType: phase as PhaseType,
      bereich: 'XI. Pauschale Kosten',
      name: f.name,
      unit: f.unit as any,
      quantity: f.quantity,
      materialCostPerUnit: f.pricePerUnit,
      disposalCostPerUnit: 0,
      laborHoursPerUnit: 0,
      laborHourlyRate: 0,
      description: f.description || undefined,
      category: 'Pauschale',
    } as any),
    { onSuccess: () => { inv(); setShowAddForm(false); } }
  );

  const updateMut = useMutation(
    ({ id, f }: { id: string; f: PauschaleFormState }) => updatePosition(projectId, id, {
      name: f.name, unit: f.unit as any, quantity: f.quantity,
      materialCostPerUnit: f.pricePerUnit, description: f.description || undefined,
    }),
    { onSuccess: () => { inv(); setEditPos(null); } }
  );

  const deleteMut = useMutation(
    (id: string) => deletePosition(projectId, id),
    { onSuccess: inv }
  );

  return (
    <div className="border border-primary-200/60 bg-primary-50/30 rounded-xl p-4 mb-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
          XI. Pauschale Kosten
        </h3>
        {onDismiss && (
          <button onClick={onDismiss} className="text-xs px-2 py-1 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-colors">Löschen</button>
        )}
      </div>

      <div className="space-y-3">
        {!showAddForm && !editPos && (
          <button onClick={() => setShowAddForm(true)} className="btn-primary w-full text-sm py-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            + Position hinzufügen
          </button>
        )}

        {showAddForm && !editPos && (
          <PauschaleInlineForm
            title="Neue Pauschalposition"
            initial={emptyPauschaleForm()}
            onSave={(f) => createMut.mutate(f)}
            onCancel={() => setShowAddForm(false)}
            saveLabel="Position anlegen"
          />
        )}

        {positionsList.length > 0 && (
          <>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pt-1 pb-0.5">
              Angelegte Positionen ({positionsList.length})
            </p>
            {positionsList.map(p => (
              <div key={p._id}>
                {editPos?._id === p._id ? (
                  <PauschaleInlineForm
                    title={`Bearbeiten: ${p.name}`}
                    initial={{ name: p.name, unit: p.unit, quantity: p.quantity, pricePerUnit: p.materialCostPerUnit, description: p.description || '' }}
                    onSave={(f) => updateMut.mutate({ id: p._id, f })}
                    onCancel={() => setEditPos(null)}
                    saveLabel="Änderungen speichern"
                  />
                ) : (
                  <div className="group flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-800 truncate block">{p.name}</span>
                      <span className="text-xs text-slate-400">
                        {p.quantity} {p.unit}
                        {p.totalCost > 0 && ` · ${p.totalCost.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`}
                        {p.description && ` · ${p.description}`}
                      </span>
                    </div>
                    <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditPos(p); setShowAddForm(false); }} className="text-xs px-2 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600">✏</button>
                      <button onClick={() => { if (confirm(`Position "${p.name}" löschen?`)) deleteMut.mutate(p._id); }} className="text-xs px-2 py-1 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-600">✕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function AddFloorModal({ projectId, phaseType, onClose }: { projectId: string; phaseType: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [level, setLevel] = useState(0);
  const mutation = useMutation(
    () => createFloor(projectId, {
      name: name || LEVEL_NAMES[level] || `Etage ${level}`,
      level, order: level,
      phaseType: phaseType === 'specialConstruction' ? 'specialConstruction' : undefined,
    }),
    { onSuccess: () => { qc.invalidateQueries(['floors', projectId]); onClose(); } }
  );
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-semibold text-lg mb-4">Neue Etage anlegen</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Ebene (Nummer)</label>
            <select value={level} onChange={(e) => { const v = +e.target.value; setLevel(v); setName(LEVEL_NAMES[v] || ''); }} className="input">
              {[-3,-2,-1,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(l => <option key={l} value={l}>{LEVEL_NAMES[l] || `Etage ${l}`}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Bezeichnung</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder={LEVEL_NAMES[level] || 'z.B. Erdgeschoss'} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => mutation.mutate()} disabled={mutation.isLoading} className="btn-primary">Anlegen</button>
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

/** Berechnet die nächste logische Wohnungsnummer aus vorhandenen Nummern.
 *  Erkennt Muster wie "WE01","WE02" → "WE03" oder "01","02" → "03".
 *  Gibt leeren String zurück wenn kein Muster erkennbar. */
function suggestNextUnitNumber(existingNumbers: string[]): string {
  const nums = existingNumbers.filter(Boolean);
  if (nums.length === 0) return '';
  // Extrahiere numerischen Suffix und Präfix aus allen vorhandenen Nummern
  // z.B. "WE01" → prefix="WE", num=1, pad=2
  const parsed = nums.map(n => {
    const m = n.match(/^([A-Za-z\-_]*)(\d+)([A-Za-z\-_]*)$/);
    if (!m) return null;
    return { prefix: m[1], num: parseInt(m[2], 10), pad: m[2].length, suffix: m[3] };
  }).filter(Boolean) as { prefix: string; num: number; pad: number; suffix: string }[];
  if (parsed.length === 0) return '';
  // Prüfe ob alle das gleiche Muster haben
  const first = parsed[0];
  const allSame = parsed.every(p => p.prefix === first.prefix && p.suffix === first.suffix);
  if (!allSame) return '';
  const maxNum = Math.max(...parsed.map(p => p.num));
  const nextNum = maxNum + 1;
  const padded = String(nextNum).padStart(first.pad, '0');
  return `${first.prefix}${padded}${first.suffix}`;
}

function AddUnitModal({ projectId, floorId, floors, existingUnits, onClose }: {
  projectId: string; floorId: string; floors: Floor[]; existingUnits: Unit[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const floor = floors.find(f => f._id === floorId);
  const suggested = suggestNextUnitNumber(existingUnits.map(u => u.number || ''));
  const [number, setNumber] = useState(suggested);
  const [name, setName] = useState('');
  const mutation = useMutation(
    () => createUnit(projectId, { floorId, name: name || `Wohnung ${number}`, number: number || undefined }),
    { onSuccess: () => { qc.invalidateQueries(['units', projectId]); onClose(); } }
  );
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-baseline gap-3 mb-4">
          <h3 className="font-semibold text-lg">Neue Wohnung anlegen</h3>
          {floor && <span className="text-sm text-gray-400">{floor.name}</span>}
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Wohnungsnummer</label>
            <input value={number} onChange={(e) => setNumber(e.target.value)} className="input" placeholder="z.B. WE01, 1A, EG-links" autoFocus />
            {suggested && number === suggested && (
              <p className="text-xs text-gray-400 mt-1">Vorschlag basierend auf vorhandenen Wohnungen</p>
            )}
          </div>
          <div>
            <label className="label">Bezeichnung</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder={number ? `Wohnung ${number}` : 'z.B. Wohnung 01'} />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => mutation.mutate()} disabled={mutation.isLoading || (!name && !number)} className="btn-primary">Anlegen</button>
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

function EditUnitModal({ projectId, unit, floors, onClose }: { projectId: string; unit: Unit; floors: Floor[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(unit.name || '');
  const [number, setNumber] = useState(unit.number || '');
  const floor = floors.find(f => f._id === (unit.floorId as any));
  const mutation = useMutation(
    () => updateUnit(projectId, unit._id, { name: name || undefined, number: number || undefined }),
    { onSuccess: () => { qc.invalidateQueries(['units', projectId]); onClose(); } }
  );
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-baseline gap-3 mb-4">
          <h3 className="font-semibold text-lg">Wohnung bearbeiten</h3>
          {floor && <span className="text-sm text-gray-400">{floor.name}</span>}
        </div>
        <div className="space-y-4">
          <div>
            <label className="label">Wohnungsnummer</label>
            <input value={number} onChange={(e) => setNumber(e.target.value)} className="input" placeholder="z.B. WE01, 1A, EG-links" />
          </div>
          <div>
            <label className="label">Bezeichnung</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="z.B. EG links" />
          </div>
        </div>
        {mutation.isError && (
          <p className="text-red-600 text-sm mt-3">{(mutation.error as any)?.response?.data?.message || 'Fehler beim Speichern'}</p>
        )}
        <div className="flex gap-3 mt-6">
          <button onClick={() => mutation.mutate()} disabled={mutation.isLoading || (!name && !number)} className="btn-primary">Speichern</button>
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

function AddRoomModal({ projectId, floorId, unitId, onClose }: {
  projectId: string; floorId: string; unitId?: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', type: 'other', length: '', width: '', height: '' });
  const mutation = useMutation(() => createRoom(projectId, {
    floorId,
    unitId: unitId || undefined,
    name: form.name, type: form.type as any,
    dimensions: {
      length: form.length ? +form.length : undefined,
      width:  form.width  ? +form.width  : undefined,
      height: form.height ? +form.height : undefined,
      area: form.length && form.width ? +(+form.length * +form.width).toFixed(2) : undefined,
    },
  }), { onSuccess: () => { qc.invalidateQueries(['rooms', projectId]); onClose(); } });

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-semibold text-lg mb-4">{unitId ? 'Raum zur Wohnung hinzufügen' : 'Neuen Raum anlegen'}</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Bezeichnung *</label>
            <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} className="input" placeholder="z.B. Wohnzimmer" />
          </div>
          <div>
            <label className="label">Raumtyp</label>
            <select value={form.type} onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))} className="input">
              {Object.entries(ROOM_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="label">Länge (m)</label><input value={form.length} onChange={(e) => setForm(f => ({ ...f, length: e.target.value }))} type="number" step="0.01" className="input" /></div>
            <div><label className="label">Breite (m)</label><input value={form.width} onChange={(e) => setForm(f => ({ ...f, width: e.target.value }))} type="number" step="0.01" className="input" /></div>
            <div><label className="label">Höhe (m)</label><input value={form.height} onChange={(e) => setForm(f => ({ ...f, height: e.target.value }))} type="number" step="0.01" className="input" /></div>
          </div>
          {form.length && form.width && (
            <p className="text-sm text-primary-600 font-medium">
              Fläche: {(+form.length * +form.width).toFixed(2)} m²
              {form.height ? ` · Volumen: ${(+form.length * +form.width * +form.height).toFixed(2)} m³` : ''}
            </p>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => mutation.mutate()} disabled={mutation.isLoading || !form.name} className="btn-primary">Anlegen</button>
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

interface RoomCardProps {
  room: Room;
  isDragging: boolean;
  projectId: string;
  selectedPhase: string;
  selectedBereich: string;
  selectedUnterpunkt: string;
  onDragStart: (e: React.DragEvent, roomId: string) => void;
  onDragEnd: () => void;
  onDelete: (roomId: string) => void;
}

function RoomCard({ room, isDragging, projectId, selectedPhase, selectedBereich, selectedUnterpunkt, onDragStart, onDragEnd, onDelete }: RoomCardProps) {
  return (
    <div
      className={`group relative border rounded-lg p-3 transition-colors cursor-grab active:cursor-grabbing ${
        isDragging
          ? 'border-primary-400 bg-primary-50 opacity-60 ring-2 ring-primary-300'
          : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50'
      }`}
      draggable
      onDragStart={e => onDragStart(e, room._id)}
      onDragEnd={onDragEnd}
      title="Ziehen zum Kopieren in andere Wohnung"
    >
      <Link
        to={`/projects/${projectId}/rooms/${room._id}?phase=${selectedPhase}${selectedBereich ? `&bereich=${encodeURIComponent(selectedBereich)}` : ''}${selectedUnterpunkt ? `&unterpunkt=${encodeURIComponent(selectedUnterpunkt)}` : ''}`}
        className="block"
        draggable={false}
      >
        <p className="font-medium text-sm text-gray-900">{room.name}</p>
        <p className="text-xs text-gray-500">{ROOM_TYPE_LABELS[room.type] || room.type}</p>
        {room.dimensions?.area && <p className="text-xs text-primary-600 mt-1">{room.dimensions.area} m²</p>}
        {room.properties?.includes('asbestos') && (
          <span className="inline-block mt-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Asbest</span>
        )}
      </Link>
      <button
        onClick={() => { if (confirm(`Raum "${room.name}" wirklich löschen?`)) onDelete(room._id); }}
        className="absolute top-2 right-2 hidden group-hover:flex items-center justify-center w-6 h-6 rounded bg-red-100 text-red-600 hover:bg-red-200 text-xs"
        title="Raum löschen"
      >✕</button>
    </div>
  );
}

export default function BuildingPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPhase = searchParams.get('phase') || 'demolition';
  const selectedBereich = searchParams.get('bereich') || '';
  const selectedUnterpunkt = searchParams.get('unterpunkt') || '';
  const setBereich = (b: string, unterpunkt?: string) => {
    const next = new URLSearchParams(searchParams);
    if (b) next.set('bereich', b); else next.delete('bereich');
    if (unterpunkt) next.set('unterpunkt', unterpunkt); else next.delete('unterpunkt');
    setSearchParams(next);
  };

  const [showAddFloor, setShowAddFloor] = useState(false);
  const [addRoomTarget, setAddRoomTarget] = useState<{ floorId: string; unitId?: string } | null>(null);
  const [addUnitFloor, setAddUnitFloor] = useState<string | null>(null);
  const [showBereichForm, setShowBereichForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PositionTemplate | null>(null);
  const [editBereichPosition, setEditBereichPosition] = useState<Position | null>(null);
  const [formBereich, setFormBereich] = useState('');
  const [dismissedPinned, setDismissedPinned] = useState<Set<string>>(new Set());
  const [showBereichPicker, setShowBereichPicker] = useState(false);

  // ── Wohnung kopieren ──────────────────────────────────────────
  const [copyUnitTarget, setCopyUnitTarget] = useState<Unit | null>(null);
  const [editUnitTarget, setEditUnitTarget] = useState<Unit | null>(null);

  // ── Raum-DnD (native HTML5) ───────────────────────────────────
  const [draggedRoomId, setDraggedRoomId]       = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey]       = useState<string | null>(null);

  const qc = useQueryClient();
  const { data: project } = useQuery(['project', projectId], () => getProject(projectId!));
  const { data: floors = [] } = useQuery(['floors', projectId], () => getFloors(projectId!));
  const { data: rooms = [] } = useQuery(['rooms', projectId], () => getRooms(projectId!));
  const { data: units = [] } = useQuery(['units', projectId], () => getUnits(projectId!));

  const deleteRoomMutation = useMutation(
    (roomId: string) => deleteRoom(projectId!, roomId),
    { onSuccess: () => qc.invalidateQueries(['rooms', projectId]) }
  );
  const deleteFloorMutation = useMutation(
    (floorId: string) => deleteFloor(projectId!, floorId),
    { onSuccess: () => {
      qc.invalidateQueries(['floors', projectId]);
      qc.invalidateQueries(['rooms', projectId]);
      qc.invalidateQueries(['units', projectId]);
    }}
  );
  const deleteUnitMutation = useMutation(
    (unitId: string) => deleteUnit(projectId!, unitId),
    { onSuccess: () => {
      qc.invalidateQueries(['units', projectId]);
      qc.invalidateQueries(['rooms', projectId]);
    }}
  );

  // Raum per DnD in Ziel-Wohnung/-Etage kopieren
  const copyRoomMutation = useMutation(
    ({ roomId, targetUnitId, targetFloorId }: { roomId: string; targetUnitId: string | null; targetFloorId: string }) =>
      copyRoom(projectId!, roomId, { targetUnitId, targetFloorId }),
    { onSuccess: () => qc.invalidateQueries(['rooms', projectId]) }
  );

  const { data: templates = [] } = useQuery(
    ['templates', selectedPhase],
    () => getTemplates(selectedPhase || undefined)
  );

  const { data: allPhasePositions = [] } = useQuery(
    ['positions', 'all', projectId, selectedPhase],
    () => getPositions(projectId!, { phaseType: selectedPhase }),
    { enabled: !!projectId }
  );

  const { data: containerItems = [] } = useQuery(
    ['containers', projectId],
    () => getContainers(projectId!),
    { enabled: !!projectId }
  );
  const { data: geruestItems = [] } = useQuery(
    ['gerueste', projectId],
    () => getGerueste(projectId!),
    { enabled: !!projectId }
  );
  const { data: kranItems = [] } = useQuery(
    ['kraene', projectId],
    () => getKraene(projectId!),
    { enabled: !!projectId }
  );

  const bereichCount = useMemo(() => {
    const map: Record<string, number> = {};
    (allPhasePositions as Position[]).forEach(p => {
      if (p.bereich && !p.roomId) map[p.bereich] = (map[p.bereich] || 0) + 1;
    });
    if (selectedPhase === 'specialConstruction') {
      const cCount = (containerItems as Container[]).length;
      const gCount = (geruestItems as Geruest[]).length;
      const kCount = (kranItems as Kran[]).length;
      if (cCount > 0) map['Container & Entsorgung'] = cCount;
      if (gCount > 0) map['Gerüst'] = gCount;
      if (kCount > 0) map['Kran'] = kCount;
    }
    return map;
  }, [allPhasePositions, containerItems, geruestItems, kranItems, selectedPhase]);

  const allBereicheForPhase = useMemo(
    () => getBereicheForPhase(selectedPhase, floors),
    [selectedPhase, floors]
  );

  const usedBereiche = useMemo(() => {
    const extra = Object.keys(bereichCount).filter(b => !allBereicheForPhase.includes(b));
    if (selectedPhase === 'specialConstruction') {
      return [...allBereicheForPhase, ...extra];
    }
    // Entkernung / Renovierung: nur Bereiche mit Positionen anzeigen
    const withPositions = allBereicheForPhase.filter(b => bereichCount[b] > 0);
    const extraWithPositions = extra.filter(b => bereichCount[b] > 0);
    // Fallback: alle anzeigen wenn noch gar keine Positionen angelegt wurden
    if (withPositions.length === 0 && extraWithPositions.length === 0) {
      return [...allBereicheForPhase];
    }
    return [...withPositions, ...extraWithPositions];
  }, [selectedPhase, allBereicheForPhase, bereichCount]);

  const bereiche = usedBereiche;

  // Bereiche die angeheftet werden, sobald Positionen vorhanden sind (neueste zuerst)
  const pinnedBereiche = useMemo(() => {
    if (selectedPhase === 'specialConstruction') return [];
    const positions = allPhasePositions as Position[];
    const bereichLastId: Record<string, string> = {};
    positions.forEach(p => {
      if (!p.roomId && p.bereich && PINNABLE_BEREICHE.includes(p.bereich)) {
        const current = bereichLastId[p.bereich];
        if (!current || p._id > current) bereichLastId[p.bereich] = p._id;
      }
    });
    return PINNABLE_BEREICHE
      .filter(b => bereichLastId[b])
      .sort((a, b) => bereichLastId[b].localeCompare(bereichLastId[a]));
  }, [allPhasePositions, selectedPhase]);

  const sortedFloors = [...floors]
    .filter(f => selectedPhase === 'specialConstruction'
      ? f.phaseType === 'specialConstruction'
      : f.phaseType !== 'specialConstruction')
    .sort((a, b) => a.level - b.level);

  const allRoomsForPhase = useMemo(() => {
    const floorIds = new Set(sortedFloors.map(f => f._id));
    return rooms.filter(r => {
      const fid = typeof r.floorId === 'string' ? r.floorId : (r.floorId as Floor)._id;
      return floorIds.has(fid);
    });
  }, [sortedFloors, rooms]);

  const directRoomsByFloor = (floorId: string) => rooms.filter((r) => {
    const fid = typeof r.floorId === 'string' ? r.floorId : (r.floorId as Floor)._id;
    return fid === floorId && !r.unitId;
  });

  const unitsByFloor = (floorId: string) => units.filter((u) => {
    const fid = typeof u.floorId === 'string' ? u.floorId : (u.floorId as Floor)._id;
    return fid === floorId;
  });

  const roomsByUnit = (unitId: string) => rooms.filter((r) => {
    if (!r.unitId) return false;
    const uid = typeof r.unitId === 'string' ? r.unitId : (r.unitId as Unit)._id;
    return uid === unitId;
  });

  const unitTotalArea = (unitId: string): number => {
    const total = roomsByUnit(unitId).reduce((sum, r) => sum + (r.dimensions?.area || 0), 0);
    return +total.toFixed(2);
  };

  // ── DnD-Hilfsfunktionen ───────────────────────────────────────
  // WICHTIG: setDraggedRoomId via setTimeout(0) verzögert, damit der Browser
  // das Drag-Element vollständig einfriert, bevor React das DOM mutiert.
  // Eine synchrone setState-Änderung in onDragStart kann die className des
  // gezogenen Elements sofort updaten und so den Drag abbrechen.
  function handleRoomDragStart(e: React.DragEvent, roomId: string) {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', roomId);
    setTimeout(() => setDraggedRoomId(roomId), 0);
  }

  function handleRoomDragEnd() {
    setDraggedRoomId(null);
    setDropTargetKey(null);
  }

  function onDragEnter(e: React.DragEvent, key: string) {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetKey(key);
  }

  function onDragLeave(e: React.DragEvent, key: string) {
    // Nur zurücksetzen wenn der Cursor den Container wirklich verlässt (nicht nur ein Kind-Element)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTargetKey(prev => (prev === key ? null : prev));
    }
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function dropOnUnit(e: React.DragEvent, targetUnitId: string, targetFloorId: string) {
    e.preventDefault();
    e.stopPropagation();
    const roomId = e.dataTransfer.getData('text/plain') || draggedRoomId;
    if (!roomId) return;
    const srcRoom = (rooms as Room[]).find(r => r._id === roomId);
    const srcUnitId = srcRoom?.unitId
      ? (typeof srcRoom.unitId === 'string' ? srcRoom.unitId : (srcRoom.unitId as Unit)._id)
      : null;
    if (srcUnitId === targetUnitId) { setDraggedRoomId(null); setDropTargetKey(null); return; }
    copyRoomMutation.mutate({ roomId, targetUnitId, targetFloorId });
    setDraggedRoomId(null); setDropTargetKey(null);
  }

  function dropOnFloor(e: React.DragEvent, targetFloorId: string) {
    e.preventDefault();
    e.stopPropagation();
    const roomId = e.dataTransfer.getData('text/plain') || draggedRoomId;
    if (!roomId) return;
    copyRoomMutation.mutate({ roomId, targetUnitId: null, targetFloorId });
    setDraggedRoomId(null); setDropTargetKey(null);
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 sm:mb-6">
        <Link to={`/projects/${projectId}`} className="text-gray-400 hover:text-gray-600 text-sm">← Projekt</Link>
        <h1 className="text-xl font-bold text-gray-900">{project?.name} – Gebäudestruktur</h1>
      </div>

      {/* Aktive Phase als Badge */}
      <div className="mb-4">
        <span className="inline-block px-3 py-1 rounded-full text-sm font-semibold border-2 border-primary-600 text-primary-600 bg-primary-50">
          {{
            demolition: 'Entkernung',
            renovation: 'Renovierung',
            specialConstruction: 'Sonderarbeiten',
          }[selectedPhase] ?? selectedPhase}
        </span>
      </div>

      {/* Bereich-Filter */}
      <div className="flex items-center gap-2 py-3 mb-3 flex-wrap">
        <span className="text-xs text-gray-500 font-medium shrink-0">Bereich:</span>
        <button
          onClick={() => setBereich('')}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            !selectedBereich
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
          }`}
        >
          Alle
        </button>
        {bereiche.map((b) => {
          const isActive = selectedBereich === b;
          const count = bereichCount[b] || 0;
          return (
            <button key={b}
              onClick={() => setBereich(isActive ? '' : b)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors flex items-center gap-1.5 ${
                isActive
                  ? 'bg-primary-600 text-white border-primary-600'
                  : count > 0
                  ? 'bg-primary-50 text-primary-700 border-primary-300 hover:border-primary-500'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
              }`}
            >
              {b}
              {count > 0 && !isActive && (
                <span className="text-[10px] font-semibold bg-primary-500 text-white rounded-full px-1.5 py-0 leading-4 min-w-[18px] text-center">
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {/* ＋ Bereich öffnen – auch ohne Positionen */}
        {selectedPhase !== 'specialConstruction' && (
          <div className="relative">
            <button
              onClick={() => setShowBereichPicker(p => !p)}
              className="text-xs px-3 py-1 rounded-full border border-dashed border-gray-400 text-gray-500 hover:border-primary-500 hover:text-primary-600 transition-colors"
            >＋ Bereich</button>
            {showBereichPicker && (
              <div className="absolute left-0 top-7 z-30 bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[220px]">
                {allBereicheForPhase.map(b => (
                  <button key={b} onClick={() => { setBereich(b); setShowBereichPicker(false); }}
                    className="block w-full text-left text-sm px-3 py-1.5 rounded-lg hover:bg-primary-50 hover:text-primary-700 transition-colors">
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bereich-Vorlagen-Panel */}
      {!selectedBereich && selectedPhase === 'specialConstruction' && (
        <div className="space-y-0 mb-2">
          <ContainerPanel projectId={projectId!} />
          <GeruestPanel projectId={projectId!} />
          <KranPanel projectId={projectId!} />
        </div>
      )}
      {selectedBereich && (
        SPECIAL_BEREICHE.includes(selectedBereich)
          ? selectedBereich === 'Container & Entsorgung'
            ? <ContainerPanel projectId={projectId!} />
            : selectedBereich === 'Gerüst'
            ? <GeruestPanel projectId={projectId!} />
            : <KranPanel projectId={projectId!} />
          : selectedBereich === 'XI. Pauschale Kosten' && selectedPhase !== 'specialConstruction'
          ? <PauschalePanel projectId={projectId!} phase={selectedPhase} />
          : !pinnedBereiche.includes(selectedBereich)
          ? <BereichPositionsPanel
              projectId={projectId!}
              phase={selectedPhase}
              bereich={selectedBereich}
              unterpunkt={selectedUnterpunkt || undefined}
              onAdd={(template) => {
                setEditBereichPosition(null);
                setSelectedTemplate(template || null);
                setFormBereich(selectedBereich);
                setShowBereichForm(true);
              }}
              onEdit={(pos) => {
                setEditBereichPosition(pos);
                setSelectedTemplate(null);
                setFormBereich(selectedBereich);
                setShowBereichForm(true);
              }}
            />
          : null
      )}

      {/* Angeheftete Bereiche – immer sichtbar sobald Positionen vorhanden */}
      {pinnedBereiche.filter(b => !dismissedPinned.has(b)).length > 0 && (
        <div className="space-y-0 mb-2">
          {pinnedBereiche.filter(b => !dismissedPinned.has(b)).map(b => (
            b === 'XI. Pauschale Kosten' && selectedPhase !== 'specialConstruction'
              ? <PauschalePanel key={b} projectId={projectId!} phase={selectedPhase} onDismiss={() => setDismissedPinned(prev => new Set([...prev, b]))} />
              : <BereichPositionsPanel
                  key={b}
                  projectId={projectId!}
                  phase={selectedPhase}
                  bereich={b}
                  onAdd={(template) => {
                    setEditBereichPosition(null);
                    setSelectedTemplate(template || null);
                    setFormBereich(b);
                    setShowBereichForm(true);
                  }}
                  onEdit={(pos) => {
                    setEditBereichPosition(pos);
                    setSelectedTemplate(null);
                    setFormBereich(b);
                    setShowBereichForm(true);
                  }}
                  onDismiss={() => setDismissedPinned(prev => new Set([...prev, b]))}
                />
          ))}
        </div>
      )}

      {/* Etagen */}
      <div className="space-y-4">
        {sortedFloors.length === 0 && (
          <div className="card text-center py-12 text-gray-400">
            <p className="mb-4">Noch keine Etagen angelegt</p>
            <button onClick={() => setShowAddFloor(true)} className="btn-primary">Erste Etage anlegen</button>
          </div>
        )}

        {sortedFloors.map((floor) => {
          const directRooms = directRoomsByFloor(floor._id);
          const floorUnits = unitsByFloor(floor._id);
          const unitRoomCount = floorUnits.reduce((sum, u) => sum + roomsByUnit(u._id).length, 0);

          return (
            <div key={floor._id} className="card">
              {/* Etagen-Header */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{floor.name}</h3>
                  <p className="text-xs text-gray-400">
                    {floorUnits.length > 0 && `${floorUnits.length} Wohnung${floorUnits.length !== 1 ? 'en' : ''} · `}
                    {directRooms.length + unitRoomCount} Räume
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  <button onClick={() => setAddRoomTarget({ floorId: floor._id })} className="btn-secondary btn-sm">+ Raum</button>
                  <button onClick={() => setAddUnitFloor(floor._id)} className="btn-secondary btn-sm">+ Wohnung</button>
                  <button
                    onClick={() => { if (confirm(`Etage "${floor.name}" und alle Räume/Wohnungen wirklich löschen?`)) deleteFloorMutation.mutate(floor._id); }}
                    className="btn-sm border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-3"
                    title="Etage löschen">Löschen</button>
                </div>
              </div>

              {/* Drop-Zone für direkte Etagenablage – sichtbar bei jedem Drag */}
              {draggedRoomId && (() => {
                const key = `floor:${floor._id}`;
                const active = dropTargetKey === key;
                return (
                  <div
                    className={`mb-3 rounded-lg border-2 border-dashed text-center py-2 px-3 text-xs font-medium transition-all cursor-copy ${
                      active
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-slate-300 text-slate-400'
                    }`}
                    onDragEnter={e => onDragEnter(e, key)}
                    onDragLeave={e => onDragLeave(e, key)}
                    onDragOver={onDragOver}
                    onDrop={e => dropOnFloor(e, floor._id)}
                  >
                    {active ? `↓ Raum in „${floor.name}" kopieren (ohne Wohnung)` : `Hier ablegen → in „${floor.name}" kopieren`}
                  </div>
                );
              })()}

              {/* Direkte Räume (ohne Wohnung) */}
              {directRooms.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                  {directRooms.map((room) => (
                    <RoomCard key={room._id} room={room}
                      isDragging={draggedRoomId === room._id}
                      projectId={projectId!} selectedPhase={selectedPhase}
                      selectedBereich={selectedBereich} selectedUnterpunkt={selectedUnterpunkt}
                      onDragStart={handleRoomDragStart} onDragEnd={handleRoomDragEnd}
                      onDelete={(id) => deleteRoomMutation.mutate(id)}
                    />
                  ))}
                </div>
              )}

              {directRooms.length === 0 && floorUnits.length === 0 && !draggedRoomId && (
                <p className="text-sm text-gray-400 py-2">Noch keine Räume – "+ Raum" oder "+ Wohnung" klicken</p>
              )}

              {/* Wohnungen */}
              {floorUnits.map((unit) => {
                const unitRooms = roomsByUnit(unit._id);
                const dropKey   = `unit:${unit._id}`;
                const isDropTarget = draggedRoomId !== null && dropTargetKey === dropKey;
                return (
                  <div
                    key={unit._id}
                    className={`mt-3 border rounded-lg p-3 transition-colors ${
                      isDropTarget
                        ? 'border-primary-400 bg-primary-50/60 ring-2 ring-primary-300'
                        : 'border-slate-200 bg-slate-50/40'
                    }`}
                    onDragEnter={e => onDragEnter(e, dropKey)}
                    onDragLeave={e => onDragLeave(e, dropKey)}
                    onDragOver={onDragOver}
                    onDrop={e => dropOnUnit(e, unit._id, floor._id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {unit.number && <span className="font-bold text-sm text-slate-800">{unit.number}</span>}
                        <span className="text-sm text-slate-600">{unit.name}</span>
                        <span className="text-xs text-gray-400">{unitRooms.length} Räume</span>
                        {unitTotalArea(unit._id) > 0 && (
                          <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                            {unitTotalArea(unit._id)} m² gesamt
                          </span>
                        )}
                        {isDropTarget && (
                          <span className="text-xs font-medium bg-primary-100 text-primary-700 border border-primary-300 px-2 py-0.5 rounded-full animate-pulse">
                            Zum Kopieren hier ablegen
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setAddRoomTarget({ floorId: floor._id, unitId: unit._id })} className="btn-secondary btn-sm text-xs">+ Raum</button>
                        <button
                          onClick={() => setEditUnitTarget(unit)}
                          className="text-xs border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg px-2 py-1"
                          title="Wohnung bearbeiten">✏ Bearbeiten</button>
                        {/* ── Wohnung kopieren ── */}
                        <button
                          onClick={() => setCopyUnitTarget(unit)}
                          className="text-xs border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg px-2 py-1"
                          title="Wohnung kopieren"
                        >⎘ Kopieren</button>
                        <button
                          onClick={() => { if (confirm(`Wohnung "${unit.name}" und alle Räume wirklich löschen?`)) deleteUnitMutation.mutate(unit._id); }}
                          className="text-xs border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-2 py-1"
                          title="Wohnung löschen">Löschen</button>
                      </div>
                    </div>
                    {unitRooms.length === 0 ? (
                      <p className="text-xs text-gray-400 py-1">
                        {isDropTarget ? 'Raum hier ablegen zum Kopieren' : 'Noch keine Räume – "+ Raum" klicken'}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {unitRooms.map((room) => (
                          <RoomCard key={room._id} room={room}
                            isDragging={draggedRoomId === room._id}
                            projectId={projectId!} selectedPhase={selectedPhase}
                            selectedBereich={selectedBereich} selectedUnterpunkt={selectedUnterpunkt}
                            onDragStart={handleRoomDragStart} onDragEnd={handleRoomDragEnd}
                            onDelete={(id) => deleteRoomMutation.mutate(id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        <button onClick={() => setShowAddFloor(true)} className="btn-secondary w-full">+ Etage hinzufügen</button>
      </div>

      {showAddFloor && <AddFloorModal projectId={projectId!} phaseType={selectedPhase} onClose={() => setShowAddFloor(false)} />}
      {addUnitFloor && <AddUnitModal projectId={projectId!} floorId={addUnitFloor} floors={sortedFloors} existingUnits={units as Unit[]} onClose={() => setAddUnitFloor(null)} />}
      {editUnitTarget && <EditUnitModal projectId={projectId!} unit={editUnitTarget} floors={sortedFloors} onClose={() => setEditUnitTarget(null)} />}
      {copyUnitTarget && (
        <CopyApartmentDialog
          projectId={projectId!}
          sourceUnit={copyUnitTarget}
          floors={sortedFloors}
          allUnits={units as Unit[]}
          onClose={() => setCopyUnitTarget(null)}
        />
      )}
      {addRoomTarget && (
        <AddRoomModal
          projectId={projectId!}
          floorId={addRoomTarget.floorId}
          unitId={addRoomTarget.unitId}
          onClose={() => setAddRoomTarget(null)}
        />
      )}

      {/* Position Form (direkt aus Bereich-Panel) */}
      {showBereichForm && (
        <PositionForm
          projectId={projectId!}
          rooms={allRoomsForPhase}
          phaseType={selectedPhase as PhaseType}
          templates={templates as PositionTemplate[]}
          editPosition={editBereichPosition}
          initialTemplate={selectedTemplate}
          defaultHourlyRate={45}
          defaultBereich={formBereich || undefined}
          projectFloors={floors}
          onClose={() => { setShowBereichForm(false); setSelectedTemplate(null); setEditBereichPosition(null); setFormBereich(''); }}
          onSuccess={() => {
            qc.invalidateQueries(['positions', 'bereich', projectId]);
            qc.invalidateQueries(['positions']);
            setShowBereichForm(false);
            setSelectedTemplate(null);
            setEditBereichPosition(null);
            setFormBereich('');
          }}
        />
      )}
    </div>
  );
}
