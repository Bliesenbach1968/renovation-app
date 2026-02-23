import { useNavigate, useParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { getProject, updateProject } from '../api/projects';

interface PhaseTimeline { plannedStart: string; plannedEnd: string; }

interface FormData {
  name: string;
  status: string;
  description: string;
  address: { street: string; zipCode: string; city: string };
  client: { name: string; company: string; phone: string; email: string };
  settings: { defaultHourlyRate: number };
  anzahlWohnungen: number;
  anzahlGewerbe: number;
  etagenOhneKeller: number;
  kellerAnzahl: number;
  tiefgarage: boolean;
  tiefgarageStellplaetze: number;
  aussenanlagenVorhanden: boolean;
  phaseTimelines: {
    demolition: PhaseTimeline;
    renovation: PhaseTimeline;
    specialConstruction: PhaseTimeline;
  };
}

const STATUS_OPTIONS = [
  { value: 'planning',   label: 'Planung' },
  { value: 'active',     label: 'Aktiv' },
  { value: 'on-hold',    label: 'Pausiert' },
  { value: 'completed',  label: 'Abgeschlossen' },
  { value: 'cancelled',  label: 'Abgebrochen' },
];

function toDateInput(iso?: string) {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function phaseTimeline(phases: any[], type: string): PhaseTimeline {
  const p = phases?.find((ph: any) => ph.type === type);
  return {
    plannedStart: toDateInput(p?.timeline?.plannedStart),
    plannedEnd:   toDateInput(p?.timeline?.plannedEnd),
  };
}

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: project, isLoading } = useQuery(['project', id], () => getProject(id!));

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormData>({
    values: project
      ? {
          name: project.name,
          status: project.status,
          description: project.description || '',
          address: {
            street: project.address.street,
            zipCode: project.address.zipCode,
            city: project.address.city,
          },
          client: {
            name: project.client?.name || '',
            company: project.client?.company || '',
            phone: project.client?.phone || '',
            email: project.client?.email || '',
          },
          settings: { defaultHourlyRate: project.settings?.defaultHourlyRate ?? 45 },
          anzahlWohnungen: project.anzahlWohnungen ?? 0,
          anzahlGewerbe: project.anzahlGewerbe ?? 0,
          etagenOhneKeller: project.etagenOhneKeller ?? 0,
          kellerAnzahl: project.kellerAnzahl ?? 0,
          tiefgarage: project.tiefgarage ?? false,
          tiefgarageStellplaetze: project.tiefgarageStellplaetze ?? 0,
          aussenanlagenVorhanden: project.aussenanlagenVorhanden ?? false,
          phaseTimelines: {
            demolition:          phaseTimeline(project.phases, 'demolition'),
            renovation:          phaseTimeline(project.phases, 'renovation'),
            specialConstruction: phaseTimeline(project.phases, 'specialConstruction'),
          },
        }
      : undefined,
  });

  const tiefgarage = useWatch({ control, name: 'tiefgarage' });

  const toDate = (s: string) => s || undefined;

  const mutation = useMutation(
    (data: FormData) => updateProject(id!, {
      name: data.name,
      status: data.status as any,
      description: data.description,
      address: data.address,
      client: data.client,
      settings: { defaultHourlyRate: +data.settings.defaultHourlyRate },
      anzahlWohnungen: +data.anzahlWohnungen || 0,
      anzahlGewerbe: +data.anzahlGewerbe || 0,
      etagenOhneKeller: +data.etagenOhneKeller || 0,
      kellerAnzahl: +data.kellerAnzahl || 0,
      tiefgarage: !!data.tiefgarage,
      tiefgarageStellplaetze: data.tiefgarage ? (+data.tiefgarageStellplaetze || 0) : 0,
      aussenanlagenVorhanden: !!data.aussenanlagenVorhanden,
      phaseTimelines: {
        demolition:          { plannedStart: toDate(data.phaseTimelines.demolition.plannedStart),          plannedEnd: toDate(data.phaseTimelines.demolition.plannedEnd) },
        renovation:          { plannedStart: toDate(data.phaseTimelines.renovation.plannedStart),          plannedEnd: toDate(data.phaseTimelines.renovation.plannedEnd) },
        specialConstruction: { plannedStart: toDate(data.phaseTimelines.specialConstruction.plannedStart), plannedEnd: toDate(data.phaseTimelines.specialConstruction.plannedEnd) },
      },
    } as any),
    {
      onSuccess: () => {
        qc.invalidateQueries(['project', id]);
        qc.invalidateQueries('projects');
        navigate(`/projects/${id}`);
      },
    }
  );

  if (isLoading) return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="animate-pulse space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl" />)}
      </div>
    </div>
  );

  if (!project) return <div className="p-6 text-red-600">Projekt nicht gefunden</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="btn-secondary btn-sm">← Zurück</button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projekt bearbeiten</h1>
          <p className="text-sm text-gray-500 font-mono">{project.projectNumber}</p>
        </div>
      </div>

      {mutation.error != null && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
          {(mutation.error as any).response?.data?.message || 'Fehler beim Speichern'}
        </div>
      )}

      <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-6">

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Projektdaten</h2>
          <div>
            <label className="label">Projektname *</label>
            <input {...register('name', { required: 'Pflichtfeld' })} className="input" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Status</label>
            <select {...register('status')} className="input">
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Beschreibung</label>
            <textarea {...register('description')} className="input" rows={3} />
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Adresse</h2>
          <div>
            <label className="label">Straße und Hausnummer *</label>
            <input {...register('address.street', { required: 'Pflichtfeld' })} className="input" />
            {errors.address?.street && <p className="text-red-500 text-xs mt-1">{errors.address.street.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">PLZ *</label>
              <input {...register('address.zipCode', { required: 'Pflichtfeld' })} className="input" />
            </div>
            <div>
              <label className="label">Stadt *</label>
              <input {...register('address.city', { required: 'Pflichtfeld' })} className="input" />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Auftraggeber</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Name</label><input {...register('client.name')} className="input" /></div>
            <div><label className="label">Firma</label><input {...register('client.company')} className="input" /></div>
            <div><label className="label">Telefon</label><input {...register('client.phone')} className="input" /></div>
            <div><label className="label">E-Mail</label><input {...register('client.email')} type="email" className="input" /></div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Gebäudekennzahlen</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Anzahl Wohnungen</label>
              <input {...register('anzahlWohnungen', { valueAsNumber: true, min: 0 })} type="number" min={0} className="input" />
            </div>
            <div>
              <label className="label">Anzahl Gewerbe</label>
              <input {...register('anzahlGewerbe', { valueAsNumber: true, min: 0 })} type="number" min={0} className="input" />
            </div>
            <div>
              <label className="label">
                Etagen ohne Keller
                <span className="ml-1 text-gray-400 text-xs font-normal" title="Vollgeschosse oberirdisch">ⓘ</span>
              </label>
              <input {...register('etagenOhneKeller', { valueAsNumber: true, min: 0 })} type="number" min={0} className="input" />
            </div>
            <div>
              <label className="label">Keller</label>
              <input {...register('kellerAnzahl', { valueAsNumber: true, min: 0 })} type="number" min={0} className="input" />
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
                <input {...register('tiefgarageStellplaetze', { valueAsNumber: true, min: 0 })} type="number" min={0} className="input" />
              </div>
            )}
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input {...register('aussenanlagenVorhanden')} type="checkbox" className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span className="label mb-0">Außenanlagen vorhanden</span>
          </label>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Phasenzeitplan</h2>
          {([
            { key: 'demolition',          label: 'Entkernung' },
            { key: 'renovation',          label: 'Renovierung' },
            { key: 'specialConstruction', label: 'Sonderarbeiten' },
          ] as const).map(({ key, label }) => (
            <div key={key} className="pb-3 border-b border-gray-100 last:border-0 last:pb-0">
              <h3 className="text-sm font-medium text-gray-700 mb-2">{label}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Geplanter Start</label>
                  <input {...register(`phaseTimelines.${key}.plannedStart`)} type="date" className="input" />
                </div>
                <div>
                  <label className="label">Geplantes Ende</label>
                  <input {...register(`phaseTimelines.${key}.plannedEnd`)} type="date" className="input" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Einstellungen</h2>
          <div className="max-w-xs">
            <label className="label">Standard-Stundensatz (€/Std)</label>
            <input {...register('settings.defaultHourlyRate')} type="number" step="0.5" className="input" />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={mutation.isLoading} className="btn-primary">
            {mutation.isLoading ? 'Speichern…' : 'Änderungen speichern'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Abbrechen</button>
        </div>
      </form>
    </div>
  );
}
