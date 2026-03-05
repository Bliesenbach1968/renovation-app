/**
 * DATEV Buchungsstapel – EXTF Format v7 (Datenkategorie 21)
 * Spezifikation: DATEV Eigenorganisation comfort / Unternehmen online
 */

import type { Project, ProjectSummary } from '../types';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type Kontenrahmen = 'SKR03' | 'SKR04';
export type UstSatz = 19 | 7 | 0;

export interface DatevKonten {
  material:          string; // Materialaufwand
  lohn:              string; // Lohnaufwand
  fremdleistung:     string; // Fremdleistungen / Subunternehmer
  entsorgung:        string; // Entsorgung (default = fremdleistung)
  erloes:            string; // Erlöskonto (Ausgangsrechnung)
  debitor:           string; // Debitorensammelkonto oder spez. Debitor
  kreditorMaterial:  string; // Kreditor Materiallieferant
  kreditorFremd:     string; // Kreditor Fremdleister / Entsorger
  gegenkontLohn:     string; // Gegenkonto Lohn (z. B. Verb. ggü. Arbeitnehmern)
}

export interface DatevConfig {
  kontenrahmen:         Kontenrahmen;
  beraternummer:        string; // 1–9999
  mandantennummer:      string; // 1–99999
  wirtschaftsjahrBeginn: string; // YYYY-MM-DD
  buchungsperiodeVon:   string; // YYYY-MM-DD
  buchungsperiodeBis:   string; // YYYY-MM-DD
  bezeichnung:          string; // max 30 Zeichen
  belegnummer:          string; // max 12 Zeichen
  belegdatum:           string; // YYYY-MM-DD (Leistungsdatum)
  ustSatz:              UstSatz;
  reverseCharge:        boolean;
  konten:               DatevKonten;
  kst1:                 string; // Kostenstelle 1 (= Projektnummer)
  kst2:                 string; // Kostenstelle 2 / Kostenträger (optional)
  mitErloesBuchung:     boolean; // Ausgangsrechnung (Erlöse) miterzeugen
}

export interface Buchungssatz {
  id:            string;
  betrag:        number;
  sh:            'S' | 'H';
  konto:         string;
  gegenkonto:    string;
  bu:            string;
  belegdatum:    string; // DDMM
  belegfeld1:    string; // max 12 Zeichen
  buchungstext:  string; // max 60 Zeichen
  kost1:         string;
  kost2:         string;
  // Nur für Vorschau-Anzeige:
  kostenart:     string;
  phase:         string;
}

export interface ValidationError {
  field:   string;
  message: string;
}

// ─── Konten-Defaults ──────────────────────────────────────────────────────────

const DEFAULT_KONTEN: Record<Kontenrahmen, DatevKonten> = {
  SKR03: {
    material:         '3000', // Aufwand Roh-/Hilfs-/Betriebsstoffe
    lohn:             '4100', // Löhne
    fremdleistung:    '3100', // Fremdleistungen
    entsorgung:       '3100',
    erloes:           '8400', // Erlöse 19 % USt
    debitor:          '10000',
    kreditorMaterial: '70000',
    kreditorFremd:    '70001',
    gegenkontLohn:    '3720', // Verbindlichkeiten aus Lohn und Gehalt
  },
  SKR04: {
    material:         '5000', // Aufwand Roh-/Hilfs-/Betriebsstoffe
    lohn:             '6100', // Löhne
    fremdleistung:    '5300', // Bezogene Leistungen
    entsorgung:       '5300',
    erloes:           '4400', // Erlöse 19 % USt
    debitor:          '10000',
    kreditorMaterial: '70000',
    kreditorFremd:    '70001',
    gegenkontLohn:    '3720',
  },
};

