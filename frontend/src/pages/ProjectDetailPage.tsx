import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm, useWatch } from 'react-hook-form';
import { getProject, updateProject, addTeamMember, removeTeamMember } from '../api/projects';
import { getUsers } from '../api/auth';
import { useAuth } from '../context/AuthContext';

const PHASE_LABELS: Record<string, string> = {
  demolition: 'Entkernung',
  renovation: 'Renovierung',
  specialConstruction: 'Sonderarbeiten',
};
const PHASE_STATUS: Record<string, { label: string; color: string }> = {
  planned:    { label: 'Geplant',       color: 'bg-gray-100 text-gray-700' },
  active:     { label: 'Aktiv',         color: 'bg-green-100 text-green-700' },
  completed:  { label: 'Abgeschlossen', color: 'bg-slate-100 text-slate-600' },
};
const PROJECT_STATUS: Record<string, { label: string; color: string }> = {
  planning:  { label: 'Planung',       color: 'bg-slate-100 text-slate-700' },
  active:    { label: 'Aktiv',         color: 'bg-green-100 text-green-800' },
  'on-hold': { label: 'Pausiert',      color: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Abgeschlossen', color: 'bg-gray-100 text-gray-800' },
  cancelled: { label: 'Abgebrochen',  color: 'bg-red-100 text-red-800' },
};

interface GebaeudekennzahlenForm {
  anzahlWohnungen: number;
  anzahlGewerbe: number;
  etagenOhneKeller: number;
  kellerAnzahl: number;
  tiefgarage: boolean;
  tiefgarageStellplaetze: number;
  aussenanlagenVorhanden: boolean;
}

function GebaeudekennzahlenModal({ project, onClose }: { project: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit, control } = useForm<GebaeudekennzahlenForm>({
    defaultValues: {
      anzahlWohnungen:        project.anzahlWohnungen        ?? 0,
      anzahlGewerbe:          project.anzahlGewerbe          ?? 0,
      etagenOhneKeller:       project.etagenOhneKeller       ?? 0,
      kellerAnzahl:           project.kellerAnzahl           ?? 0,
      tiefgarage:             project.tiefgarage             ?? false,
      tiefgarageStellplaetze: project.tiefgarageStellplaetze ?? 0,
      aussenanlagenVorhanden: project.aussenanlagenVorhanden ?? false,
    },
  });
  const tiefgarage = useWatch({ control, name: 'tiefgarage' });

  const mutation = useMutation(
    (data: GebaeudekennzahlenForm) => updateProject(project._id, {
      anzahlWohnungen:        +data.anzahlWohnungen || 0,
      anzahlGewerbe:          +data.anzahlGewerbe   || 0,
      etagenOhneKeller:       +data.etagenOhneKeller || 0,
      kellerAnzahl:           +data.kellerAnzahl     || 0,
      tiefgarage:             !!data.tiefgarage,
      tiefgarageStellplaetze: data.tiefgarage ? (+data.tiefgarageStellplaetze || 0) : 0,
      aussenanlagenVorhanden: !!data.aussenanlagenVorhanden,
    } as any),
    {
      onSuccess: () => {
        qc.invalidateQueries(['project', project._id]);
        onClose();
      },
    }
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="font-semibold text-lg mb-4">Gebäudekennzahlen bearbeiten</h3>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Anzahl Wohnungen</label>
              <input {...register('anzahlWohnungen', { valueAsNumber: true })} type="number" min={0} className="input" />
            </div>
            <div>
              <label className="label">Anzahl Gewerbe</label>
              <input {...register('anzahlGewerbe', { valueAsNumber: true })} type="number" min={0} className="input" />
            </div>
            <div>
              <label className="label">
                Etagen ohne Keller
                <span className="ml-1 text-gray-400 text-xs font-normal" title="Vollgeschosse oberirdisch">ⓘ</span>
              </label>
              <input {...register('etagenOhneKeller', { valueAsNumber: true })} type="number" min={0} className="input" />
            </div>
            <div>
              <label className="label">Keller</label>
              <input {...register('kellerAnzahl', { valueAsNumber: true })} type="number" min={0} className="input" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input {...register('tiefgarage')} type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span className="label mb-0">Tiefgarage vorhanden</span>
            </label>
            {tiefgarage && (
              <div className="ml-7 max-w-xs">
                <label className="label">Anzahl Stellplätze</label>
                <input {...register('tiefgarageStellplaetze', { valueAsNumber: true })} type="number" min={0} className="input" />
              </div>
            )}
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input {...register('aussenanlagenVorhanden')} type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span className="label mb-0">Außenanlagen vorhanden</span>
          </label>

          {mutation.isError && (
            <p className="text-xs text-red-600">{(mutation.error as any)?.response?.data?.message || 'Fehler beim Speichern'}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={mutation.isLoading} className="btn-primary">
              {mutation.isLoading ? 'Speichern…' : 'Speichern'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const TEAM_ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator', projectLeader: 'Projektleiter', calculator: 'Kalkulator',
  worker: 'Ausführend', external: 'Extern',
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: project, isLoading } = useQuery(['project', id], () => getProject(id!));
  const [showEditKennzahlen, setShowEditKennzahlen] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addRole, setAddRole] = useState('worker');

  const { data: allUsers = [] } = useQuery('users', getUsers, { enabled: isAdmin });

  const addMemberMutation = useMutation(
    () => addTeamMember(id!, { userId: addUserId, role: addRole }),
    {
      onSuccess: () => {
        qc.invalidateQueries(['project', id]);
        setShowAddMember(false);
        setAddUserId('');
        setAddRole('worker');
      },
    }
  );

  const removeMemberMutation = useMutation(
    (userId: string) => removeTeamMember(id!, userId),
    { onSuccess: () => qc.invalidateQueries(['project', id]) }
  );

  if (isLoading) return <div className="p-6"><div className="animate-pulse h-8 w-64 bg-gray-200 rounded mb-4" /></div>;
  if (!project) return <div className="p-6 text-red-600">Projekt nicht gefunden</div>;

  const st = PROJECT_STATUS[project.status];
  const sortedPhases = [...project.phases].sort((a, b) => a.order - b.order);

  const hasKennzahlen = (project.anzahlWohnungen ?? 0) > 0
    || (project.anzahlGewerbe ?? 0) > 0
    || (project.etagenOhneKeller ?? 0) > 0
    || (project.kellerAnzahl ?? 0) > 0
    || project.tiefgarage
    || project.aussenanlagenVorhanden;

  return (
    <div className="min-h-full bg-slate-50">
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</button>
            <span className="text-gray-300">|</span>
            <span className="font-mono text-sm text-gray-500">{project.projectNumber}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-gray-500">{project.address.street}, {project.address.zipCode} {project.address.city}</p>
        </div>
        <span className={`badge ${st.color} text-sm px-3 py-1`}>{st.label}</span>
      </div>

      {/* Schnellnavigation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Gebäude & Räume', to: `/projects/${id}/building`, icon: '🏠' },
          { label: 'Kostenkalkulation', to: `/projects/${id}/summary`, icon: '💰' },
          { label: 'Zeitplan', to: `/projects/${id}/timeline`, icon: '📅' },
          { label: 'Container & Entsorgung', to: `/projects/${id}/containers`, icon: '🗑️' },
          { label: 'Gerüst', to: `/projects/${id}/geruest`, icon: '🏗️' },
          { label: 'Kran', to: `/projects/${id}/kran`, icon: '🏋️' },
        ].map((item) => (
          <Link key={item.to} to={item.to}
            className="card hover:shadow-md transition-shadow text-center cursor-pointer group py-4">
            <div className="text-2xl mb-1">{item.icon}</div>
            <p className="text-sm font-medium text-gray-700 group-hover:text-primary-600">{item.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Phasen */}
        <div className="lg:col-span-2">
          <h2 className="font-semibold text-gray-900 mb-3">Projektphasen</h2>
          <div className="space-y-3">
            {sortedPhases.map((phase) => {
              const ps = PHASE_STATUS[phase.status];
              return (
                <Link key={phase._id} to={`/projects/${id}/building?phase=${phase.type}`}
                  className="card hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{phase.name}</h3>
                      <span className={`badge ${ps.color}`}>{ps.label}</span>
                    </div>
                    {phase.timeline?.plannedStart && (
                      <p className="text-xs text-gray-400">
                        Geplant: {new Date(phase.timeline.plannedStart).toLocaleDateString('de-DE')}
                        {phase.timeline.plannedEnd && ` – ${new Date(phase.timeline.plannedEnd).toLocaleDateString('de-DE')}`}
                      </p>
                    )}
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Info-Panel */}
        <div className="space-y-4">
          {project.client?.name && (
            <div className="card">
              <h3 className="font-medium text-gray-900 mb-2">Auftraggeber</h3>
              <p className="text-sm text-gray-700">{project.client.company || project.client.name}</p>
              {project.client.phone && <p className="text-xs text-gray-500 mt-1">{project.client.phone}</p>}
              {project.client.email && <p className="text-xs text-gray-500">{project.client.email}</p>}
            </div>
          )}

          {/* Gebäudekennzahlen */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900">Gebäudekennzahlen</h3>
              <button
                onClick={() => setShowEditKennzahlen(true)}
                className="text-xs text-primary-600 hover:text-primary-800 border border-primary-200 rounded px-2 py-0.5 hover:bg-primary-50 transition-colors"
              >
                Bearbeiten
              </button>
            </div>
            {hasKennzahlen ? (
              <div className="text-sm text-gray-600 space-y-1">
                {(project.anzahlWohnungen ?? 0) > 0 && <p>Wohnungen: <span className="font-medium text-gray-800">{project.anzahlWohnungen}</span></p>}
                {(project.anzahlGewerbe ?? 0) > 0 && <p>Gewerbe: <span className="font-medium text-gray-800">{project.anzahlGewerbe}</span></p>}
                {(project.etagenOhneKeller ?? 0) > 0 && <p>Etagen (OG): <span className="font-medium text-gray-800">{project.etagenOhneKeller}</span></p>}
                {(project.kellerAnzahl ?? 0) > 0 && <p>Keller: <span className="font-medium text-gray-800">{project.kellerAnzahl}</span></p>}
                {project.tiefgarage && (
                  <p>Tiefgarage: <span className="font-medium text-gray-800">
                    Ja{(project.tiefgarageStellplaetze ?? 0) > 0 ? ` (${project.tiefgarageStellplaetze} Stellplätze)` : ''}
                  </span></p>
                )}
                {project.aussenanlagenVorhanden && <p>Außenanlagen: <span className="font-medium text-gray-800">Ja</span></p>}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Noch keine Kennzahlen eingetragen –
                <button onClick={() => setShowEditKennzahlen(true)} className="ml-1 text-primary-600 hover:underline">jetzt erfassen</button>
              </p>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Team ({project.team.length})</h3>
              {isAdmin && (
                <button
                  onClick={() => setShowAddMember(!showAddMember)}
                  className="text-xs text-primary-600 hover:text-primary-800 border border-primary-200 rounded px-2 py-0.5 hover:bg-primary-50 transition-colors"
                >
                  + Hinzufügen
                </button>
              )}
            </div>

            {/* Mitglied hinzufügen */}
            {showAddMember && isAdmin && (
              <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div>
                  <label className="label">Nutzer</label>
                  <select
                    value={addUserId}
                    onChange={(e) => setAddUserId(e.target.value)}
                    className="input"
                  >
                    <option value="">– Nutzer wählen –</option>
                    {allUsers
                      .filter((u: any) => !project.team.some((m: any) => m.userId._id === u._id))
                      .map((u: any) => (
                        <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="label">Projektrolle</label>
                  <select value={addRole} onChange={(e) => setAddRole(e.target.value)} className="input">
                    {Object.entries(TEAM_ROLE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                {addMemberMutation.isError && (
                  <p className="text-xs text-red-600">{(addMemberMutation.error as any)?.response?.data?.message || 'Fehler'}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => addMemberMutation.mutate()}
                    disabled={!addUserId || addMemberMutation.isLoading}
                    className="btn-primary btn-sm"
                  >
                    {addMemberMutation.isLoading ? 'Hinzufügen…' : 'Hinzufügen'}
                  </button>
                  <button onClick={() => setShowAddMember(false)} className="btn-secondary btn-sm">Abbrechen</button>
                </div>
              </div>
            )}

            {/* Mitgliederliste */}
            <div className="space-y-1">
              {project.team.map((m: any) => (
                <div key={m.userId._id} className="flex items-center gap-2 py-1 group">
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {m.userId.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-none truncate">{m.userId.name}</p>
                    <p className="text-xs text-gray-400">{TEAM_ROLE_LABELS[m.role] || m.role}</p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => removeMemberMutation.mutate(m.userId._id)}
                      disabled={removeMemberMutation.isLoading}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all text-xs px-1"
                      title="Entfernen"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {project.team.length === 0 && (
                <p className="text-xs text-gray-400">Noch keine Teammitglieder</p>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="font-medium text-gray-900 mb-2">Einstellungen</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Stundensatz: {project.settings.defaultHourlyRate} €/Std</p>
              <p>Estrich-Standard: {project.settings.defaultEstrichThickness} mm</p>
            </div>
          </div>
        </div>
      </div>

      {showEditKennzahlen && (
        <GebaeudekennzahlenModal project={project} onClose={() => setShowEditKennzahlen(false)} />
      )}
    </div>
    </div>
  );
}
