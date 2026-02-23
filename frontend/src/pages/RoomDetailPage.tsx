import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getRoom, getPositions, deletePosition, getTemplates, getFloors } from '../api/projects';
import type { Floor, Position, PhaseType } from '../types';
import PositionForm from '../components/PositionForm';

const PHASE_LABELS: Record<string, string> = {
  demolition: 'Entkernung', renovation: 'Renovierung', specialConstruction: 'Sonderarbeiten',
};

const ROOM_TYPE_LABELS: Record<string, string> = {
  livingRoom: 'Wohnzimmer', bedroom: 'Schlafzimmer', bathroom: 'Bad/WC',
  kitchen: 'Küche', hallway: 'Flur', staircase: 'Treppenhaus',
  elevator: 'Aufzug', garage: 'Garage', basement: 'Keller',
  technicalRoom: 'Technikraum', balcony: 'Balkon', terrace: 'Terrasse',
  garden: 'Garten/Außenbereich', rooftop: 'Dach', other: 'Sonstiges',
};

function formatEur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export default function RoomDetailPage() {
  const { id: projectId, roomId } = useParams<{ id: string; roomId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const phase = (searchParams.get('phase') || 'demolition') as PhaseType;

  const [showForm, setShowForm] = useState(false);
  const [editPosition, setEditPosition] = useState<Position | null>(null);
  const qc = useQueryClient();

  const { data: room } = useQuery(['room', projectId, roomId], () => getRoom(projectId!, roomId!));
  const { data: positions = [], isLoading } = useQuery(
    ['positions', projectId, roomId, phase],
    () => getPositions(projectId!, { roomId, phaseType: phase })
  );
  const { data: templates = [] } = useQuery(['templates', phase], () => getTemplates(phase));
  const { data: projectFloors = [] } = useQuery(['floors', projectId], () => getFloors(projectId!));

  const deleteMutation = useMutation(
    (posId: string) => deletePosition(projectId!, posId),
    { onSuccess: () => qc.invalidateQueries(['positions', projectId, roomId, phase]) }
  );

  const totals = positions.reduce((acc, p) => ({
    material: acc.material + p.materialCost,
    disposal: acc.disposal + p.disposalCost,
    labor:    acc.labor    + p.laborCost,
    total:    acc.total    + p.totalCost,
  }), { material: 0, disposal: 0, labor: 0, total: 0 });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to={`/projects/${projectId}`} className="hover:text-gray-700">Projekt</Link>
        <span>›</span>
        <Link to={`/projects/${projectId}/building?phase=${phase}`} className="hover:text-gray-700">Gebäude</Link>
        {room?.floorId && typeof room.floorId !== 'string' && (
          <>
            <span>›</span>
            <span>{(room.floorId as Floor).name}</span>
          </>
        )}
        <span>›</span>
        <span className="text-gray-900 font-medium">{room?.name}</span>
      </div>

      {/* Room Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{room?.name}</h1>
          {(room?.type || room?.floorId) && (
            <p className="text-sm text-gray-500 mt-0.5">
              {room.type && ROOM_TYPE_LABELS[room.type] && ROOM_TYPE_LABELS[room.type]}
              {room.type && ROOM_TYPE_LABELS[room.type] && room.floorId && typeof room.floorId !== 'string' && ' · '}
              {room.floorId && typeof room.floorId !== 'string' && (room.floorId as Floor).name}
            </p>
          )}
          {room?.dimensions && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              {room.dimensions.length && room.dimensions.width && (
                <span className="text-sm text-gray-500">
                  {room.dimensions.length} m × {room.dimensions.width} m
                  {room.dimensions.height ? ` × ${room.dimensions.height} m` : ''}
                </span>
              )}
              {room.dimensions.area && (
                <span className="text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  {room.dimensions.area} m² Fläche
                </span>
              )}
              {room.dimensions.volume && (
                <span className="text-sm text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
                  {room.dimensions.volume} m³ Volumen
                </span>
              )}
            </div>
          )}
          {room?.properties?.includes('asbestos') && (
            <span className="inline-block mt-1 badge bg-red-100 text-red-700">⚠ Asbest vorhanden</span>
          )}
        </div>
      </div>

      {/* Phase Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {['demolition', 'renovation', 'specialConstruction'].map((p) => (
          <button key={p}
            onClick={() => setSearchParams({ phase: p })}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              phase === p ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {PHASE_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Positions Table */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">
            Positionen – {PHASE_LABELS[phase]} ({positions.length})
          </h2>
          <button onClick={() => { setEditPosition(null); setShowForm(true); }} className="btn-primary btn-sm">
            + Position hinzufügen
          </button>
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}</div>
        ) : positions.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="mb-3">Noch keine Positionen für diese Phase</p>
            <button onClick={() => setShowForm(true)} className="btn-secondary btn-sm">Position hinzufügen</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-cell text-left font-medium text-gray-600">Bezeichnung</th>
                  <th className="table-cell text-left font-medium text-gray-600">Bereich</th>
                  <th className="table-cell text-left font-medium text-gray-600">Kategorie</th>
                  <th className="table-cell text-right font-medium text-gray-600">Menge</th>
                  <th className="table-cell text-right font-medium text-gray-600">Material</th>
                  <th className="table-cell text-right font-medium text-gray-600">Entsorgung</th>
                  <th className="table-cell text-right font-medium text-gray-600">Arbeit</th>
                  <th className="table-cell text-right font-medium text-gray-600">Gesamt</th>
                  <th className="table-cell" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {positions.map((pos) => (
                  <tr key={pos._id} className="hover:bg-gray-50 group">
                    <td className="table-cell font-medium text-gray-900">{pos.name}</td>
                    <td className="table-cell text-gray-500">{pos.bereich || '–'}</td>
                    <td className="table-cell text-gray-500">{pos.category}</td>
                    <td className="table-cell text-right text-gray-600">{pos.quantity} {pos.unit}</td>
                    <td className="table-cell text-right text-gray-600">{formatEur(pos.materialCost)}</td>
                    <td className="table-cell text-right text-gray-600">{formatEur(pos.disposalCost)}</td>
                    <td className="table-cell text-right text-gray-600">{formatEur(pos.laborCost)}</td>
                    <td className="table-cell text-right font-semibold text-gray-900">{formatEur(pos.totalCost)}</td>
                    <td className="table-cell">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditPosition(pos); setShowForm(true); }}
                          className="btn-secondary btn-sm px-2">✏</button>
                        <button onClick={() => { if (confirm('Position löschen?')) deleteMutation.mutate(pos._id); }}
                          className="btn-danger btn-sm px-2">✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-300 font-semibold">
                <tr>
                  <td className="table-cell" colSpan={4}>Gesamt</td>
                  <td className="table-cell text-right">{formatEur(totals.material)}</td>
                  <td className="table-cell text-right">{formatEur(totals.disposal)}</td>
                  <td className="table-cell text-right">{formatEur(totals.labor)}</td>
                  <td className="table-cell text-right text-primary-700 text-base">{formatEur(totals.total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Position Form Modal */}
      {showForm && (
        <PositionForm
          projectId={projectId!}
          roomId={roomId!}
          phaseType={phase}
          templates={templates}
          editPosition={editPosition}
          defaultHourlyRate={45}
          roomDimensions={room?.dimensions}
          projectFloors={projectFloors}
          onClose={() => { setShowForm(false); setEditPosition(null); }}
          onSuccess={() => {
            qc.invalidateQueries(['positions', projectId, roomId, phase]);
            setShowForm(false);
            setEditPosition(null);
          }}
        />
      )}
    </div>
  );
}