export function getDefaultKonten(skr: Kontenrahmen): DatevKonten {
  return { ...DEFAULT_KONTEN[skr] };
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function buSchluessel(ust: UstSatz, reverseCharge: boolean): string {
  if (reverseCharge) return '94'; // § 13b UStG (Reverse Charge)
  if (ust === 19) return '8';     // 19 % Vorsteuer
  if (ust === 7)  return '9';     // 7 % Vorsteuer
  return '';                       // 0 % / steuerfrei
}

function formatBelegdatum(dateStr: string): string {
  // YYYY-MM-DD → DDMM
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length < 3) return '';
  return parts[2].padStart(2, '0') + parts[1].padStart(2, '0');
}

function yyyymmdd(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

const PHASE_LABELS: Record<string, string> = {
  demolition:          'Entkernung',
  renovation:          'Renovierung',
  specialConstruction: 'Sonderarbeiten',
};

// ─── Buchungssätze erzeugen ───────────────────────────────────────────────────

export function buildBuchungsstaepel(
  project: Project,
  summary: ProjectSummary,
  config: DatevConfig,
): Buchungssatz[] {
  const result: Buchungssatz[]  = [];
  const bu                       = buSchluessel(config.ustSatz, config.reverseCharge);
  const belegdatumDDMM           = formatBelegdatum(config.belegdatum);
  const belnr                    = config.belegnummer.slice(0, 12);
  const { kst1, kst2, konten }   = config;

  let idx = 1;

  for (const phase of ['demolition', 'renovation', 'specialConstruction'] as const) {
    const d = summary.phases[phase];
    if (!d) continue;
    const phaseLabel = PHASE_LABELS[phase];

    // 1. Materialkosten
    if (d.materialCost > 0) {
      result.push({
        id:           String(idx++),
        betrag:       d.materialCost,
        sh:           'S',
        konto:        konten.material,
        gegenkonto:   konten.kreditorMaterial,
        bu,
        belegdatum:   belegdatumDDMM,
        belegfeld1:   `${belnr}-MAT`.slice(0, 12),
        buchungstext: `Material ${phaseLabel} ${project.projectNumber}`.slice(0, 60),
        kost1: kst1, kost2: kst2,
        kostenart: 'Materialkosten',
        phase: phaseLabel,
      });
    }

    // 2. Entsorgung / Fremdleistung Entsorgung
    if (d.disposalCost > 0) {
      result.push({
        id:           String(idx++),
        betrag:       d.disposalCost,
        sh:           'S',
        konto:        konten.entsorgung,
        gegenkonto:   konten.kreditorFremd,
        bu,
        belegdatum:   belegdatumDDMM,
        belegfeld1:   `${belnr}-ENT`.slice(0, 12),
        buchungstext: `Entsorgung ${phaseLabel} ${project.projectNumber}`.slice(0, 60),
        kost1: kst1, kost2: kst2,
        kostenart: 'Entsorgungskosten',
        phase: phaseLabel,
      });
    }

    // 3. Lohnkosten (keine USt)
    if (d.laborCost > 0) {
      result.push({
        id:           String(idx++),
        betrag:       d.laborCost,
        sh:           'S',
        konto:        konten.lohn,
        gegenkonto:   konten.gegenkontLohn,
        bu:           '',
        belegdatum:   belegdatumDDMM,
        belegfeld1:   `${belnr}-LOH`.slice(0, 12),
        buchungstext: `Lohn ${phaseLabel} ${project.projectNumber}`.slice(0, 60),
        kost1: kst1, kost2: kst2,
        kostenart: 'Lohnkosten',
        phase: phaseLabel,
      });
    }

    // 4. Nebenleistungen (Container / Gerüst / Kran) als Fremdleistungen
    const nebenkosten = (d.containerCost || 0) + (d.geruestCost || 0) + (d.kranCost || 0);
    if (nebenkosten > 0) {
      result.push({
        id:           String(idx++),
        betrag:       nebenkosten,
        sh:           'S',
        konto:        konten.fremdleistung,
        gegenkonto:   konten.kreditorFremd,
        bu,
        belegdatum:   belegdatumDDMM,
        belegfeld1:   `${belnr}-FRM`.slice(0, 12),
        buchungstext: `Fremdleist. Container/Gerüst/Kran ${phaseLabel}`.slice(0, 60),
        kost1: kst1, kost2: kst2,
        kostenart: 'Fremdleistungen',
        phase: phaseLabel,
      });
    }
  }

  // 5. Erlösbuchung (Ausgangsrechnung, optional)
  if (config.mitErloesBuchung && summary.totals.grandTotal > 0) {
    result.push({
      id:           String(idx++),
      betrag:       summary.totals.grandTotal,
      sh:           'H',
      konto:        konten.erloes,
      gegenkonto:   konten.debitor,
      bu:           '', // Erlöskonto trägt USt automatisch
      belegdatum:   belegdatumDDMM,
      belegfeld1:   belnr,
      buchungstext: `Erlöse ${project.projectNumber} ${project.name}`.slice(0, 60),
      kost1: kst1, kost2: kst2,
      kostenart: 'Erlöse (Ausgangsrechnung)',
      phase: 'Gesamt',
    });
  }

  return result;
}

// ─── Validierung ──────────────────────────────────────────────────────────────

export function validateConfig(config: DatevConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  const berNr = parseInt(config.beraternummer, 10);
  if (!config.beraternummer || isNaN(berNr) || berNr < 1 || berNr > 9999)
    errors.push({ field: 'beraternummer', message: 'Beraternummer: 1–9999 (Pflicht)' });

  const manNr = parseInt(config.mandantennummer, 10);
  if (!config.mandantennummer || isNaN(manNr) || manNr < 1 || manNr > 99999)
    errors.push({ field: 'mandantennummer', message: 'Mandantennummer: 1–99999 (Pflicht)' });

  if (!config.wirtschaftsjahrBeginn)
    errors.push({ field: 'wirtschaftsjahrBeginn', message: 'WJ-Beginn ist Pflicht' });

  if (!config.buchungsperiodeVon)
    errors.push({ field: 'buchungsperiodeVon', message: 'Buchungsperiode Von ist Pflicht' });

  if (!config.buchungsperiodeBis)
    errors.push({ field: 'buchungsperiodeBis', message: 'Buchungsperiode Bis ist Pflicht' });

  if (config.buchungsperiodeVon && config.buchungsperiodeBis &&
      config.buchungsperiodeVon > config.buchungsperiodeBis)
    errors.push({ field: 'buchungsperiodeBis', message: 'Bis-Datum muss nach Von-Datum liegen' });

  if (!config.belegdatum)
    errors.push({ field: 'belegdatum', message: 'Belegdatum (Leistungsdatum) ist Pflicht' });

  if (!config.belegnummer.trim())
    errors.push({ field: 'belegnummer', message: 'Belegnummer ist Pflicht' });

  if (!config.bezeichnung.trim())
    errors.push({ field: 'bezeichnung', message: 'Bezeichnung ist Pflicht (max 30 Zeichen)' });

  // Konten-Plausibilität
  const kRex = /^\d{4,9}$/;
  const kontenFelder: Array<[keyof DatevKonten, string]> = [
    ['material',         'Materialkonto'],
    ['lohn',             'Lohnkonto'],
    ['fremdleistung',    'Fremdleistungskonto'],
    ['entsorgung',       'Entsorgungskonto'],
    ['erloes',           'Erlöskonto'],
    ['debitor',          'Debitorenkonto'],
    ['kreditorMaterial', 'Kreditor Material'],
    ['kreditorFremd',    'Kreditor Fremd'],
    ['gegenkontLohn',    'Gegenkonto Lohn'],
  ];
  for (const [key, label] of kontenFelder) {
    if (!kRex.test(config.konten[key]))
      errors.push({ field: `konten.${key}`, message: `${label}: 4–9 Ziffern erwartet` });
  }

  return errors;
}

// ─── DATEV EXTF CSV erzeugen ──────────────────────────────────────────────────

/**
 * Erzeugt einen DATEV-Buchungsstapel im EXTF-Format (Version 7, Datenkategorie 21).
 * Trennzeichen: Semikolon. Dezimaltrennzeichen: Komma. Encoding: UTF-8 (seit DATEV 2016+).
 */
export function buildDatevCsv(
  buchungsstaepel: Buchungssatz[],
  config: DatevConfig,
  project: Project,
): string {
  const now      = new Date();
  const pad2     = (n: number) => String(n).padStart(2, '0');
  const created  = [
    now.getFullYear(),
    pad2(now.getMonth() + 1),
    pad2(now.getDate()),
    pad2(now.getHours()),
    pad2(now.getMinutes()),
    pad2(now.getSeconds()),
    '000',
  ].join(''); // YYYYMMDDHHMMSS000

  const wj  = yyyymmdd(config.wirtschaftsjahrBeginn);
  const von = yyyymmdd(config.buchungsperiodeVon);
  const bis = yyyymmdd(config.buchungsperiodeBis);

  // ── Header-Zeile 1 (67 Felder) ────────────────────────────────────────────
  // Sachkontenlänge: 4 (Standard SKR03/SKR04)
  const h1Fields: (string | number)[] = [
    '"EXTF"', 700, 21, '"Buchungsstapel"', 7,
    created, '', '', '"Renovation App"', '', '',
    config.beraternummer,
    config.mandantennummer,
    wj,
    4,        // Sachkontenlänge
    von,
    bis,
    `"${config.bezeichnung.slice(0, 30)}"`,
    '',       // Diktatkürzel
    1,        // Buchungstyp 1 = Fibu
    0,        // Rechnungslegungszweck
    0,        // Festschreibung (0 = nein)
    '"EUR"',  // WKZ
  ];
  // Auffüllen auf 67 Felder
  while (h1Fields.length < 67) h1Fields.push('');
  const line1 = h1Fields.join(';');

  // ── Header-Zeile 2 (Spaltenköpfe, 116 Felder) ────────────────────────────
  const line2 = [
    '"Umsatz (ohne Soll/Haben-Kz)"',
    '"Soll/Haben-Kennzeichen"',
    '"WKZ Umsatz"',
    '"Kurs"',
    '"Basisumsatz"',
    '"WKZ Basisumsatz"',
    '"Konto"',
    '"Gegenkonto (ohne BU)"',
    '"BU-Schlüssel"',
    '"Belegdatum"',
    '"Belegfeld 1"',
    '"Belegfeld 2"',
    '"Skonto"',
    '"Buchungstext"',
    '"Postensperre"',
    '"Diverse Adressnummer"',
    '"Geschäftspartnerbank"',
    '"Sachverhalt"',
    '"Zinssperre"',
    '"Beleglink"',
    '"Beleginfo - Art 1"', '"Beleginfo - Inhalt 1"',
    '"Beleginfo - Art 2"', '"Beleginfo - Inhalt 2"',
    '"Beleginfo - Art 3"', '"Beleginfo - Inhalt 3"',
    '"Beleginfo - Art 4"', '"Beleginfo - Inhalt 4"',
    '"Beleginfo - Art 5"', '"Beleginfo - Inhalt 5"',
    '"Beleginfo - Art 6"', '"Beleginfo - Inhalt 6"',
    '"Beleginfo - Art 7"', '"Beleginfo - Inhalt 7"',
    '"Beleginfo - Art 8"', '"Beleginfo - Inhalt 8"',
    '"KOST1 - Kostenstelle"',
    '"KOST2 - Kostenstelle"',
    '"Kost-Menge"',
    '"EU-Land u. UStID"',
    '"EU-Steuersatz"',
    '"Abw. Versteuerungsart"',
    '"Sachverhals-L.-Länderkennzeichen"',
    '"Funktionsergänzung"',
    '"BU-49 Hauptfunktionstyp"',
    '"BU-49 Hauptfunktionsnummer"',
    '"BU-49 Funktionsergänzung"',
    '"Zusatzinformation- Art 1"', '"Zusatzinformation- Inhalt 1"',
    '"Zusatzinformation- Art 2"', '"Zusatzinformation- Inhalt 2"',
    '"Zusatzinformation- Art 3"', '"Zusatzinformation- Inhalt 3"',
    '"Zusatzinformation- Art 4"', '"Zusatzinformation- Inhalt 4"',
    '"Zusatzinformation- Art 5"', '"Zusatzinformation- Inhalt 5"',
    '"Zusatzinformation- Art 6"', '"Zusatzinformation- Inhalt 6"',
    '"Zusatzinformation- Art 7"', '"Zusatzinformation- Inhalt 7"',
    '"Zusatzinformation- Art 8"', '"Zusatzinformation- Inhalt 8"',
    '"Stück"',
    '"Gewicht"',
    '"Zahlweise"',
    '"Forderungsart"',
    '"Veranlagungsjahr"',
    '"Zugeordnete Fälligkeit"',
    '"Skontotyp"',
    '"Auftragsnummer"',
    '"Buchungstyp"',
    '"USt-Schlüssel (Umsatzsteuerschlüssel)"',
    '"EU-Mitgliedstaat"',
    '"Sachverhalt §13b UStG"',
    '"Leistungsbeschreibung §13b UStG"',
    '"Pauschalbesteuerung"',
    '"Notizen"',
    '"Geschäftsjahr der Zurückstellung"',
    '"Belegdatum der Zurückstellung"',
    '"Stornierung"',
    '"Link zum Beleg"',
    '"Währungsumrechnung"',
  ].join(';');

  // ── Datensätze ────────────────────────────────────────────────────────────
  const dataRows = buchungsstaepel.map(b => {
    const betragStr = b.betrag.toFixed(2).replace('.', ',');
    // 116 Felder: die meisten leer, nur die relevanten füllen
    const fields: string[] = new Array(116).fill('');

    fields[0]  = betragStr;        // Umsatz
    fields[1]  = b.sh;             // S/H
    fields[2]  = 'EUR';            // WKZ
    // 3,4,5: Kurs, Basisumsatz, WKZ Basisumsatz → leer für EUR
    fields[6]  = b.konto;          // Konto
    fields[7]  = b.gegenkonto;     // Gegenkonto
    fields[8]  = b.bu;             // BU-Schlüssel
    fields[9]  = b.belegdatum;     // Belegdatum (DDMM)
    fields[10] = `"${b.belegfeld1}"`;  // Belegfeld 1
    // 11: Belegfeld 2 → leer
    // 12: Skonto → leer
    fields[13] = `"${b.buchungstext}"`;  // Buchungstext
    // 14-35: leer
    fields[36] = `"${b.kost1}"`;   // KOST1
    fields[37] = `"${b.kost2}"`;   // KOST2
    // rest: leer

    return fields.join(';');
  });

  // DATEV-spezifisch: CRLF als Zeilenende, BOM für UTF-8
  const BOM = '\uFEFF';
  return BOM + [line1, line2, ...dataRows].join('\r\n');
}

// ─── Download-Hilfsfunktion ───────────────────────────────────────────────────

export function downloadDatevCsv(
  buchungsstaepel: Buchungssatz[],
  config: DatevConfig,
  project: Project,
): string {
  const csv      = buildDatevCsv(buchungsstaepel, config, project);
  const blob     = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url      = URL.createObjectURL(blob);
  const link     = document.createElement('a');
  const dateiname = `DATEV_Buchungsstapel_${project.projectNumber}_${new Date().toISOString().slice(0, 10)}.csv`;

  link.href      = url;
  link.download  = dateiname;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return dateiname;
}

// ─── Formatierungshilfe ───────────────────────────────────────────────────────

export function eur(n: number): string {
  return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
