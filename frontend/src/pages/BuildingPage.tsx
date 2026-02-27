import { useState, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import {
  getProject, getFloors, getRooms, createFloor, createRoom, deleteRoom, deleteFloor,
  getUnits, createUnit, deleteUnit, getTemplates,
} from '../api/projects';
import type { Floor, Unit, Room, PhaseType, PositionTemplate } from '../types';
import PositionForm, { getBereicheForPhase, BEREICH_UNTERPUNKTE } from '../components/PositionForm';

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

function BereichPositionsPanel({
  phase, bereich, unterpunkt, onAdd,
}: {
  phase: string;
  bereich: string;
  unterpunkt?: string;
  onAdd: (template?: PositionTemplate) => void;
}) {
  const { data: allTemplates = [] } = useQuery(
    ['templates', phase],
    () => getTemplates(phase || undefined)
  );
  const templates = (allTemplates as PositionTemplate[]).filter(t =>
    t.bereich === bereich &&
    (!unterpunkt || !t.bereichUnterpunkt || t.bereichUnterpunkt === unterpunkt)
  );

  const title = unterpunkt ? `${bereich} · ${unterpunkt}` : bereich;

  return (
    <div className="border border-primary-200/60 bg-primary-50/30 rounded-xl p-4 mb-4 shadow-sm">
      <h3 className="font-semibold text-slate-700 text-sm mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
        Position hinzufügen – {title}
      </h3>
      <div className="space-y-2">
        <button
          onClick={() => onAdd()}
          className="btn-primary w-full text-sm py-2"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Position hinzufügen
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

function AddUnitModal({ projectId, floorId, onClose }: { projectId: string; floorId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const mutation = useMutation(
    () => createUnit(projectId, { floorId, name: name || `Wohnung ${number}`, number: number || undefined }),
    { onSuccess: () => { qc.invalidateQueries(['units', projectId]); onClose(); } }
  );
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-semibold text-lg mb-4">Neue Wohnung anlegen</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Wohnungsnummer</label>
            <input value={number} onChange={(e) => setNumber(e.target.value)} className="input" placeholder="z.B. 01, 1A, EG-links" />
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

export default function BuildingPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPhase = searchParams.get('phase') || 'demolition';
  const selectedBereich = searchParams.get('bereich') || '';
  const selectedUnterpunkt = searchParams.get('unterpunkt') || '';
  const [expandedBereich, setExpandedBereich] = useState('');

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

  const { data: templates = [] } = useQuery(
    ['templates', selectedPhase],
    () => getTemplates(selectedPhase || undefined)
  );

  const bereiche = useMemo(() => getBereicheForPhase(selectedPhase, floors), [selectedPhase, floors]);

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

  const RoomCard = ({ room }: { room: Room }) => (
    <div className="group relative border border-gray-200 rounded-lg p-3 hover:border-primary-300 hover:bg-primary-50 transition-colors">
      <Link to={`/projects/${projectId}/rooms/${room._id}?phase=${selectedPhase}${selectedBereich ? `&bereich=${encodeURIComponent(selectedBereich)}` : ''}${selectedUnterpunkt ? `&unterpunkt=${encodeURIComponent(selectedUnterpunkt)}` : ''}`} className="block">
        <p className="font-medium text-sm text-gray-900">{room.name}</p>
        <p className="text-xs text-gray-500">{ROOM_TYPE_LABELS[room.type] || room.type}</p>
        {room.dimensions?.area && <p className="text-xs text-primary-600 mt-1">{room.dimensions.area} m²</p>}
        {room.properties?.includes('asbestos') && (
          <span className="inline-block mt-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Asbest</span>
        )}
      </Link>
      <button
        onClick={() => { if (confirm(`Raum "${room.name}" wirklich löschen?`)) deleteRoomMutation.mutate(room._id); }}
        className="absolute top-2 right-2 hidden group-hover:flex items-center justify-center w-6 h-6 rounded bg-red-100 text-red-600 hover:bg-red-200 text-xs"
        title="Raum löschen">✕</button>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/projects/${projectId}`} className="text-gray-400 hover:text-gray-600 text-sm">← Projekt</Link>
        <h1 className="text-xl font-bold text-gray-900">{project?.name} – Gebäudestruktur</h1>
      </div>

      {/* Phase-Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        {[
          { key: 'demolition', label: 'Entkernung' },
          { key: 'renovation', label: 'Renovierung' },
          { key: 'specialConstruction', label: 'Sonderarbeiten' },
        ].map((tab) => (
          <Link key={tab.key}
            to={`/projects/${projectId}/building?phase=${tab.key}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              selectedPhase === tab.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Bereich-Filter */}
      <div className="flex items-center gap-2 py-3 mb-3 flex-wrap">
        <span className="text-xs text-gray-500 font-medium shrink-0">Bereich:</span>
        <button
          onClick={() => { setBereich(''); setExpandedBereich(''); }}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            !selectedBereich
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
          }`}
        >
          Alle
        </button>
        {bereiche.map((b) => {
          const subItems = BEREICH_UNTERPUNKTE[b];
          const isExpanded = expandedBereich === b;
          const isParentActive = selectedBereich === b;

          if (subItems) {
            return (
              <>
                <button key={b}
                  onClick={() => setExpandedBereich(isExpanded ? '' : b)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                    isParentActive
                      ? 'bg-primary-600 text-white border-primary-600'
                      : isExpanded
                      ? 'bg-primary-50 text-primary-700 border-primary-300'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
                  }`}
                >
                  {b}
                  <span className={`text-[10px] inline-block transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {isExpanded && subItems.map((sub) => {
                  const isSubActive = selectedBereich === b && selectedUnterpunkt === sub;
                  return (
                    <button key={sub}
                      onClick={() => {
                        if (isSubActive) { setBereich(''); setExpandedBereich(''); }
                        else { setBereich(b, sub); setExpandedBereich(''); }
                      }}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        isSubActive
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-primary-50 text-primary-600 border-primary-200 hover:border-primary-400'
                      }`}
                    >
                      ↳ {sub}
                    </button>
                  );
                })}
              </>
            );
          }

          return (
            <button key={b}
              onClick={() => { setBereich(isParentActive && !selectedUnterpunkt ? '' : b); setExpandedBereich(''); }}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                isParentActive && !selectedUnterpunkt
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
              }`}
            >
              {b}
            </button>
          );
        })}
      </div>

      {/* Bereich-Vorlagen-Panel */}
      {selectedBereich && (
        <BereichPositionsPanel
          phase={selectedPhase}
          bereich={selectedBereich}
          unterpunkt={selectedUnterpunkt || undefined}
          onAdd={(template) => {
            setSelectedTemplate(template || null);
            setShowBereichForm(true);
          }}
        />
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

              {/* Direkte Räume (ohne Wohnung) */}
              {directRooms.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                  {directRooms.map((room) => <RoomCard key={room._id} room={room} />)}
                </div>
              )}

              {directRooms.length === 0 && floorUnits.length === 0 && (
                <p className="text-sm text-gray-400 py-2">Noch keine Räume – "+ Raum" oder "+ Wohnung" klicken</p>
              )}

              {/* Wohnungen */}
              {floorUnits.map((unit) => {
                const unitRooms = roomsByUnit(unit._id);
                return (
                  <div key={unit._id} className="mt-3 border border-slate-200 rounded-lg p-3 bg-slate-50/40">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-slate-700">{unit.name}</span>
                        {unit.number && <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Nr. {unit.number}</span>}
                        <span className="text-xs text-gray-400">{unitRooms.length} Räume</span>
                        {unitTotalArea(unit._id) > 0 && (
                          <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                            {unitTotalArea(unit._id)} m² gesamt
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setAddRoomTarget({ floorId: floor._id, unitId: unit._id })} className="btn-secondary btn-sm text-xs">+ Raum</button>
                        <button
                          onClick={() => { if (confirm(`Wohnung "${unit.name}" und alle Räume wirklich löschen?`)) deleteUnitMutation.mutate(unit._id); }}
                          className="text-xs border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-2 py-1"
                          title="Wohnung löschen">Löschen</button>
                      </div>
                    </div>
                    {unitRooms.length === 0 ? (
                      <p className="text-xs text-gray-400 py-1">Noch keine Räume – "+ Raum" klicken</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {unitRooms.map((room) => <RoomCard key={room._id} room={room} />)}
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
      {addUnitFloor && <AddUnitModal projectId={projectId!} floorId={addUnitFloor} onClose={() => setAddUnitFloor(null)} />}
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
          editPosition={null}
          initialTemplate={selectedTemplate}
          defaultHourlyRate={45}
          projectFloors={floors}
          onClose={() => { setShowBereichForm(false); setSelectedTemplate(null); }}
          onSuccess={() => {
            qc.invalidateQueries(['positions']);
            setShowBereichForm(false);
            setSelectedTemplate(null);
          }}
        />
      )}
    </div>
  );
}
