import { useParams, Link, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from 'react-query';
import { getProject } from '../api/projects';

export default function ProjectLayout() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { data: project } = useQuery(['project', id], () => getProject(id!), { staleTime: 30000 });

  const base = `/projects/${id}`;

  const tabs: { label: string; to: string; match: (p: string) => boolean }[] = [
    {
      label: 'Übersicht',
      to: base,
      match: (p) => p === base || p === `${base}/edit`,
    },
    {
      label: 'Gebäude & Räume',
      to: `${base}/building?phase=renovation`,
      match: (p) => p.startsWith(`${base}/building`) || p.startsWith(`${base}/rooms`),
    },
    {
      label: 'Abrisskosten',
      to: `${base}/abrisskosten`,
      match: (p) => p.startsWith(`${base}/abrisskosten`),
    },
    {
      label: 'Baukosten',
      to: `${base}/baukosten`,
      match: (p) => p.startsWith(`${base}/baukosten`),
    },
    {
      label: 'Baunebenkosten',
      to: `${base}/module/baunebenkosten`,
      match: (p) => p === `${base}/module/baunebenkosten`,
    },
    {
      label: 'Planungskosten',
      to: `${base}/module/planungskosten`,
      match: (p) => p === `${base}/module/planungskosten`,
    },
    {
      label: 'Ausstattung',
      to: `${base}/module/ausstellung`,
      match: (p) => p === `${base}/module/ausstellung`,
    },
    {
      label: 'Vertrieb',
      to: `${base}/vertrieb-material`,
      match: (p) => p.startsWith(`${base}/vertrieb-material`),
    },
    {
      label: 'Materialbedarf',
      to: `${base}/materialbedarf`,
      match: (p) => p.startsWith(`${base}/materialbedarf`),
    },
    {
      label: 'Kostenkalkulation',
      to: `${base}/summary`,
      match: (p) => p.startsWith(`${base}/summary`),
    },
    {
      label: 'Finanzierung',
      to: `${base}/finance`,
      match: (p) => p.startsWith(`${base}/finance`),
    },
    {
      label: 'Zeitplan',
      to: `${base}/timeline`,
      match: (p) => p.startsWith(`${base}/timeline`),
    },
    {
      label: 'Container',
      to: `${base}/containers`,
      match: (p) => p.startsWith(`${base}/containers`),
    },
    {
      label: 'Gerüst',
      to: `${base}/geruest`,
      match: (p) => p.startsWith(`${base}/geruest`),
    },
    {
      label: 'Kran',
      to: `${base}/kran`,
      match: (p) => p.startsWith(`${base}/kran`),
    },
  ];

  const path = location.pathname;

  return (
    <div className="min-h-full bg-slate-50">
      {/* ── Sticky project navigation bar ─────────────────── */}
      <div
        className="sticky top-0 z-20 bg-white"
        style={{ borderBottom: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        <div className="px-4 sm:px-6">
          {/* Breadcrumb / project name */}
          <div className="flex items-center gap-1.5 pt-2 pb-1">
            <Link
              to="/"
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            >
              Dashboard
            </Link>
            <svg className="w-3 h-3 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <Link
              to={base}
              className="text-[13px] font-semibold text-gray-800 truncate hover:text-blue-600 transition-colors"
            >
              {project?.name ?? '…'}
            </Link>
          </div>

          {/* Tab strip */}
          <div
            className="flex overflow-x-auto -mb-px"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          >
            {tabs.map((tab) => {
              const active = tab.match(path);
              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  className={`shrink-0 px-3 py-2 text-[12.5px] font-medium border-b-2 whitespace-nowrap transition-colors ${
                    active
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Page content ──────────────────────────────────── */}
      <Outlet />
    </div>
  );
}
