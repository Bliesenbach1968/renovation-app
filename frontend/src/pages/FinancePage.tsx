/**
 * FinancePage
 * ───────────
 * Projektfinanzierungs-Seite: Konfiguration + Ergebnisanzeige.
 * Route: /projects/:id/finance
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from 'react-query';
import { getProject } from '../api/projects';
import { getFinanceParams, saveFinanceParams } from '../api/finance';
import type { FinanceParamsDto, FinanceCalculationResult } from '../api/finance';
import FinanceConfigurator from '../components/FinanceConfigurator';
import FinanceResults       from '../components/FinanceResults';

export default function FinancePage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [result, setResult] = useState<FinanceCalculationResult | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);

  // Projektname für Breadcrumb
  const { data: project } = useQuery(
    ['project', projectId],
    () => getProject(projectId!),
    { enabled: !!projectId }
  );

  // Gespeicherte Parameter laden (404 = noch keine vorhanden → egal)
  const { data: savedParams, isLoading: paramsLoading } = useQuery(
    ['financeParams', projectId],
    () => getFinanceParams(projectId!),
    {
      enabled:      !!projectId,
      retry:        false,
      onError:      () => {/* 404 expected if first visit */},
    }
  );

  // Berechnen + Speichern-Mutation
  const calcMutation = useMutation(
    (params: Partial<FinanceParamsDto>) => saveFinanceParams(projectId!, params),
    {
      onSuccess: (data) => {
        setResult(data);
        setCalcError(null);
      },
      onError: (err: any) => {
        setCalcError(err?.response?.data?.message || err?.message || 'Berechnungsfehler');
        setResult(null);
      },
    }
  );

  // Automatisch berechnen wenn gespeicherte Parameter vorhanden
  useEffect(() => {
    if (savedParams && !result) {
      calcMutation.mutate(savedParams);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedParams]);

  const handleSubmit = (params: Partial<FinanceParamsDto>) => {
    calcMutation.mutate(params);
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">

      {/* ── Breadcrumb ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Link to="/" className="hover:text-gray-700">Dashboard</Link>
        <span>›</span>
        {project && (
          <>
            <Link to={`/projects/${projectId}`} className="hover:text-gray-700">
              {project.name}
            </Link>
            <span>›</span>
          </>
        )}
        <span className="text-gray-800 font-medium">Finanzierung</span>
      </div>

      {/* ── Seitentitel ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(145deg, #147CE5, #0071E3)', boxShadow: '0 2px 8px rgba(0,113,227,.35)' }}>
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Projektfinanzierung</h1>
          {project && <p className="text-sm text-gray-500">{project.name}</p>}
        </div>
      </div>

      {/* ── Haupt-Layout: Konfigurator links, Ergebnisse rechts ────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6 items-start">

        {/* Konfigurator */}
        <div className="xl:sticky xl:top-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Parameter
            </h2>

            {paramsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <FinanceConfigurator
                initial={savedParams}
                onSubmit={handleSubmit}
                isLoading={calcMutation.isLoading}
              />
            )}
          </div>

          {/* Hinweis auf Kostenkalkulation */}
          <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
            <span className="font-semibold">Projektkosten:</span> Werden automatisch aus der{' '}
            <Link to={`/projects/${projectId}/summary`} className="underline hover:text-blue-900">
              Kostenkalkulation
            </Link>{' '}
            über die Phasen-Zeitpläne abgeleitet und monatlich verteilt.
          </div>
        </div>

        {/* Ergebnisse */}
        <div>
          {calcError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
              <span className="font-semibold">Fehler: </span>{calcError}
            </div>
          )}

          {calcMutation.isLoading && (
            <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-gray-200">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Berechne Zinsplan…</p>
              </div>
            </div>
          )}

          {!calcMutation.isLoading && result && (
            <FinanceResults summary={result.summary} schedule={result.schedule} />
          )}

          {!calcMutation.isLoading && !result && !calcError && (
            <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-gray-200 border-dashed">
              <div className="text-center max-w-xs">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" strokeWidth={1.3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
                <p className="text-sm font-medium text-gray-500">Parameter eingeben und</p>
                <p className="text-sm text-gray-400">„Neu berechnen" klicken</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
