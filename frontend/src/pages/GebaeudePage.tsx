import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  getProject, getFloors, getRooms, createFloor, updateRoom, deleteRoom, deleteFloor,
  getUnits, createUnit, updateUnit, deleteUnit, createRoom, copyRoom,
  getStellplaetze, createStellplatz, updateStellplatz, deleteStellplatz, duplicateStellplatz,
} from '../api/projects';
import type { Floor, Unit, Room, Stellplatz } from '../types';
import CopyApartmentDialog from '../components/CopyApartmentDialog';

// ─── Hilfstabellen ────────────────────────────────────────────────────────────
const ROOM_TYPE_LABELS: Record<string, string> = {
  livingRoom: 'Wohnzimmer', bedroom: 'Schlafzimmer', bathroom: 'Bad/WC',
  kitchen: 'Küche', hallway: 'Flur', staircase: 'Treppenhaus',
  elevator: 'Aufzug', garage: 'Garage', basement: 'Keller',
  technicalRoom: 'Technikraum', balcony: 'Balkon', terrace: 'Terrasse',
  garden: 'Garten/Außenbereich', rooftop: 'Dach', other: 'Sonstiges',
  office: 'Arbeitszimmer', kidsRoom: 'Kinderzimmer', storageRoom: 'Abstellraum',
};
const ROOM_TYPES_RENOVATION = ['livingRoom', 'bedroom', 'bathroom', 'kitchen', 'hallway', 'office', 'kidsRoom', 'storageRoom', 'other'];

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

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
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
  const allSame = parsed.every(p => p.prefix === first.prefix && p.suffix === first.suffix);
  if (!allSame) return '';
  const maxNum = Math.max(...parsed.map(p => p.num));
  return `${first.prefix}${String(maxNum + 1).padStart(first.pad, '0')}${first.suffix}`;
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function AddFloorModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [level, setLevel] = useState(0);
  const mutation = useMutation(
    () => createFloor(projectId, { name: name || LEVEL_NAMES[level] || `Etage ${level}`, level, order: level }),
    { onSuccess: () => { qc.invalidateQueries(['floors', projectId]); onClose(); } }
  );
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-semibold text-lg mb-4">Neue Etage anlegen</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Ebene</label>
            <select value={level} onChange={e => { const v = +e.target.value; setLevel(v); setName(LEVEL_NAMES[v] || ''); }} className="input">
              {[-3,-2,-1,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(l => (
                <option key={l} value={l}>{LEVEL_NAMES[l] || `Etage ${l}`}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Bezeichnung</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder={LEVEL_NAMES[level] || 'z.B. Erdgeschoss'} />
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
            <input value={number} onChange={e => setNumber(e.target.value)} className="input" placeholder="z.B. WE01, 1A" autoFocus />
            {suggested && number === suggested && (
              <p className="text-xs text-gray-400 mt-1">Vorschlag basierend auf vorhandenen Wohnungen</p>
            )}
          </div>
          <div>
            <label className="label">Bezeichnung</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" placeholder={number ? `Wohnung ${number}` : 'z.B. Wohnung 01'} />
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
            <input value={number} onChange={e => setNumber(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Bezeichnung</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input" />
          </div>
        </div>
        {mutation.isError && <p className="text-red-600 text-sm mt-3">{(mutation.error as any)?.response?.data?.message || 'Fehler'}</p>}
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
  const [form, setForm] = useState({ name: '', type: ROOM_TYPES_RENOVATION[0], length: '', width: '', height: '' });
  const mutation = useMutation(() => createRoom(projectId, {
    floorId, unitId: unitId || undefined, name: form.name, type: form.type as any,
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
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" placeholder="z.B. Wohnzimmer" autoFocus />
          </div>
          <div>
            <label className="label">Raumtyp</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input">
              {ROOM_TYPES_RENOVATION.map(k => <option key={k} value={k}>{ROOM_TYPE_LABELS[k]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="label">Länge (m)</label><input value={form.length} onChange={e => setForm(f => ({ ...f, length: e.target.value }))} type="number" step="0.01" className="input" /></div>
            <div><label className="label">Breite (m)</label><input value={form.width} onChange={e => setForm(f => ({ ...f, width: e.target.value }))} type="number" step="0.01" className="input" /></div>
            <div><label className="label">Höhe (m)</label><input value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} type="number" step="0.01" className="input" /></div>
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

function EditRoomModal({ projectId, room, onClose }: { projectId: string; room: Room; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: room.name || '',
    type: room.type || ROOM_TYPES_RENOVATION[0],
    length: room.dimensions?.length ? String(room.dimensions.length) : '',
    width:  room.dimensions?.width  ? String(room.dimensions.width)  : '',
    height: room.dimensions?.height ? String(room.dimensions.height) : '',
  });
  const mutation = useMutation(() => updateRoom(projectId, room._id, {
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
        <h3 className="font-semibold text-lg mb-4">Raum bearbeiten</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Bezeichnung *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input" autoFocus />
          </div>
          <div>
            <label className="label">Raumtyp</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input">
              {ROOM_TYPES_RENOVATION.map(k => <option key={k} value={k}>{ROOM_TYPE_LABELS[k]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="label">Länge (m)</label><input value={form.length} onChange={e => setForm(f => ({ ...f, length: e.target.value }))} type="number" step="0.01" className="input" /></div>
            <div><label className="label">Breite (m)</label><input value={form.width} onChange={e => setForm(f => ({ ...f, width: e.target.value }))} type="number" step="0.01" className="input" /></div>
            <div><label className="label">Höhe (m)</label><input value={form.height} onChange={e => setForm(f => ({ ...f, height: e.target.value }))} type="number" step="0.01" className="input" /></div>
          </div>
          {form.length && form.width && (
            <p className="text-sm text-primary-600 font-medium">
              Fläche: {(+form.length * +form.width).toFixed(2)} m²
              {form.height ? ` · Volumen: ${(+form.length * +form.width * +form.height).toFixed(2)} m³` : ''}
            </p>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={() => mutation.mutate()} disabled={mutation.isLoading || !form.name} className="btn-primary">Speichern</button>
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

function StellplatzModal({ projectId, item, existingNummern, onClose }: {
  projectId: string; item: Stellplatz | null; existingNummern: string[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries(['stellplaetze', projectId]);
  const suggested = item ? '' : suggestNextUnitNumber(existingNummern);
  const [nummer, setNummer] = useState(item?.nummer || suggested);
  const [bezeichnung, setBezeichnung] = useState(item?.bezeichnung || '');
  const createMut = useMutation(
    () => createStellplatz(projectId, { nummer, bezeichnung }),
    { onSuccess: () => { inv(); onClose(); } }
  );
  const updateMut = useMutation(
    () => updateStellplatz(projectId, item!._id, { nummer, bezeichnung }),
    { onSuccess: () => { inv(); onClose(); } }
  );
  const isLoading = createMut.isLoading || updateMut.isLoading;
  const handleSave = () => item ? updateMut.mutate() : createMut.mutate();
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-semibold text-lg mb-4">{item ? 'Stellplatz bearbeiten' : 'Neuen Stellplatz anlegen'}</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Stellplatznummer</label>
            <input value={nummer} onChange={e => setNummer(e.target.value)} className="input" placeholder="z.B. SP-01, TG-12" autoFocus />
            {!item && suggested && nummer === suggested && (
              <p className="text-xs text-gray-400 mt-1">Vorschlag basierend auf vorhandenen Stellplätzen</p>
            )}
          </div>
          <div>
            <label className="label">Bezeichnung</label>
            <input value={bezeichnung} onChange={e => setBezeichnung(e.target.value)} className="input" placeholder="z.B. Tiefgaragenstellplatz links" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={handleSave} disabled={isLoading || (!nummer && !bezeichnung)} className="btn-primary">
            {item ? 'Speichern' : 'Anlegen'}
          </button>
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

// ─── Raum-Karte ───────────────────────────────────────────────────────────────
function RoomCard({ room, projectId, onEdit, onDelete, onCopy }: {
  room: Room; projectId: string;
  onEdit: (r: Room) => void;
  onDelete: (id: string) => void;
  onCopy: (r: Room) => void;
}) {
  return (
    <div className="group relative border border-gray-200 rounded-lg p-3 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors">
      <p className="font-medium text-sm text-gray-900 pr-6">{room.name}</p>
      <p className="text-xs text-gray-500">{ROOM_TYPE_LABELS[room.type] || room.type}</p>
      {room.dimensions?.area && (
        <p className="text-xs text-indigo-600 mt-1 font-medium">{room.dimensions.area} m²</p>
      )}
      {/* Aktions-Buttons */}
      <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
        <button
          onClick={() => onEdit(room)}
          className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs"
          title="Bearbeiten"
        >✏</button>
        <button
          onClick={() => onCopy(room)}
          className="w-6 h-6 flex items-center justify-center rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-xs"
          title="Kopieren"
        >⎘</button>
        <button
          onClick={() => { if (confirm(`Raum "${room.name}" wirklich löschen?`)) onDelete(room._id); }}
          className="w-6 h-6 flex items-center justify-center rounded bg-red-100 text-red-600 hover:bg-red-200 text-xs"
          title="Löschen"
        >✕</button>
      </div>
    </div>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────
export default function GebaeudePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [showAddFloor, setShowAddFloor]       = useState(false);
  const [addRoomTarget, setAddRoomTarget]      = useState<{ floorId: string; unitId?: string } | null>(null);
  const [addUnitFloor, setAddUnitFloor]        = useState<string | null>(null);
  const [editUnitTarget, setEditUnitTarget]    = useState<Unit | null>(null);
  const [copyUnitTarget, setCopyUnitTarget]    = useState<Unit | null>(null);
  const [editRoomTarget, setEditRoomTarget]    = useState<Room | null>(null);
  const [expandedUnits, setExpandedUnits]      = useState<Set<string>>(new Set());
  const [stellplatzModal, setStellplatzModal]  = useState<{ open: boolean; item: Stellplatz | null }>({ open: false, item: null });

  const toggleUnit = (id: string) => setExpandedUnits(prev => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });

  // ── Daten laden ────────────────────────────────────────────────
  const { data: project }    = useQuery(['project', projectId], () => getProject(projectId!));
  const { data: floors = [] } = useQuery(['floors', projectId], () => getFloors(projectId!));
  const { data: rooms = [] }  = useQuery(['rooms', projectId],  () => getRooms(projectId!));
  const { data: units = [] }  = useQuery(['units', projectId],  () => getUnits(projectId!));
  const { data: stellplaetze = [] } = useQuery(
    ['stellplaetze', projectId],
    () => getStellplaetze(projectId!),
    { enabled: !!projectId }
  );

  // ── Mutations ─────────────────────────────────────────────────
  const deleteRoomMut = useMutation(
    (roomId: string) => deleteRoom(projectId!, roomId),
    { onSuccess: () => qc.invalidateQueries(['rooms', projectId]) }
  );
  const deleteFloorMut = useMutation(
    (floorId: string) => deleteFloor(projectId!, floorId),
    { onSuccess: () => {
      qc.invalidateQueries(['floors', projectId]);
      qc.invalidateQueries(['rooms', projectId]);
      qc.invalidateQueries(['units', projectId]);
    }}
  );
  const deleteUnitMut = useMutation(
    (unitId: string) => deleteUnit(projectId!, unitId),
    { onSuccess: () => { qc.invalidateQueries(['units', projectId]); qc.invalidateQueries(['rooms', projectId]); } }
  );
  const copyRoomMut = useMutation(
    ({ roomId, targetUnitId, targetFloorId }: { roomId: string; targetUnitId: string | null; targetFloorId: string }) =>
      copyRoom(projectId!, roomId, { targetUnitId, targetFloorId }),
    { onSuccess: () => qc.invalidateQueries(['rooms', projectId]) }
  );
  const deleteStellplatzMut = useMutation(
    (id: string) => deleteStellplatz(projectId!, id),
    { onSuccess: () => qc.invalidateQueries(['stellplaetze', projectId]) }
  );
  const dupStellplatzMut = useMutation(
    (id: string) => duplicateStellplatz(projectId!, id),
    { onSuccess: () => qc.invalidateQueries(['stellplaetze', projectId]) }
  );

  // ── Hilfsfunktionen ───────────────────────────────────────────
  const sortedFloors = useMemo(() =>
    [...(floors as Floor[])].filter(f => f.level !== -1).sort((a, b) => a.level - b.level),
    [floors]
  );

  const directRoomsByFloor = (floorId: string) =>
    (rooms as Room[]).filter(r => {
      const fid = typeof r.floorId === 'string' ? r.floorId : (r.floorId as Floor)._id;
      return fid === floorId && !r.unitId;
    });

  const unitsByFloor = (floorId: string) =>
    (units as Unit[]).filter(u => {
      const fid = typeof u.floorId === 'string' ? u.floorId : (u.floorId as Floor)._id;
      return fid === floorId;
    });

  const roomsByUnit = (unitId: string) =>
    (rooms as Room[]).filter(r => {
      if (!r.unitId) return false;
      const uid = typeof r.unitId === 'string' ? r.unitId : (r.unitId as Unit)._id;
      return uid === unitId;
    });

  const unitTotalArea = (unitId: string): number =>
    +roomsByUnit(unitId).reduce((s, r) => s + (r.dimensions?.area || 0), 0).toFixed(2);

  const roomWallArea = (r: Room): number | null => {
    const d = r.dimensions;
    if (!d?.length || !d?.width || !d?.height) return null;
    return +(2 * (d.length + d.width) * d.height).toFixed(2);
  };

  const unitWallArea = (unitId: string): number | null => {
    const rs = roomsByUnit(unitId);
    let total = 0; let hasAny = false;
    for (const r of rs) { const w = roomWallArea(r as Room); if (w !== null) { total += w; hasAny = true; } }
    return hasAny ? +total.toFixed(2) : null;
  };

  const handleCopyRoom = (room: Room) => {
    const floorId = typeof room.floorId === 'string' ? room.floorId : (room.floorId as Floor)._id;
    const unitId  = room.unitId ? (typeof room.unitId === 'string' ? room.unitId : (room.unitId as Unit)._id) : null;
    copyRoomMut.mutate({ roomId: room._id, targetUnitId: unitId, targetFloorId: floorId });
  };

  // ── Summen ────────────────────────────────────────────────────
  const visibleFloorIds = useMemo(() => new Set(sortedFloors.map(f => f._id)), [sortedFloors]);
  const allVisibleUnits = useMemo(() =>
    (units as Unit[]).filter(u => {
      const fid = typeof u.floorId === 'string' ? u.floorId : (u.floorId as Floor)._id;
      return visibleFloorIds.has(fid);
    }), [units, visibleFloorIds]
  );
  const allVisibleRooms = useMemo(() =>
    allVisibleUnits.flatMap(u => roomsByUnit(u._id) as Room[]),
    [allVisibleUnits, rooms]
  );

  const totalBoden = +allVisibleRooms
    .filter(r => r.type !== 'garage')
    .reduce((s, r) => s + (r.dimensions?.area || 0), 0).toFixed(2);

  // ── Stellplätze sichtbar? ─────────────────────────────────────
  const totalStellplaetze = (project?.anzahlStellplaetze || 0) + (project?.tiefgarageStellplaetze || 0);
  const showStellplaetze  = totalStellplaetze > 0;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-6">
        <Link to={`/projects/${projectId}`} className="text-gray-400 hover:text-gray-600 text-sm">← Projekt</Link>
        <h1 className="text-xl font-bold text-gray-900">Anlage Wohnungen & Räume</h1>
      </div>

      {/* Summen-Badges */}
      {allVisibleUnits.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <span className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1 text-slate-700 shadow-sm">
            <span className="font-semibold">{allVisibleUnits.length}</span> Wohnungen
          </span>
          <span className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1 text-slate-700 shadow-sm">
            <span className="font-semibold">{allVisibleRooms.length}</span> Räume
          </span>
          {totalBoden > 0 && (
            <span className="text-xs bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 text-emerald-700 font-semibold shadow-sm">
              Boden: {totalBoden} m²
            </span>
          )}
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

        {sortedFloors.map(floor => {
          const directRooms = directRoomsByFloor(floor._id);
          const floorUnits  = unitsByFloor(floor._id);
          const unitRoomCount = floorUnits.reduce((s, u) => s + roomsByUnit(u._id).length, 0);

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
                  <button onClick={() => setAddUnitFloor(floor._id)} className="btn-secondary btn-sm">+ Wohnung</button>
                  <button
                    onClick={() => { if (confirm(`Etage "${floor.name}" und alle Räume/Wohnungen wirklich löschen?`)) deleteFloorMut.mutate(floor._id); }}
                    className="btn-sm border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-3"
                  >Löschen</button>
                </div>
              </div>

              {/* Direkte Räume (ohne Wohnung) */}
              {directRooms.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                  {directRooms.map(room => (
                    <RoomCard key={room._id} room={room} projectId={projectId!}
                      onEdit={setEditRoomTarget}
                      onDelete={id => deleteRoomMut.mutate(id)}
                      onCopy={handleCopyRoom}
                    />
                  ))}
                </div>
              )}

              {directRooms.length === 0 && floorUnits.length === 0 && (
                <p className="text-sm text-gray-400 py-2">Noch keine Wohnungen – "+ Wohnung" klicken</p>
              )}

              {/* Wohnungen */}
              {floorUnits.map(unit => {
                const unitRooms  = roomsByUnit(unit._id);
                const isExpanded = expandedUnits.has(unit._id);
                const area       = unitTotalArea(unit._id);
                const wallArea   = unitWallArea(unit._id);

                return (
                  <div key={unit._id}
                    className={`mt-2 border rounded-lg transition-colors ${
                      isExpanded ? 'border-indigo-200 bg-white shadow-sm' : 'border-slate-200 bg-slate-50/40 hover:border-slate-300'
                    }`}
                  >
                    {/* Kopfzeile */}
                    <div className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none" onClick={() => toggleUnit(unit._id)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {unit.number && <span className="font-bold text-sm text-slate-800">{unit.number}</span>}
                        <span className="text-sm text-slate-600">{unit.name}</span>
                        <span className="text-xs text-gray-400">{unitRooms.length} Räume</span>
                        {area > 0 && (
                          <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Boden: {area} m²
                          </span>
                        )}
                        {wallArea !== null && wallArea > 0 && (
                          <span className="text-xs font-semibold bg-sky-100 text-sky-700 border border-sky-200 px-2 py-0.5 rounded-full">
                            Wände: {wallArea} m²
                          </span>
                        )}
                      </div>
                      <svg className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    {/* Aufgeklappt */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 px-3 pt-3 pb-3">
                        <div className="flex gap-2 flex-wrap mb-3">
                          <button onClick={e => { e.stopPropagation(); setAddRoomTarget({ floorId: floor._id, unitId: unit._id }); }}
                            className="btn-primary btn-sm text-xs">+ Raum</button>
                          <button onClick={e => { e.stopPropagation(); setEditUnitTarget(unit); }}
                            className="text-xs border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg px-2 py-1">
                            ✏ Bearbeiten</button>
                          <button onClick={e => { e.stopPropagation(); setCopyUnitTarget(unit); }}
                            className="text-xs border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg px-2 py-1">
                            ⎘ Kopieren</button>
                          <button onClick={e => { e.stopPropagation(); if (confirm(`Wohnung "${unit.name}" und alle Räume wirklich löschen?`)) deleteUnitMut.mutate(unit._id); }}
                            className="text-xs border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-2 py-1">
                            Löschen</button>
                        </div>
                        {unitRooms.length === 0 ? (
                          <p className="text-xs text-gray-400 py-1">Noch keine Räume – "+ Raum" klicken</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {unitRooms.map(room => (
                              <RoomCard key={room._id} room={room} projectId={projectId!}
                                onEdit={setEditRoomTarget}
                                onDelete={id => deleteRoomMut.mutate(id)}
                                onCopy={handleCopyRoom}
                              />
                            ))}
                          </div>
                        )}
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

      {/* ── Stellplätze ──────────────────────────────────────────── */}
      {showStellplaetze && (
        <div className="mt-8 card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-900">Stellplätze</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {project?.anzahlStellplaetze ? `${project.anzahlStellplaetze} Stellplatz/Stellplätze` : ''}
                {project?.anzahlStellplaetze && project?.tiefgarageStellplaetze ? ' · ' : ''}
                {project?.tiefgarageStellplaetze ? `${project.tiefgarageStellplaetze} Tiefgaragen-Stellplätze` : ''}
                {(stellplaetze as Stellplatz[]).length > 0 && ` · ${(stellplaetze as Stellplatz[]).length} angelegt`}
              </p>
            </div>
            <button
              onClick={() => setStellplatzModal({ open: true, item: null })}
              className="btn-primary btn-sm"
            >+ Stellplatz</button>
          </div>

          {(stellplaetze as Stellplatz[]).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">
              Noch keine Stellplätze angelegt – "+ Stellplatz" klicken
            </p>
          ) : (
            <div className="space-y-2">
              {(stellplaetze as Stellplatz[]).map(sp => (
                <div key={sp._id} className="group flex items-center justify-between border border-slate-200 rounded-lg px-4 py-3 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
                  <div className="flex items-center gap-3">
                    {sp.nummer && (
                      <span className="text-sm font-bold text-indigo-700 bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded">
                        {sp.nummer}
                      </span>
                    )}
                    {sp.bezeichnung ? (
                      <span className="text-sm text-slate-700">{sp.bezeichnung}</span>
                    ) : (
                      <span className="text-sm text-slate-400 italic">Keine Bezeichnung</span>
                    )}
                  </div>
                  <div className="hidden group-hover:flex gap-1">
                    <button
                      onClick={() => setStellplatzModal({ open: true, item: sp })}
                      className="w-7 h-7 flex items-center justify-center rounded bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs"
                      title="Bearbeiten"
                    >✏</button>
                    <button
                      onClick={() => dupStellplatzMut.mutate(sp._id)}
                      className="w-7 h-7 flex items-center justify-center rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 text-xs"
                      title="Kopieren"
                    >⎘</button>
                    <button
                      onClick={() => { if (confirm(`Stellplatz "${sp.nummer || sp.bezeichnung}" wirklich löschen?`)) deleteStellplatzMut.mutate(sp._id); }}
                      className="w-7 h-7 flex items-center justify-center rounded bg-red-100 text-red-600 hover:bg-red-200 text-xs"
                      title="Löschen"
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────── */}
      {showAddFloor && <AddFloorModal projectId={projectId!} onClose={() => setShowAddFloor(false)} />}
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
      {addRoomTarget && <AddRoomModal projectId={projectId!} floorId={addRoomTarget.floorId} unitId={addRoomTarget.unitId} onClose={() => setAddRoomTarget(null)} />}
      {editRoomTarget && <EditRoomModal projectId={projectId!} room={editRoomTarget} onClose={() => setEditRoomTarget(null)} />}
      {stellplatzModal.open && (
        <StellplatzModal
          projectId={projectId!}
          item={stellplatzModal.item}
          existingNummern={(stellplaetze as Stellplatz[]).map(sp => sp.nummer).filter(Boolean)}
          onClose={() => setStellplatzModal({ open: false, item: null })}
        />
      )}
    </div>
  );
}
