import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getProjects, deleteProject } from '../api/projects';
import { useAuth } from '../context/AuthContext';
import type { Project } from '../types';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planning:   { label: 'Planung',     color: 'bg-blue-100 text-blue-800' },
  active:     { label: 'Aktiv',       color: 'bg-green-100 text-green-800' },
  'on-hold':  { label: 'Pausiert',    color: 'bg-yellow-100 text-yellow-800' },
  completed:  { label: 'Abgeschlossen', color: 'bg-gray-100 text-gray-800' },
  cancelled:  { label: 'Abgebrochen', color: 'bg-red-100 text-red-800' },
};

function ProjectCard({ project, onDelete }: { project: Project; onDelete: (id: string, name: string) => void }) {
  const navigate = useNavigate();
  const st = STATUS_LABELS[project.status] || { label: project.status, color: 'bg-gray-100 text-gray-800' };
  return (
    <div className="card hover:shadow-md transition-shadow">
      <Link to={`/projects/${project._id}`} className="block mb-3">
        <div className="flex justify-between items-start mb-3">
          <span className="text-xs font-mono text-gray-500">{project.projectNumber}</span>
          <span className={`badge ${st.color}`}>{st.label}</span>
        </div>
        <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors mb-1">{project.name}</h3>
        <p className="text-sm text-gray-500">{project.address.street}, {project.address.zipCode} {project.address.city}</p>
        {project.client?.name && <p className="text-xs text-gray-400 mt-2">Auftraggeber: {project.client.company || project.client.name}</p>}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
          <span>{project.team.length} Teammitglied{project.team.length !== 1 ? 'er' : ''}</span>
          <span>{project.phases.filter(p => p.status === 'completed').length}/{project.phases.length} Phasen</span>
        </div>
      </Link>
      <div className="flex justify-end gap-2 border-t border-gray-100 pt-2">
        <button
          onClick={() => navigate(`/projects/${project._id}/edit`)}
          className="btn-sm btn-secondary px-3"
        >Bearbeiten</button>
        <button
          onClick={() => onDelete(project._id, project.name)}
          className="btn-sm border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-3"
        >Löschen</button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { isProjectLeader, isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const deleteMutation = useMutation(
    (id: string) => deleteProject(id),
    { onSuccess: () => { qc.invalidateQueries('projects'); setConfirmDelete(null); } }
  );

  const { data: projects = [], isLoading, error } = useQuery(
    ['projects', search, statusFilter],
    () => getProjects({ search: search || undefined, status: statusFilter || undefined }),
    { keepPreviousData: true }
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projektübersicht</h1>
          <p className="text-gray-500 text-sm">{projects.length} Projekt{projects.length !== 1 ? 'e' : ''}</p>
        </div>
        {isProjectLeader && (
          <button onClick={() => navigate('/projects/new')} className="btn-primary">
            + Neues Projekt
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche nach Name, Nummer, Stadt..."
          className="input max-w-xs"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input max-w-[180px]">
          <option value="">Alle Status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="card animate-pulse h-40 bg-gray-200" />)}
        </div>
      ) : error ? (
        <div className="card text-red-600 text-center py-12">Fehler beim Laden der Projekte</div>
      ) : projects.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-400 text-lg mb-4">Keine Projekte gefunden</p>
          {isProjectLeader && <button onClick={() => navigate('/projects/new')} className="btn-primary">Erstes Projekt anlegen</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <ProjectCard
              key={p._id}
              project={p}
              onDelete={isAdmin ? (id, name) => setConfirmDelete({ id, name }) : () => {}}
            />
          ))}
        </div>
      )}

      {/* Bestätigungsdialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Projekt löschen?</h3>
            <p className="text-sm text-gray-600 mb-1">
              Möchtest du das Projekt <span className="font-semibold">"{confirmDelete.name}"</span> wirklich löschen?
            </p>
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4">
              Alle Etagen, Räume, Positionen und Container werden unwiderruflich gelöscht.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isLoading}
                className="btn-danger flex-1"
              >
                {deleteMutation.isLoading ? 'Löschen…' : 'Ja, löschen'}
              </button>
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
