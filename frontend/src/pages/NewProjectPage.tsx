import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation } from 'react-query';
import { createProject } from '../api/projects';

interface PhaseTimeline { plannedStart: string; plannedEnd: string; }

interface FormData {
  name: string;
  address: { street: string; zipCode: string; city: string };
  client: { name: string; company: string; phone: string; email: string };
  description: string;
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

export default function NewProjectPage() {
  const navigate = useNavigate();
  const { register, handleSubmit, control, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      settings: { defaultHourlyRate: 45 },
      anzahlWohnungen: 0,
      anzahlGewerbe: 0,
      etagenOhneKeller: 0,
      kellerAnzahl: 0,
      tiefgarage: false,
      tiefgarageStellplaetze: 0,
      aussenanlagenVorhanden: false,
    },
  });

  const tiefgarage = useWatch({ control, name: 'tiefgarage' });

  const mutation = useMutation(createProject, {
    onSuccess: (project) => navigate(`/projects/${project._id}/building`),
  });

  const toDate = (s: string) => s || undefined;

  const onSubmit = (data: FormData) => {
    const body = {
      name: data.name,
      address: { street: data.address.street, zipCode: data.address.zipCode, city: data.address.city },
      client: { name: data.client.name, company: data.client.company, phone: data.client.phone, email: data.client.email },
      description: data.description,
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
    };
    mutation.mutate(body as any);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="btn-secondary btn-sm">← Zurück</button>
        <h1 className="text-2xl font-bold text-gray-900">Neues Projekt anlegen</h1>
      </div>

      {mutation.error != null && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
          {(mutation.error as any).response?.data?.message || 'Fehler beim Anlegen'}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Projektdaten</h2>
          <div>
            <label className="label">Projektname *</label>
            <input {...register('name', { required: 'Pflichtfeld' })} className="input" placeholder="z.B. Mehrfamilienhaus Kyffhäuserstraße 53" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Beschreibung</label>
            <textarea {...register('description')} className="input" rows={3} placeholder="Kurzbeschreibung des Projekts..." />
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Adresse</h2>
          <div>
            <label className="label">Straße und Hausnummer *</label>
            <input {...register('address.street', { required: 'Pflichtfeld' })} className="input" placeholder="Kyffhäuserstraße 53" />
            {errors.address?.street && <p className="text-red-500 text-xs mt-1">{errors.address.street.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">PLZ *</label>
              <input {...register('address.zipCode', { required: 'Pflichtfeld' })} className="input" placeholder="50637" />
            </div>
            <div>
              <label className="label">Stadt *</label>
              <input {...register('address.city', { required: 'Pflichtfeld' })} className="input" placeholder="Köln" />
            </div>
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Auftraggeber</h2>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Name</label><input {...register('client.name')} className="input" placeholder="Max Mustermann" /></div>
            <div><label className="label">Firma</label><input {...register('client.company')} className="input" placeholder="Mustermann GmbH" /></div>
            <div><label className="label">Telefon</label><input {...register('client.phone')} className="input" placeholder="+49 221 ..." /></div>
            <div><label className="label">E-Mail</label><input {...register('client.email')} type="email" className="input" placeholder="kontakt@firma.de" /></div>
          </div>
        </div>

        {/* Gebäudekennzahlen */}
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

          {/* Tiefgarage */}
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

          {/* Außenanlagen */}
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
            {mutation.isLoading ? 'Wird angelegt...' : 'Projekt anlegen'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Abbrechen</button>
        </div>
      </form>
    </div>
  );
}
