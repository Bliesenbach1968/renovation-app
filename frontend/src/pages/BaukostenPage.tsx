import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { getProject, getProjectSummary } from '../api/projects';

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function PhaseSection({
  title, color, borderColor, bgColor, data,
}: {
  title: string;
  color: string;
  borderColor: string;
  bgColor: string;
  data: any;
}) {
  return (
    <div className={`card border-l-4 ${borderColor}`}>
      <h2 className="font-semibold text-gray-900 text-lg mb-4">{title}</h2>
      <div className="space-y-0 divide-y divide-gray-100 text-sm">
        <div className="flex justify-between py-2.5">
          <span className="text-gray-500">Materialkosten</span>
          <span className="font-medium">{eur(data.materialCost)}</span>
        </div>
        <div className="flex justify-between py-2.5">
          <span className="text-gray-500">Entsorgungskosten</span>
          <span className="font-medium">{eur(data.disposalCost)}</span>
        </div>
        <div className="flex justify-between py-2.5">
          <span className="text-gray-500">Arbeitskosten</span>
          <span className="font-medium">{eur(data.laborCost)}</span>
        </div>
        {data.containerCost > 0 && (
          <div className="flex justify-between py-2.5">
            <span className="text-gray-500">Container & Entsorgung</span>
            <span className="font-medium">{eur(data.containerCost)}</span>
          </div>
        )}
        {data.geruestCost > 0 && (
          <div className="flex justify-between py-2.5">
            <span className="text-gray-500">Gerüst</span>
            <span className="font-medium">{eur(data.geruestCost)}</span>
          </div>
        )}
        {data.kranCost > 0 && (
          <div className="flex justify-between py-2.5">
            <span className="text-gray-500">Kran</span>
            <span className="font-medium">{eur(data.kranCost)}</span>
          </div>
        )}
      </div>
      <div className={`flex justify-between items-center mt-4 pt-4 border-t-2 ${borderColor} ${bgColor} -mx-5 px-5 -mb-5 pb-5 rounded-b-xl`}>
        <span className="font-bold text-base text-gray-900">Gesamtkosten {title}</span>
        <span className={`font-bold text-xl ${color}`}>{eur(data.subtotal)}</span>
      </div>
    </div>
  );
}

export default function BaukostenPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project } = useQuery(['project', id], () => getProject(id!));
  const { data: summary, isLoading } = useQuery(['summary', id], () => getProjectSummary(id!));

  const renovation = summary?.phases?.renovation;
  const specialConstruction = summary?.phases?.specialConstruction;
  const hasData = renovation || specialConstruction;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/projects/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Projekt</Link>
        <h1 className="text-xl font-bold text-gray-900">{project?.name} – Baukosten</h1>
      </div>

      {isLoading && <p className="text-gray-400">Lade Daten…</p>}

      <div className="space-y-4">
        {renovation && (
          <>
            <PhaseSection
              title="Renovierung"
              color="text-blue-700"
              borderColor="border-l-blue-500"
              bgColor="bg-blue-50"
              data={renovation}
            />
            <p className="text-xs text-gray-400 text-right">
              {renovation.positionCount} Position{renovation.positionCount !== 1 ? 'en' : ''} · {renovation.totalHours.toFixed(1)} Arbeitsstunden
            </p>
          </>
        )}

        {specialConstruction && (
          <>
            <PhaseSection
              title="Sonderarbeiten"
              color="text-green-700"
              borderColor="border-l-green-500"
              bgColor="bg-green-50"
              data={specialConstruction}
            />
            <p className="text-xs text-gray-400 text-right">
              {specialConstruction.positionCount} Position{specialConstruction.positionCount !== 1 ? 'en' : ''} · {specialConstruction.totalHours.toFixed(1)} Arbeitsstunden
            </p>
          </>
        )}

        {!isLoading && !hasData && (
          <div className="card text-center py-12 text-gray-400">
            <p>Noch keine Renovierungs- oder Sonderarbeitspositionen angelegt.</p>
            <Link to={`/projects/${id}/building?phase=renovation`} className="btn-primary mt-4 inline-block">
              Zur Gebäudestruktur
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
