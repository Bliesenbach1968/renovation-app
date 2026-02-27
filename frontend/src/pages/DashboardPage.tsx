import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getProjects, deleteProject } from '../api/projects';
import { useAuth } from '../context/AuthContext';
import type { Project } from '../types';

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  planning:  { label: 'Planung',        dot: 'bg-primary-400', bg: 'bg-primary-50', text: 'text-primary-700' },
  active:    { label: 'Aktiv',          dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'on-hold': { label: 'Pausiert',       dot: 'bg-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-700' },
  completed: { label: 'Abgeschlossen',  dot: 'bg-slate-400',   bg: 'bg-slate-100',  text: 'text-slate-600' },
  cancelled: { label: 'Abgebrochen',    dot: 'bg-red-500',     bg: 'bg-red-50',     text: 'text-red-700' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, dot: 'bg-slate-400', bg: 'bg-slate-100', text: 'text-slate-600' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ProjectCard({ project, onDelete, isAdmin }: { project: Project; onDelete: (id: string, name: string) => void; isAdmin: boolean }) {
  const navigate = useNavigate();
  const completedPhases = project.phases.filter((p: any) => p.status === 'completed').length;

  return (
    <div className="bg-white rounded-2xl border border-black/[0.07] shadow-card hover:shadow-card-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden group" style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.05)' }}>
      {/* Top accent bar for active projects */}
      {project.status === 'active' && (
        <div className="h-0.5 bg-gradient-to-r from-primary-500 to-primary-400" />
      )}

      <div className="p-5 flex-1">
        <Link to={`/projects/${project._id}`} className="block">
          <div className="flex items-start justify-between gap-3 mb-3">
            <span className="text-[11px] font-mono text-slate-400 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5">
              {project.projectNumber}
            </span>
            <StatusBadge status={project.status} />
          </div>

          <h3 className="font-semibold text-slate-900 text-base leading-snug mb-1 group-hover:text-primary-600 transition-colors">
            {project.name}
          </h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            {project.address.street}, {project.address.zipCode} {project.address.city}
          </p>
          {project.client?.name && (
            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              {project.client.company || project.client.name}
            </p>
          )}
        </Link>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', background: 'rgba(245,245,247,0.6)' }}>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
            {project.team.length}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            {completedPhases}/{project.phases.length} Phasen
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate(`/projects/${project._id}/edit`)}
            className="btn btn-sm bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm focus:ring-primary-500 text-xs"
          >
            Bearbeiten
          </button>
          {isAdmin && (
            <button
              onClick={() => onDelete(project._id, project.name)}
              className="btn btn-sm bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 shadow-sm focus:ring-red-500 text-xs"
            >
              Löschen
            </button>
          )}
        </div>
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

  const stats = {
    total:     projects.length,
    active:    projects.filter((p: Project) => p.status === 'active').length,
    planning:  projects.filter((p: Project) => p.status === 'planning').length,
    completed: projects.filter((p: Project) => p.status === 'completed').length,
  };

  return (
    <div className="min-h-screen" style={{ background: '#F5F5F7' }}>
      {/* ── Page Header ─────────────────────────────────── */}
      <div className="px-6 py-5" style={{ background: 'rgba(245,245,247,0.85)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', borderBottom: '0.5px solid rgba(0,0,0,0.10)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-[20px] font-bold tracking-tight" style={{ color: '#1D1D1F', letterSpacing: '-0.022em' }}>Projektübersicht</h1>
            <p className="text-[13px] mt-0.5" style={{ color: '#6E6E73' }}>
              {projects.length} Projekt{projects.length !== 1 ? 'e' : ''} gesamt
            </p>
          </div>
          {isProjectLeader && (
            <button onClick={() => navigate('/projects/new')} className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Neues Projekt
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* ── Stats Row ──────────────────────────────────── */}
        {!isLoading && projects.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Gesamt',        value: stats.total,     color: 'text-slate-900' },
              { label: 'Aktiv',         value: stats.active,    color: 'text-emerald-600' },
              { label: 'In Planung',    value: stats.planning,  color: 'text-primary-600' },
              { label: 'Abgeschlossen', value: stats.completed, color: 'text-slate-500' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <p className={`stat-value ${s.color}`}>{s.value}</p>
                <p className="stat-label">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Filters ────────────────────────────────────── */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, Nummer, Stadt suchen…"
              className="input pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input max-w-[160px]"
          >
            <option value="">Alle Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* ── Grid ───────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-100 shadow-card h-44 animate-pulse">
                <div className="p-5 space-y-3">
                  <div className="flex justify-between">
                    <div className="h-5 w-20 bg-slate-100 rounded" />
                    <div className="h-5 w-16 bg-slate-100 rounded-md" />
                  </div>
                  <div className="h-5 w-3/4 bg-slate-100 rounded" />
                  <div className="h-4 w-1/2 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="card text-center py-12">
            <svg className="w-10 h-10 text-red-300 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-red-600 font-medium">Fehler beim Laden der Projekte</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="card text-center py-16">
            <svg className="w-12 h-12 text-slate-200 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={1.25} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
            </svg>
            <p className="text-slate-500 font-medium mb-1">Keine Projekte gefunden</p>
            <p className="text-slate-400 text-sm mb-5">
              {search || statusFilter ? 'Keine Projekte entsprechen den Filterkriterien.' : 'Starten Sie mit dem ersten Projekt.'}
            </p>
            {isProjectLeader && !search && !statusFilter && (
              <button onClick={() => navigate('/projects/new')} className="btn-primary">
                Erstes Projekt anlegen
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p: Project) => (
              <ProjectCard
                key={p._id}
                project={p}
                isAdmin={isAdmin}
                onDelete={(id, name) => setConfirmDelete({ id, name })}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Delete Confirm Modal ───────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-modal w-full max-w-sm p-6">
            <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-900 text-center mb-1">Projekt löschen?</h3>
            <p className="text-sm text-slate-600 text-center mb-3">
              <span className="font-semibold">"{confirmDelete.name}"</span> wird unwiderruflich entfernt.
            </p>
            <div className="bg-red-50 border border-red-200/80 rounded-lg px-3 py-2.5 mb-5">
              <p className="text-xs text-red-700 leading-relaxed">
                Alle Etagen, Räume, Positionen und Container werden ebenfalls gelöscht.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">
                Abbrechen
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isLoading}
                className="btn-danger flex-1"
              >
                {deleteMutation.isLoading ? 'Löschen…' : 'Ja, löschen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
