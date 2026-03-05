import { useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getProject } from '../api/projects';
import { getPositions, bulkCreatePositions } from '../api/projects';
import type { AppPhaseType, GaebExportConfig, GaebDataPhase, GaebParseResult,
  ImportedPosition, GaebValidationError } from '../utils/gaeb';
import {
  buildGaebXml, parseGaebXml, validateGaebLv, gaebToAppPositions,
  downloadGaebXml, detectFormat, xmlPreview, phaseLabel,
  GAEB_DATA_PHASES,
} from '../utils/gaeb';

// ─── Hilfkomponenten ──────────────────────────────────────────────────────────

function Badge({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const cls: Record<string, string> = {
    gray:   'bg-gray-100 text-gray-600',
    red:    'bg-red-100 text-red-700',
    yellow: 'bg-yellow-100 text-yellow-700',
    green:  'bg-green-100 text-green-700',
    blue:   'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${cls[color] || cls.gray}`}>
      {children}
    </span>
  );
}

function SectionCard({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-5 h-5 text-primary-600 shrink-0">{icon}</div>
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ValidationList({ items, title, color }: {
  items: GaebValidationError[]; title: string; color: 'red' | 'yellow';
}) {
  if (!items.length) return null;
  const bg  = color === 'red' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200';
  const txt = color === 'red' ? 'text-red-800' : 'text-yellow-800';
  const dot = color === 'red' ? 'bg-red-400' : 'bg-yellow-400';
  return (
    <div className={`rounded-xl border ${bg} px-4 py-3 mb-3`}>
      <p className={`text-xs font-bold uppercase tracking-wide ${txt} mb-2`}>
        {title} ({items.length})
      </p>
      <ul className="space-y-1">
        {items.map((e, i) => (
          <li key={i} className="flex items-start gap-2 text-xs">
            <div className={`w-1.5 h-1.5 rounded-full ${dot} mt-1.5 shrink-0`} />
            <div>
              <span className="font-mono text-gray-500 mr-1">{e.path}</span>
              {e.tag && <span className="font-mono text-primary-600">&lt;{e.tag}&gt; </span>}
              <span className={txt}>{e.message}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function XmlPreviewBlock({ xml }: { xml: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = xmlPreview(xml, expanded ? 200 : 40);
  return (
    <div>
      <pre className="bg-gray-900 text-green-300 text-[11px] rounded-xl p-4 overflow-x-auto max-h-72 overflow-y-auto font-mono leading-relaxed">
        {preview}
      </pre>
      {xml.split('\n').length > 40 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-primary-600 hover:text-primary-800 mt-1"
        >
          {expanded ? '▲ Weniger anzeigen' : '▼ Mehr anzeigen'}
        </button>
      )}
    </div>
  );
}

const PHASE_OPTIONS: { value: AppPhaseType; label: string }[] = [
  { value: 'demolition',          label: 'Entkernung' },
  { value: 'renovation',          label: 'Renovierung' },
  { value: 'specialConstruction', label: 'Sonderarbeiten' },
];

// ─── Export-Abschnitt ─────────────────────────────────────────────────────────

function ExportSection({ projectId }: { projectId: string }) {
  const { data: project } = useQuery(['project', projectId], () => getProject(projectId));
  const { data: positions = [] } = useQuery(
    ['positions-all', projectId],
    () => getPositions(projectId),
  );

  const [config, setConfig] = useState<GaebExportConfig>({
    dataPhase:        'X31',
    includePrices:    true,
    includeLongTexts: true,
    includeDisposal:  false,
  });
  const [previewXml, setPreviewXml]   = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const handlePreview = () => {
    if (!project) return;
    const xml = buildGaebXml(project, positions, config);
    setPreviewXml(xml);
  };

  const handleDownload = () => {
    if (!project) return;
    const xml = previewXml || buildGaebXml(project, positions, config);
    const fn  = downloadGaebXml(xml, project.projectNumber);
    setExportSuccess(fn);
    setTimeout(() => setExportSuccess(null), 5000);
  };

  const set = <K extends keyof GaebExportConfig>(k: K) => (v: GaebExportConfig[K]) =>
    setConfig(prev => ({ ...prev, [k]: v }));

  const phaseCount  = Array.from(new Set(positions.map(p => p.phaseType))).length;
  const posCount    = positions.length;

  return (
    <SectionCard
      title="GAEB Exportieren"
      icon={
        <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      }
    >
      {/* Status */}
      <div className="flex items-center gap-3 mb-4 bg-gray-50 rounded-xl px-4 py-2.5 text-sm">
        <span className="text-gray-500">{posCount} Positionen</span>
        <span className="text-gray-300">|</span>
        <span className="text-gray-500">{phaseCount} Phasen</span>
        <span className="text-gray-300">|</span>
        <span className="font-mono text-xs text-gray-400">{project?.projectNumber}</span>
      </div>

      {/* Konfiguration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">

        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Datenaustauschphase</label>
          <select
            value={config.dataPhase}
            onChange={e => set('dataPhase')(e.target.value as GaebDataPhase)}
            className="input text-sm w-full"
          >
            {Object.entries(GAEB_DATA_PHASES).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2 mt-5">
          {([
            ['includePrices',    'Einheitspreise (UP/GP) exportieren'],
            ['includeLongTexts', 'Langtexte exportieren'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={config[key]}
                onChange={e => set(key)(e.target.checked)}
                className="w-4 h-4 rounded text-primary-600"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Struktur-Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 mb-4">
        <p className="text-xs text-blue-700 font-semibold mb-1">Exportstruktur (GAEB DA XML 3.2):</p>
        <p className="text-xs text-blue-600">
          Phase → <code className="font-mono">Bo</code> (Leistungsbereich) ·&nbsp;
          Bereich → <code className="font-mono">LG</code> (Leistungsgruppe/Titel) ·&nbsp;
          Unterpunkt → <code className="font-mono">ULG</code> (Untertitel) ·&nbsp;
          Position → <code className="font-mono">Pos</code>
        </p>
      </div>

      {/* Aktionen */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={handlePreview} disabled={!project || posCount === 0}
          className="btn btn-secondary btn-sm">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          XML vorschauen
        </button>
        <button onClick={handleDownload} disabled={!project || posCount === 0}
          className="btn btn-primary btn-sm">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          GAEB XML herunterladen
        </button>
      </div>

      {posCount === 0 && (
        <p className="text-sm text-gray-400 text-center py-2">
          Noch keine Positionen im Projekt – bitte zuerst Positionen anlegen.
        </p>
      )}

      {exportSuccess && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-3">
          <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-green-800">Export erfolgreich</p>
            <p className="text-xs text-green-600 font-mono">{exportSuccess}</p>
          </div>
        </div>
      )}

      {previewXml && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-gray-600 mb-2">XML-Vorschau:</p>
          <XmlPreviewBlock xml={previewXml} />
        </div>
      )}
    </SectionCard>
  );
}

// ─── Import-Abschnitt ─────────────────────────────────────────────────────────

function ImportSection({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const fileRef     = useRef<HTMLInputElement>(null);

  const [parseResult,    setParseResult]    = useState<GaebParseResult | null>(null);
  const [importedList,   setImportedList]   = useState<ImportedPosition[]>([]);
  const [defaultPhase,   setDefaultPhase]   = useState<AppPhaseType>('renovation');
  const [includePrices,  setIncludePrices]  = useState(false);
  const [isDragging,     setIsDragging]     = useState(false);
  const [importSuccess,  setImportSuccess]  = useState<{ count: number } | null>(null);
  const [importError,    setImportError]    = useState<string | null>(null);

  const bulkMutation = useMutation(
    (positions: object[]) => bulkCreatePositions(projectId, positions),
    {
      onSuccess: (data) => {
        setImportSuccess({ count: data.count });
        queryClient.invalidateQueries(['positions-all', projectId]);
        queryClient.invalidateQueries(['summary', projectId]);
      },
      onError: (err: any) => {
        setImportError(err?.response?.data?.message || 'Import fehlgeschlagen');
      },
    },
  );

  const processFile = (file: File) => {
    if (!file) return;
    setImportSuccess(null);
    setImportError(null);
    const reader = new FileReader();
    reader.onload = e => {
      const content = e.target?.result as string;
      const result  = parseGaebXml(content);
      setParseResult(result);
      if (result.lv) {
        const positions = gaebToAppPositions(result.lv.allPositions, defaultPhase, includePrices);
        setImportedList(positions);
      } else {
        setImportedList([]);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) processFile(f);
  }, [defaultPhase, includePrices]);

  const handleImport = () => {
    if (!importedList.length) return;
    const payload = importedList.map(p => ({
      name:                p.name,
      phaseType:           p.phaseType,
      bereich:             p.bereich   || null,
      bereichUnterpunkt:   p.bereichUnterpunkt || null,
      unit:                p.unit,
      quantity:            p.quantity,
      materialCostPerUnit: p.materialCostPerUnit,
      disposalCostPerUnit: p.disposalCostPerUnit,
      laborHoursPerUnit:   p.laborHoursPerUnit,
      laborHourlyRate:     p.laborHourlyRate,
      description:         p.description || undefined,
      category:            p.category,
      status:              'planned',
    }));
    bulkMutation.mutate(payload);
  };

  // Einzel-Phase eines importierten Items ändern
  const changePhase = (idx: number, phase: AppPhaseType) => {
    setImportedList(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], phaseType: phase };
      return next;
    });
  };

  const hasErrors   = (parseResult?.errors  ?? []).length > 0;
  const hasWarnings = (parseResult?.warnings ?? []).length > 0;
  const canImport   = parseResult?.lv && importedList.length > 0 && !bulkMutation.isLoading;

  return (
    <SectionCard
      title="GAEB Importieren"
      icon={
        <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
            transform="rotate(180 12 12)" />
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 7.5v-2.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25V7.5M7.5 12L12 7.5m0 0L16.5 12M12 7.5V21" />
        </svg>
      }
    >
      {/* Format-Info */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {[
          ['GAEB DA XML 3.2', 'green', 'Vollständig'],
          ['GAEB 2000',       'blue',  'Kompatibel'],
          ['GAEB 90 D81-D83', 'yellow','Konvertierung nötig'],
        ].map(([fmt, color, status]) => (
          <div key={fmt}
            className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
            <div className={`w-2 h-2 rounded-full bg-${color}-400`} />
            <span className="text-xs font-medium text-gray-700">{fmt}</span>
            <Badge color={color as any}>{status}</Badge>
          </div>
        ))}
      </div>

      {/* Import-Optionen */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Standard-Phase</label>
          <select
            value={defaultPhase}
            onChange={e => setDefaultPhase(e.target.value as AppPhaseType)}
            className="input text-sm w-full"
          >
            {PHASE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Fallback wenn Phase aus Bo-Name nicht erkennbar
          </p>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={includePrices}
              onChange={e => setIncludePrices(e.target.checked)}
              className="w-4 h-4 rounded text-primary-600" />
            Preise (UP) importieren
          </label>
        </div>
      </div>

      {/* Datei-Drop-Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl cursor-pointer text-center px-6 py-8 mb-4 transition-colors ${
          isDragging ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <input ref={fileRef} type="file" accept=".xml,.gaeb,.XML,.GAEB,.d81,.d82,.d83,.D81,.D82,.D83"
          onChange={handleFileChange} className="hidden" />
        <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor"
          strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-sm text-gray-500">
          GAEB-Datei hierher ziehen oder <span className="text-primary-600 font-medium">auswählen</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">*.xml · *.gaeb · *.XML · *.D81–D83</p>
      </div>

      {/* Validierung */}
      {parseResult && (
        <>
          {/* Format-Badge */}
          <div className="flex items-center gap-3 mb-3">
            <Badge color={parseResult.lv ? 'green' : 'red'}>
              {parseResult.lv
                ? `${parseResult.lv.format.replace('gaeb_', 'GAEB ').replace('_', ' ').toUpperCase()} – ${parseResult.lv.dataPhase}`
                : 'Parse-Fehler'}
            </Badge>
            {parseResult.lv && (
              <>
                <span className="text-xs text-gray-500">
                  {parseResult.lv.projectName || '(kein Name)'}
                </span>
                <span className="text-xs text-gray-400 font-mono">
                  {parseResult.lv.projectNumber}
                </span>
                <span className="text-xs text-gray-500">
                  {parseResult.lv.allPositions.length} Positionen
                </span>
              </>
            )}
          </div>

          <ValidationList items={parseResult.errors}   title="Fehler"   color="red" />
          <ValidationList items={parseResult.warnings} title="Warnungen" color="yellow" />
        </>
      )}

      {/* Import-Vorschau-Tabelle */}
      {importedList.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-600 mb-2">
            Zu importierende Positionen ({importedList.length}):
          </p>
          <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-3 py-2 font-semibold text-gray-500">OZ</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-500">Bezeichnung</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-500">Einheit</th>
                  <th className="text-right px-3 py-2 font-semibold text-gray-500">Menge</th>
                  {includePrices && (
                    <th className="text-right px-3 py-2 font-semibold text-gray-500">EP</th>
                  )}
                  <th className="text-left px-3 py-2 font-semibold text-gray-500">Bereich</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-500">Phase</th>
                </tr>
              </thead>
              <tbody>
                {importedList.map((pos, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-gray-400">{pos.gaebPosNum}</td>
                    <td className="px-3 py-2 text-gray-800 max-w-[220px]">
                      <span className="font-medium">{pos.name}</span>
                      {pos.gaebBoName && (
                        <span className="block text-[10px] text-gray-400">{pos.gaebBoName} › {pos.gaebLgName}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{pos.unit}</td>
                    <td className="px-3 py-2 text-right font-mono">{pos.quantity.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</td>
                    {includePrices && (
                      <td className="px-3 py-2 text-right font-mono">
                        {pos.materialCostPerUnit.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </td>
                    )}
                    <td className="px-3 py-2 text-gray-500 max-w-[140px] truncate" title={pos.bereichUnterpunkt || pos.bereich}>
                      {pos.bereich || '–'}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={pos.phaseType}
                        onChange={e => changePhase(i, e.target.value as AppPhaseType)}
                        className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white text-gray-700"
                      >
                        {PHASE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Warnung: keine Überschreibung */}
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
            <strong>Hinweis:</strong> Der Import erstellt nur neue Positionen – bestehende Positionen
            werden nicht verändert oder überschrieben.
          </div>
        </div>
      )}

      {/* Import-Aktionen */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleImport}
          disabled={!canImport}
          className="btn btn-primary btn-sm disabled:opacity-40"
        >
          {bulkMutation.isLoading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Importiere…
            </>
          ) : (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 7.5V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25V7.5M7.5 12L12 7.5m0 0L16.5 12M12 7.5V21" />
              </svg>
              {importedList.length} Positionen importieren
            </>
          )}
        </button>
        {hasErrors && !parseResult?.lv && (
          <span className="text-sm text-red-600 font-medium">
            ⚠ Import nicht möglich – Fehler beheben.
          </span>
        )}
      </div>

      {/* Ergebnis */}
      {importSuccess && (
        <div className="mt-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-green-800">Import erfolgreich</p>
            <p className="text-xs text-green-600">
              {importSuccess.count} Positionen wurden in die Kostenkalkulation übernommen.
            </p>
          </div>
        </div>
      )}
      {importError && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {importError}
        </div>
      )}
    </SectionCard>
  );
}

// ─── Format-Info-Karte ────────────────────────────────────────────────────────

function FormatInfoCard() {
  const formats = [
    {
      name: 'GAEB DA XML 3.2',
      badge: 'green',
      dp: ['X30', 'X31', 'X34'],
      desc: 'Aktueller Standard. Import + Export vollständig unterstützt.',
      ns: 'http://www.gaeb.de/GAEB_DA_XML/200407',
    },
    {
      name: 'GAEB 2000',
      badge: 'blue',
      dp: ['D83', 'D84'],
      desc: 'Älterer XML-Standard. Wird wie GAEB DA XML 3.2 verarbeitet.',
      ns: 'http://www.gaeb.de/GAEB_DA_XML/',
    },
    {
      name: 'GAEB 90 (D81–D83)',
      badge: 'yellow',
      dp: ['D81', 'D82', 'D83'],
      desc: 'Text-basiertes Festformat. Vor dem Import in GAEB DA XML 3.2 konvertieren.',
      ns: 'Text-Format (kein XML)',
    },
  ];

  return (
    <div className="card border border-gray-100">
      <h3 className="font-semibold text-gray-900 mb-3 text-sm">Unterstützte Formate</h3>
      <div className="space-y-3">
        {formats.map(f => (
          <div key={f.name} className="flex items-start gap-3">
            <Badge color={f.badge as any}>{f.name}</Badge>
            <div className="min-w-0">
              <p className="text-xs text-gray-700">{f.desc}</p>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">{f.ns}</p>
              <div className="flex gap-1 mt-1">
                {f.dp.map(d => (
                  <span key={d}
                    className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">{d}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

export default function GaebPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { data: project } = useQuery(['project', projectId], () => getProject(projectId!));

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">

      {/* Breadcrumb + Titel */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to={`/projects/${projectId}/summary`}
          className="text-gray-400 hover:text-gray-600 text-sm">
          ← Kostenkalkulation
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">GAEB-Schnittstelle</h1>
        <span className="text-gray-400 text-sm hidden sm:inline">{project?.name}</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
            GAEB DA XML 3.2
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Export + Import (2/3 Breite) */}
        <div className="xl:col-span-2 space-y-6">
          {projectId && <ExportSection projectId={projectId} />}
          {projectId && <ImportSection projectId={projectId} />}
        </div>

        {/* Infos (1/3 Breite) */}
        <div className="space-y-4">
          <FormatInfoCard />

          {/* Struktur-Mapping */}
          <div className="card border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Struktur-Mapping</h3>
            <div className="space-y-2 text-xs">
              {[
                ['App-Phase', 'GAEB Bo (Leistungsbereich)', 'demolition → Entkernung'],
                ['App-Bereich', 'GAEB LG (Leistungsgruppe)', 'I. Innenausbau → LG 0001'],
                ['App-Unterpunkt', 'GAEB ULG (Untertitel)', '3. Boden > a) Belag → ULG 0001'],
                ['Position', 'GAEB Pos', 'name → ShortText, desc → CompleteText'],
                ['Einheit', 'QtyUnit', 'm² → m2, Stück → St, Psch → pau'],
                ['Menge', 'Qty', '3 Dezimalstellen'],
                ['Preis/EP', 'UP + GP', 'materialCost + labor + disposal'],
              ].map(([app, gaeb, ex]) => (
                <div key={app} className="border-b border-gray-100 pb-1.5">
                  <div className="flex justify-between">
                    <span className="font-semibold text-primary-700">{app}</span>
                    <span className="text-gray-400 font-mono">{gaeb}</span>
                  </div>
                  <span className="text-gray-400">{ex}</span>
                </div>
              ))}
            </div>
          </div>

          {/* GAEB-Norm Einheiten */}
          <div className="card border border-gray-100">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm">Einheiten-Tabelle</h3>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left pb-1">App</th>
                  <th className="text-left pb-1">GAEB</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['m²',   'm2'],  ['m³', 'm3'],
                  ['lfm',  'm'],   ['Stück', 'St'],
                  ['Sack', 'Sck'], ['kg', 'kg'],
                  ['Psch', 'pau'], ['t', 't'],
                ].map(([app, gaeb]) => (
                  <tr key={app} className="border-t border-gray-100">
                    <td className="py-1 text-gray-700 font-mono">{app}</td>
                    <td className="py-1 text-primary-600 font-mono">{gaeb}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
