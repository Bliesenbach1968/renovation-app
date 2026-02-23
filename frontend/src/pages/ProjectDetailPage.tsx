import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm, useWatch } from 'react-hook-form';
import { getProject, updateProject } from '../api/projects';

const PHASE_LABELS: Record<string, string> = {
  demolition: 'Entkernung',
  renovation: 'Renovierung',
  specialConstruction: 'Sonderarbeiten',
};
const PHASE_STATUS: Record<string, { label: string; color: string }> = {
  planned:    { label: 'Geplant',       color: 'bg-gray-100 text-gray-700' },
  active:     { label: 'Aktiv',         color: 'bg-green-100 text-green-700' },
  completed:  { label: 'Abgeschlossen', color: 'bg-blue-100 text-blue-700' },
};
const PROJECT_STATUS: Record<string, { label: string; color: string }> = {
  planning:  { label: 'Planung',       color: 'bg-blue-100 text-blue-800' },
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
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

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useQuery(['project', id], () => getProject(id!));
  const [showEditKennzahlen, setShowEditKennzahlen] = useState(false);

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
    <div className="min-h-full bg-sky-50">
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
            <h3 className="font-medium text-gray-900 mb-2">Team ({project.team.length})</h3>
            <div className="space-y-2">
              {project.team.slice(0, 5).map((m) => (
                <div key={m.userId._id} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">
                    {m.userId.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-none">{m.userId.name}</p>
                    <p className="text-xs text-gray-400">{m.role}</p>
                  </div>
                </div>
              ))}
              {project.team.length > 5 && <p className="text-xs text-gray-400">+{project.team.length - 5} weitere</p>}
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
