import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { getProject, getProjectSummary } from '../api/projects';

function eur(n: number) {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export default function AbrisskotenPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project } = useQuery(['project', id], () => getProject(id!));
  const { data: summary, isLoading } = useQuery(['summary', id], () => getProjectSummary(id!));

  const d = summary?.phases?.demolition;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/projects/${id}`} className="text-gray-400 hover:text-gray-600 text-sm">← Projekt</Link>
        <h1 className="text-xl font-bold text-gray-900">{project?.name} – Abrisskosten</h1>
      </div>

      {isLoading && <p className="text-gray-400">Lade Daten…</p>}

      {d && (
        <div className="card border-l-4 border-l-red-500">
          <h2 className="font-semibold text-gray-900 text-lg mb-4">Entkernung</h2>

          <div className="space-y-0 divide-y divide-gray-100 text-sm">
            <div className="flex justify-between py-2.5">
              <span className="text-gray-500">Materialkosten</span>
              <span className="font-medium">{eur(d.materialCost)}</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-gray-500">Entsorgungskosten</span>
              <span className="font-medium">{eur(d.disposalCost)}</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-gray-500">Arbeitskosten</span>
              <span className="font-medium">{eur(d.laborCost)}</span>
            </div>
            {d.containerCost > 0 && (
              <div className="flex justify-between py-2.5">
                <span className="text-gray-500">Container & Entsorgung</span>
                <span className="font-medium">{eur(d.containerCost)}</span>
              </div>
            )}
            {d.geruestCost > 0 && (
              <div className="flex justify-between py-2.5">
                <span className="text-gray-500">Gerüst</span>
                <span className="font-medium">{eur(d.geruestCost)}</span>
              </div>
            )}
            {d.kranCost > 0 && (
              <div className="flex justify-between py-2.5">
                <span className="text-gray-500">Kran</span>
                <span className="font-medium">{eur(d.kranCost)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center mt-4 pt-4 border-t-2 border-red-200 bg-red-50 -mx-5 px-5 -mb-5 pb-5 rounded-b-xl">
            <span className="font-bold text-base text-gray-900">Gesamtkosten Entkernung</span>
            <span className="font-bold text-xl text-red-700">{eur(d.subtotal)}</span>
          </div>
        </div>
      )}

      {d && (
        <p className="text-xs text-gray-400 mt-3 text-right">
          {d.positionCount} Position{d.positionCount !== 1 ? 'en' : ''} · {d.totalHours.toFixed(1)} Arbeitsstunden
        </p>
      )}

      {!isLoading && !d && (
        <div className="card text-center py-12 text-gray-400">
          <p>Noch keine Entkernungspositionen angelegt.</p>
          <Link to={`/projects/${id}/building?phase=demolition`} className="btn-primary mt-4 inline-block">
            Zur Gebäudestruktur
          </Link>
        </div>
      )}
    </div>
  );
}
