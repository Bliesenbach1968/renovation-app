import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { getProject, getProjectSummary } from '../api/projects';
import {
  type DatevConfig,
  type DatevKonten,
  type Buchungssatz,
  type Kontenrahmen,
  type UstSatz,
  getDefaultKonten,
  buildBuchungsstaepel,
  validateConfig,
  downloadDatevCsv,
  eur,
  isoToday,
  currentYear,
} from '../utils/datev';

// ─── Hilfkomponenten ──────────────────────────────────────────────────────────

function Field({
  label, hint, error, children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
      {hint && !error && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
      {error && <p className="text-[11px] text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

function Input({
  value, onChange, placeholder, type = 'text', maxLength, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      className="input text-sm w-full disabled:bg-gray-50 disabled:text-gray-400"
    />
  );
}

function Select({
  value, onChange, children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="input text-sm w-full"
    >
      {children}
    </select>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-5 h-5 text-primary-600">{icon}</div>
      <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
    </div>
  );
}

// ─── Konten-Editor ────────────────────────────────────────────────────────────

function KontenEditor({
  konten, onChange, errors,
}: {
  konten: DatevKonten;
  onChange: (k: DatevKonten) => void;
  errors: Record<string, string>;
}) {
  const set = (key: keyof DatevKonten) => (v: string) =>
    onChange({ ...konten, [key]: v });

  const rows: Array<[keyof DatevKonten, string, string]> = [
    ['material',         'Materialaufwand',          '3000 / 5000'],
    ['lohn',             'Lohnaufwand',               '4100 / 6100'],
    ['fremdleistung',    'Fremdleistungen',           '3100 / 5300'],
    ['entsorgung',       'Entsorgung',                '3100 / 5300'],
    ['erloes',           'Erlöse (Ausgangsrechn.)',   '8400 / 4400'],
    ['debitor',          'Debitorenkonto',            '10000'],
    ['kreditorMaterial', 'Kreditor Material',         '70000'],
    ['kreditorFremd',    'Kreditor Fremd/Entsorgung', '70001'],
    ['gegenkontLohn',    'Gegenkonto Lohn',           '3720'],
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {rows.map(([key, label, hint]) => (
        <Field
          key={key}
          label={label}
          hint={`SKR03/04: ${hint}`}
          error={errors[`konten.${key}`]}
        >
          <Input value={konten[key]} onChange={set(key)} placeholder={hint.split('/')[0].trim()} maxLength={9} />
        </Field>
      ))}
    </div>
  );
}

// ─── Vorschau-Tabelle ─────────────────────────────────────────────────────────

const SH_LABEL: Record<string, string> = { S: 'Soll', H: 'Haben' };

function VorschauTabelle({ buchungsstaepel }: { buchungsstaepel: Buchungssatz[] }) {
  if (!buchungsstaepel.length)
    return (
      <div className="text-sm text-gray-400 text-center py-8">
        Keine Buchungssätze – Projekt hat ggf. noch keine Positionen.
      </div>
    );

  const gesamt = buchungsstaepel.reduce((s, b) => s + b.betrag, 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="text-left py-2 pr-3 font-semibold">#</th>
            <th className="text-left py-2 pr-3 font-semibold">Kostenart</th>
            <th className="text-left py-2 pr-3 font-semibold">Phase</th>
            <th className="text-right py-2 pr-3 font-semibold">Betrag</th>
            <th className="text-center py-2 pr-3 font-semibold">S/H</th>
            <th className="text-left py-2 pr-3 font-semibold">Konto</th>
            <th className="text-left py-2 pr-3 font-semibold">Gegenkonto</th>
            <th className="text-center py-2 pr-3 font-semibold">BU</th>
            <th className="text-left py-2 pr-3 font-semibold">Datum</th>
            <th className="text-left py-2 pr-3 font-semibold">Belegnr.</th>
            <th className="text-left py-2 font-semibold">Buchungstext</th>
          </tr>
        </thead>
        <tbody>
          {buchungsstaepel.map(b => (
            <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="py-2 pr-3 text-gray-400">{b.id}</td>
              <td className="py-2 pr-3 font-medium text-gray-700">{b.kostenart}</td>
              <td className="py-2 pr-3 text-gray-500">{b.phase}</td>
              <td className="py-2 pr-3 text-right font-mono font-semibold text-gray-900">
                {eur(b.betrag)}
              </td>
              <td className="py-2 pr-3 text-center">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  b.sh === 'S' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}>
                  {SH_LABEL[b.sh]}
                </span>
              </td>
              <td className="py-2 pr-3 font-mono text-primary-700">{b.konto}</td>
              <td className="py-2 pr-3 font-mono text-gray-600">{b.gegenkonto}</td>
              <td className="py-2 pr-3 text-center font-mono text-gray-500">{b.bu || '–'}</td>
              <td className="py-2 pr-3 font-mono text-gray-500">{b.belegdatum}</td>
              <td className="py-2 pr-3 font-mono text-gray-500">{b.belegfeld1}</td>
              <td className="py-2 text-gray-600 max-w-[200px] truncate" title={b.buchungstext}>
                {b.buchungstext}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-300 font-bold text-sm">
            <td colSpan={3} className="py-2 text-gray-600">Summe ({buchungsstaepel.length} Buchungssätze)</td>
            <td className="py-2 text-right font-mono text-gray-900 pr-3">{eur(gesamt)}</td>
            <td colSpan={7} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Hauptseite ───────────────────────────────────────────────────────────────

function makeDefaultConfig(projectNumber: string, skr: Kontenrahmen = 'SKR03'): DatevConfig {
  const year = currentYear();
  return {
    kontenrahmen:          skr,
    beraternummer:         '',
    mandantennummer:       '',
    wirtschaftsjahrBeginn: `${year}-01-01`,
    buchungsperiodeVon:    `${year}-01-01`,
    buchungsperiodeBis:    `${year}-12-31`,
    bezeichnung:           `Projekt ${projectNumber}`.slice(0, 30),
    belegnummer:           projectNumber.slice(0, 12),
    belegdatum:            isoToday(),
    ustSatz:               19,
    reverseCharge:         false,
    konten:                getDefaultKonten(skr),
    kst1:                  projectNumber.slice(0, 36),
    kst2:                  '',
    mitErloesBuchung:      false,
  };
}

export default function DatevExportPage() {
  const { id: projectId } = useParams<{ id: string }>();

  const { data: project } = useQuery(['project', projectId], () => getProject(projectId!));
  const { data: summary, isLoading } = useQuery(
    ['summary', projectId],
    () => getProjectSummary(projectId!),
  );

  const [config, setConfig] = useState<DatevConfig | null>(null);
  const [buchungsstaepel, setBuchungsstaepel] = useState<Buchungssatz[]>([]);
  const [vorschauErzeugt, setVorschauErzeugt] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [exportErfolg, setExportErfolg] = useState<string | null>(null);

  // Config initialisieren sobald Projekt geladen
  useEffect(() => {
    if (project && !config) {
      setConfig(makeDefaultConfig(project.projectNumber));
    }
  }, [project, config]);

  // Kontenrahmen-Wechsel: Konten aktualisieren
  const handleKontenrahmenChange = (skr: Kontenrahmen) => {
    setConfig(prev => prev ? {
      ...prev,
      kontenrahmen: skr,
      konten: getDefaultKonten(skr),
    } : prev);
    setVorschauErzeugt(false);
  };

  const set = <K extends keyof DatevConfig>(key: K) => (value: DatevConfig[K]) => {
    setConfig(prev => prev ? { ...prev, [key]: value } : prev);
    setVorschauErzeugt(false);
    setExportErfolg(null);
  };

  const handleVorschau = () => {
    if (!config || !project || !summary) return;
    const errors = validateConfig(config);
    const errMap: Record<string, string> = {};
    errors.forEach(e => { errMap[e.field] = e.message; });
    setValidationErrors(errMap);
    if (errors.length > 0) return;

    const stapel = buildBuchungsstaepel(project, summary, config);
    setBuchungsstaepel(stapel);
    setVorschauErzeugt(true);
  };

  const handleExport = () => {
    if (!config || !project || !summary) return;
    const stapel = vorschauErzeugt ? buchungsstaepel
      : buildBuchungsstaepel(project, summary, config);
    const dateiname = downloadDatevCsv(stapel, config, project);
    setExportErfolg(dateiname);
    setTimeout(() => setExportErfolg(null), 5000);
  };

  const errOf = (field: string) => validationErrors[field];

  if (isLoading || !config) {
    return <div className="p-6"><div className="animate-pulse h-8 w-64 bg-gray-200 rounded" /></div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">

      {/* Breadcrumb + Titel */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to={`/projects/${projectId}/summary`} className="text-gray-400 hover:text-gray-600 text-sm">
          ← Kostenkalkulation
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">DATEV Export</h1>
        <span className="text-gray-400 text-sm hidden sm:inline">{project?.name}</span>
        <div className="ml-auto">
          <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
            Buchungsstapel EXTF v7
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── Linke Spalte: Konfiguration ─────────────────────────────────── */}
        <div className="space-y-5">

          {/* Mandant */}
          <div className="card">
            <SectionHeader
              title="Mandant"
              icon={
                <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                </svg>
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kontenrahmen">
                <Select value={config.kontenrahmen} onChange={v => handleKontenrahmenChange(v as Kontenrahmen)}>
                  <option value="SKR03">SKR03 (Industrie)</option>
                  <option value="SKR04">SKR04 (Dienstleistung)</option>
                </Select>
              </Field>
              <Field label="USt-Satz" error={errOf('ustSatz')}>
                <Select value={String(config.ustSatz)} onChange={v => set('ustSatz')(parseInt(v) as UstSatz)}>
                  <option value="19">19 % (Standard)</option>
                  <option value="7">7 % (ermäßigt)</option>
                  <option value="0">0 % (steuerfrei)</option>
                </Select>
              </Field>
              <Field label="Beraternummer" hint="1–9999" error={errOf('beraternummer')}>
                <Input value={config.beraternummer} onChange={set('beraternummer')} placeholder="1234" maxLength={4} />
              </Field>
              <Field label="Mandantennummer" hint="1–99999" error={errOf('mandantennummer')}>
                <Input value={config.mandantennummer} onChange={set('mandantennummer')} placeholder="12345" maxLength={5} />
              </Field>
              <Field label="WJ-Beginn" error={errOf('wirtschaftsjahrBeginn')}>
                <Input type="date" value={config.wirtschaftsjahrBeginn} onChange={set('wirtschaftsjahrBeginn')} />
              </Field>
              <Field label="">
                <div className="flex items-center gap-2 mt-5">
                  <input
                    type="checkbox"
                    id="rc"
                    checked={config.reverseCharge}
                    onChange={e => set('reverseCharge')(e.target.checked)}
                    className="w-4 h-4 rounded text-primary-600"
                  />
                  <label htmlFor="rc" className="text-sm text-gray-700">Reverse Charge (§ 13b)</label>
                </div>
              </Field>
            </div>
          </div>

          {/* Buchungsperiode */}
          <div className="card">
            <SectionHeader
              title="Buchungsperiode & Beleg"
              icon={
                <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Periode Von" error={errOf('buchungsperiodeVon')}>
                <Input type="date" value={config.buchungsperiodeVon} onChange={set('buchungsperiodeVon')} />
              </Field>
              <Field label="Periode Bis" error={errOf('buchungsperiodeBis')}>
                <Input type="date" value={config.buchungsperiodeBis} onChange={set('buchungsperiodeBis')} />
              </Field>
              <Field label="Bezeichnung" hint="max 30 Zeichen" error={errOf('bezeichnung')}>
                <Input value={config.bezeichnung} onChange={set('bezeichnung')} maxLength={30} />
              </Field>
              <Field label="Belegdatum (Leistungsdatum)" error={errOf('belegdatum')}>
                <Input type="date" value={config.belegdatum} onChange={set('belegdatum')} />
              </Field>
              <Field label="Belegnummer" hint="max 12 Zeichen" error={errOf('belegnummer')}>
                <Input value={config.belegnummer} onChange={set('belegnummer')} maxLength={12} placeholder={project?.projectNumber} />
              </Field>
            </div>
          </div>

          {/* Kostenstellen */}
          <div className="card">
            <SectionHeader
              title="Kostenstellen"
              icon={
                <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                </svg>
              }
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="KST1 (Kostenstelle)" hint="= Projektnummer (automatisch)">
                <Input value={config.kst1} onChange={set('kst1')} maxLength={36} disabled />
              </Field>
              <Field label="KST2 / Kostenträger" hint="optional">
                <Input value={config.kst2} onChange={set('kst2')} maxLength={36} placeholder="z. B. Bauabschnitt" />
              </Field>
            </div>
          </div>

          {/* Erlösbuchung */}
          <div className="card">
            <SectionHeader
              title="Optionen"
              icon={
                <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <input
                type="checkbox"
                id="erloes"
                checked={config.mitErloesBuchung}
                onChange={e => set('mitErloesBuchung')(e.target.checked)}
                className="w-4 h-4 rounded text-primary-600 mt-0.5 shrink-0"
              />
              <div>
                <label htmlFor="erloes" className="text-sm font-semibold text-gray-800 cursor-pointer">
                  Erlösbuchung (Ausgangsrechnung) erzeugen
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Erstellt zusätzlich eine Buchung: Debitor SOLL / Erlöskonto HABEN über die Gesamtsumme.
                  Nur aktivieren wenn eine Ausgangsrechnung vorliegt.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* ── Rechte Spalte: Konten-Mapping ───────────────────────────────── */}
        <div className="space-y-5">

          <div className="card">
            <SectionHeader
              title={`Konten-Mapping (${config.kontenrahmen})`}
              icon={
                <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" />
                </svg>
              }
            />
            <p className="text-xs text-gray-400 mb-3">
              Kontonummern anpassen falls Ihr Mandant abweichende Nummern verwendet.
              Standard-Werte werden bei Kontenrahmen-Wechsel zurückgesetzt.
            </p>
            <KontenEditor
              konten={config.konten}
              onChange={konten => setConfig(prev => prev ? { ...prev, konten } : prev)}
              errors={validationErrors}
            />
          </div>

          {/* Hinweis: Buchungssätze-Logik */}
          <div className="card bg-blue-50 border border-blue-200">
            <h4 className="text-xs font-bold text-blue-800 mb-2 uppercase tracking-wide">
              Erzeugte Buchungssätze
            </h4>
            <div className="space-y-1.5 text-xs text-blue-700">
              {[
                ['Materialkosten je Phase',    'Materialkonto S / Kreditor H', 'BU 8 (19 % VSt)'],
                ['Entsorgung je Phase',        'Entsorgungskonto S / Kreditor H', 'BU 8'],
                ['Lohnkosten je Phase',        'Lohnkonto S / Gegenkonto Lohn H', 'kein USt'],
                ['Fremdleistungen je Phase',   'Fremdleistungskonto S / Kreditor H', 'BU 8'],
                ['Erlöse (optional)',          'Erlöskonto H / Debitor S', 'auto USt'],
              ].map(([label, buchung, ust]) => (
                <div key={label} className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400 mt-1 shrink-0" />
                  <div>
                    <span className="font-semibold">{label}:</span>{' '}
                    <span className="text-blue-600">{buchung}</span>
                    {' – '}<span className="text-blue-500 italic">{ust}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RDS Hinweis */}
          <div className="card border border-dashed border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                Rechnungsdatenservice 1.0
              </span>
              <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full font-semibold">
                Demnächst
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Export im DATEV-RDS-1.0-Format (XML) für Belegübertragung inkl. Rechnungsbilder ist in Planung.
            </p>
          </div>

        </div>
      </div>

      {/* ── Aktionen ────────────────────────────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={handleVorschau}
          disabled={!summary}
          className="btn btn-secondary"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Buchungsstapel vorschauen
        </button>

        <button
          onClick={handleExport}
          disabled={!summary || Object.keys(validationErrors).length > 0}
          className="btn btn-primary"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          DATEV-CSV herunterladen
        </button>

        <button
          disabled
          className="btn btn-secondary opacity-40 cursor-not-allowed"
          title="Demnächst verfügbar"
        >
          RDS 1.0 (XML) – demnächst
        </button>

        {Object.keys(validationErrors).length > 0 && (
          <span className="text-sm text-red-600 font-medium">
            ⚠ {Object.keys(validationErrors).length} Validierungsfehler – bitte prüfen.
          </span>
        )}
      </div>

      {/* Erfolgsmeldung */}
      {exportErfolg && (
        <div className="mt-4 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-green-800">Export erfolgreich</p>
            <p className="text-xs text-green-600 font-mono">{exportErfolg}</p>
          </div>
        </div>
      )}

      {/* ── Vorschau-Tabelle ─────────────────────────────────────────────── */}
      {vorschauErzeugt && (
        <div className="mt-6 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">
              Buchungsstapel – Vorschau
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({buchungsstaepel.length} Sätze)
              </span>
            </h3>
            <span className="text-xs text-gray-400 font-mono">
              Kontenrahmen: {config.kontenrahmen} · USt: {config.ustSatz} %
              {config.reverseCharge ? ' · Reverse Charge' : ''}
            </span>
          </div>
          <VorschauTabelle buchungsstaepel={buchungsstaepel} />
        </div>
      )}

    </div>
  );
}
