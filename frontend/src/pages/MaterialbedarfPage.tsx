import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { getProject } from '../api/projects';

export default function MaterialbedarfPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project } = useQuery(['project', id], () => getProject(id!));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to={`/projects/${id}`} className="hover:text-primary-600">
          {project?.name ?? 'Projekt'}
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">Materialbedarf</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Materialbedarf</h1>
      </div>

      <div className="card">
        <p className="text-sm text-gray-400 italic">Dieser Bereich wird noch entwickelt.</p>
      </div>
    </div>
  );
}
