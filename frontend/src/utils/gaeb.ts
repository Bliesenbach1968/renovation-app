/**
 * GAEB DA XML – Version 3.2 (Datenaustausch Bau)
 * Namespace: http://www.gaeb.de/GAEB_DA_XML/200407
 *
 * Export: X31 (Leistungsverzeichnis Austausch)
 * Import: X30, X31, X34 (mit Preisen)
 * GAEB 90:  Erkennung + Konvertierungshinweis
 * GAEB 2000: Parsen wie DA XML (kompatibler Aufbau)
 */

import type { Project, Position } from '../types';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type GaebFormat   = 'gaeb_da_xml_32' | 'gaeb_2000' | 'gaeb_90' | 'unknown';
export type GaebDataPhase = 'X30' | 'X31' | 'X32' | 'X33' | 'X34' | 'X81' | string;
export type AppPhaseType  = 'demolition' | 'renovation' | 'specialConstruction';

export interface GaebPosition {
  posNum:    string;  // Ordnungszahl (z. B. "0010")
  posType:   'N' | 'L' | 'EP' | 'Z' | string;
  shortText: string;
  longText:  string;
  unit:      string;  // GAEB-Einheit (m2, m3, m, St …)
  qty:       number;
  up:        number;  // Einheitspreis
  gp:        number;  // Gesamtpreis
  // Strukturkontext
  boName?:   string;
  lgName?:   string;
  ulgName?:  string;
  boNum?:    string;
  lgNum?:    string;
  ulgNum?:   string;
}

export interface GaebULG {
  num:      string;
  name:     string;
  positions: GaebPosition[];
}

export interface GaebLG {
  num:      string;
  name:     string;
  ulgs:     GaebULG[];
  positions: GaebPosition[]; // Pos direkt in LG (ohne ULG)
}

export interface GaebBo {
  num:      string;
  name:     string;
  lgs:      GaebLG[];
  positions: GaebPosition[]; // Pos direkt in Bo
}

export interface GaebLV {
  format:        GaebFormat;
  dataPhase:     string;
  vers:          string;
  projectName:   string;
  projectNumber: string;
  address:       { street: string; city: string; zip: string; country: string; };
  date:          string;
  bereiche:      GaebBo[];
  allPositions:  GaebPosition[];
}

export interface GaebValidationError {
  severity: 'error' | 'warning';
  path:     string;
  tag?:     string;
  message:  string;
}

export interface GaebParseResult {
  lv:       GaebLV | null;
  errors:   GaebValidationError[];
  warnings: GaebValidationError[];
  rawXml:   string;
}

export interface GaebExportConfig {
  dataPhase:           GaebDataPhase;   // default X31
  includePrices:       boolean;
  includeLongTexts:    boolean;
  includeDisposal:     boolean;  // Entsorgungskosten als eigene Bo aufnehmen?
}

// ─── Konst. & Mappings ───────────────────────────────────────────────────────

export const GAEB_NS = 'http://www.gaeb.de/GAEB_DA_XML/200407';
export const GAEB_VERSION = '3.2';

export const GAEB_DATA_PHASES: Record<GaebDataPhase, string> = {
  X30: 'Ausschreibung (X30) – ohne Preise',
  X31: 'Angebotsaufforderung (X31) – LV-Austausch',
  X32: 'Angebot mit Preisen (X32)',
  X33: 'Nebenangebot (X33)',
  X34: 'Auftragserteilung (X34) – mit Preisen',
  X81: 'Abrechnung Auftraggeber (X81)',
};

// App-Einheit → GAEB-Einheit
export const UNIT_TO_GAEB: Record<string, string> = {
  'm²':   'm2',
  'm³':   'm3',
  'lfm':  'm',
  'Stück':'St',
  'Sack': 'Sck',
  'kg':   'kg',
  'Psch': 'pau',
  't':    't',
};

// GAEB-Einheit → App-Einheit (viele Aliasse berücksichtigen)
export const GAEB_TO_UNIT: Record<string, string> = {
  'm2':   'm²',   'm²':   'm²',
  'm3':   'm³',   'm³':   'm³',
  'm':    'lfm',  'lm':   'lfm',  'lfm': 'lfm',
  'St':   'Stück','Stk':  'Stück','Stck':'Stück','stk':'Stück',
  'Sck':  'Sack', 'Sk':   'Sack',
  'kg':   'kg',   'KG':   'kg',
  'pau':  'Psch', 'psch': 'Psch', 'Psch':'Psch','PSch':'Psch',
  't':    't',    'T':    't',
  'h':    'Stück',          // Stunde → Stück (nächste Entsprechung)
};

// Bo-Name → App-Phase
const BO_TO_PHASE: Record<string, AppPhaseType> = {
  'Entkernung':   'demolition',
  'Abbruch':      'demolition',
  'Demolition':   'demolition',
  'demolition':   'demolition',
  'Renovierung':  'renovation',
  'Ausbau':       'renovation',
  'Innenausbau':  'renovation',
  'renovation':   'renovation',
  'Sonderarbeiten': 'specialConstruction',
  'Sonderkonstruktion': 'specialConstruction',
  'specialConstruction': 'specialConstruction',
};

const PHASE_NAMES: Record<AppPhaseType, string> = {
  demolition:          'Entkernung',
  renovation:          'Renovierung',
  specialConstruction: 'Sonderarbeiten',
};

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function escXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtQty(n: number): string {
  return n.toFixed(3);   // GAEB: 3 Dezimalstellen für Mengen
}

function fmtPrice(n: number): string {
  return n.toFixed(2);   // Preise: 2 Dezimalstellen
}

function pad2(n: number): string  { return String(n).padStart(2, '0'); }
function pad4(n: number): string  { return String(n).padStart(4, '0'); }
function posOz(n: number): string { return String(n * 10).padStart(4, '0'); } // 0010, 0020 …

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item) || '(ohne)';
    acc[k] = acc[k] ? [...acc[k], item] : [item];
    return acc;
  }, {} as Record<string, T[]>);
}

// ─── Format-Erkennung ─────────────────────────────────────────────────────────

export function detectFormat(content: string): GaebFormat {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('<')) {
    // GAEB 90: text-based, starts with 'H  ' Datensatzart
    if (/^H\s{0,2}[0-9\s]{10,}/m.test(trimmed)) return 'gaeb_90';
    return 'unknown';
  }
  if (/gaeb_da_xml\/200407/i.test(trimmed) || /GAEB_DA_XML\/200407/i.test(trimmed)) return 'gaeb_da_xml_32';
  if (/gaeb_da_xml\//i.test(trimmed))  return 'gaeb_2000';
  if (/<GAEB\b/i.test(trimmed))        return 'gaeb_2000';
  return 'unknown';
}

// ─── GAEB DA XML Export ───────────────────────────────────────────────────────

export function buildGaebXml(
  project: Project,
  positions: Position[],
  config: GaebExportConfig,
): string {
  const today = new Date().toISOString().slice(0, 10);

  // Positionen nach Phase → Bereich → BereichUnterpunkt gruppieren
  const byPhase = groupBy(positions, p => p.phaseType || 'renovation');

  let boIdx = 1;
  const boBlocks: string[] = [];

  for (const phase of ['demolition', 'renovation', 'specialConstruction'] as AppPhaseType[]) {
    const phasePosns = byPhase[phase];
    if (!phasePosns || phasePosns.length === 0) continue;

    const byBereich = groupBy(phasePosns, p => p.bereich || '(ohne Bereich)');
    let lgIdx = 1;
    const lgBlocks: string[] = [];

    for (const [bereichName, bereichPosns] of Object.entries(byBereich)) {
      const byUnterpunkt = groupBy(bereichPosns, p => p.bereichUnterpunkt || '');
      let ulgIdx = 1;
      const ulgBlocks: string[] = [];
      const directPosBlocks: string[] = [];

      for (const [unterpunkt, unterpunktPosns] of Object.entries(byUnterpunkt)) {
        let posIdx = 1;
        const posBlocks = unterpunktPosns.map(pos => buildPosBlock(pos, posIdx++, config));

        if (unterpunkt && unterpunkt !== '(ohne)') {
          ulgBlocks.push(
            `        <ULG>\n` +
            `          <ULGNum>${pad4(ulgIdx++)}</ULGNum>\n` +
            `          <ULGName>${escXml(unterpunkt)}</ULGName>\n` +
            posBlocks.join('') +
            `        </ULG>\n`,
          );
        } else {
          directPosBlocks.push(...posBlocks);
        }
      }

      lgBlocks.push(
        `      <LG>\n` +
        `        <LGNum>${pad4(lgIdx++)}</LGNum>\n` +
        `        <LGName>${escXml(bereichName)}</LGName>\n` +
        ulgBlocks.join('') +
        directPosBlocks.join('') +
        `      </LG>\n`,
      );
    }

    boBlocks.push(
      `    <Bo>\n` +
      `      <BoNum>${pad2(boIdx++)}</BoNum>\n` +
      `      <BoName>${escXml(PHASE_NAMES[phase])}</BoName>\n` +
      lgBlocks.join('') +
      `    </Bo>\n`,
    );
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<GAEB xmlns="${GAEB_NS}"\n` +
    `      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n` +
    `      xsi:schemaLocation="${GAEB_NS} gaeb-da-xml_v3.2.xsd">\n` +
    `  <GAEBInfo>\n` +
    `    <Date>${today}</Date>\n` +
    `    <Vers>${GAEB_VERSION}</Vers>\n` +
    `  </GAEBInfo>\n` +
    `  <PrjInfo>\n` +
    `    <Name>${escXml(project.name)}</Name>\n` +
    `    <LblPrj>${escXml(project.projectNumber)}</LblPrj>\n` +
    `    <Proj>\n` +
    `      <PrjNo>${escXml(project.projectNumber)}</PrjNo>\n` +
    `      <BldgSite>\n` +
    `        <Street>${escXml(project.address?.street || '')}</Street>\n` +
    `        <City>${escXml(project.address?.city || '')}</City>\n` +
    `        <ZIP>${escXml(project.address?.zipCode || '')}</ZIP>\n` +
    `        <Country>${escXml(project.address?.country || 'DE')}</Country>\n` +
    `      </BldgSite>\n` +
    `    </Proj>\n` +
    `  </PrjInfo>\n` +
    `  <Award>\n` +
    `    <DP>${config.dataPhase}</DP>\n` +
    `    <DPVersion>GAEB DA XML V${GAEB_VERSION}</DPVersion>\n` +
    boBlocks.join('') +
    `  </Award>\n` +
    `</GAEB>\n`
  );
}

function buildPosBlock(pos: Position, idx: number, config: GaebExportConfig): string {
  const gaebUnit   = UNIT_TO_GAEB[pos.unit] || pos.unit;
  const totalPrice = pos.materialCostPerUnit + pos.disposalCostPerUnit +
                     (pos.laborHoursPerUnit * pos.laborHourlyRate);

  const priceBlock = config.includePrices && totalPrice > 0
    ? `            <UP>${fmtPrice(totalPrice)}</UP>\n` +
      `            <GP>${fmtPrice(totalPrice * pos.quantity)}</GP>\n`
    : '';

  const longTextBlock = config.includeLongTexts && pos.description
    ? `            <CompleteText>\n` +
      `              <DetailTxt>\n` +
      `                <Text>${escXml(pos.description)}</Text>\n` +
      `              </DetailTxt>\n` +
      `            </CompleteText>\n`
    : '';

  return (
    `          <Pos>\n` +
    `            <PosNum>${posOz(idx)}</PosNum>\n` +
    `            <PosType>N</PosType>\n` +
    `            <Description>\n` +
    `              <ShortText>${escXml(pos.name)}</ShortText>\n` +
    longTextBlock +
    `            </Description>\n` +
    `            <QtyUnit>${gaebUnit}</QtyUnit>\n` +
    `            <Qty>${fmtQty(pos.quantity)}</Qty>\n` +
    priceBlock +
    `          </Pos>\n`
  );
}

// ─── GAEB DA XML Parsen ───────────────────────────────────────────────────────

export function parseGaebXml(xmlString: string): GaebParseResult {
  const errors:   GaebValidationError[] = [];
  const warnings: GaebValidationError[] = [];

  const format = detectFormat(xmlString);

  if (format === 'gaeb_90') {
    return {
      lv: null,
      errors: [{
        severity: 'error',
        path: 'root',
        message:
          'GAEB 90-Format erkannt (text-basiert). ' +
          'Bitte die Datei in GAEB DA XML 3.2 konvertieren (z. B. mit GAEB-Online oder AVA-Software).',
      }],
      warnings: [],
      rawXml: xmlString,
    };
  }

  if (format === 'unknown') {
    return {
      lv: null,
      errors: [{
        severity: 'error',
        path: 'root',
        message: 'Unbekanntes Format. Erwartetes Format: GAEB DA XML (*.xml / *.gaeb).',
      }],
      warnings: [],
      rawXml: xmlString,
    };
  }

  // XML parsen
  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlString, 'application/xml');
  } catch (e) {
    return {
      lv: null,
      errors: [{ severity: 'error', path: 'root', message: `XML-Parse-Fehler: ${e}` }],
      warnings: [],
      rawXml: xmlString,
    };
  }

  const parseErr = doc.querySelector('parsererror');
  if (parseErr) {
    return {
      lv: null,
      errors: [{
        severity: 'error',
        path: 'root',
        tag: 'parsererror',
        message: 'XML-Parse-Fehler: ' + (parseErr.textContent || 'Unbekannter Fehler'),
      }],
      warnings: [],
      rawXml: xmlString,
    };
  }

  // Helper: Text aus Kind-Element holen (namespace-unabhängig via localName)
  const txt = (parent: Element | null | undefined, localName: string): string => {
    if (!parent) return '';
    for (const child of Array.from(parent.children)) {
      if (child.localName === localName) return child.textContent?.trim() || '';
    }
    return '';
  };

  const child = (parent: Element | null | undefined, localName: string): Element | null => {
    if (!parent) return null;
    for (const c of Array.from(parent.children)) {
      if (c.localName === localName) return c;
    }
    return null;
  };

  const children = (parent: Element | null | undefined, localName: string): Element[] => {
    if (!parent) return [];
    return Array.from(parent.children).filter(c => c.localName === localName);
  };

  const root = doc.documentElement;

  // Pflicht: GAEB-Element
  if (root.localName !== 'GAEB') {
    errors.push({ severity: 'error', path: 'root', tag: root.localName,
      message: `Wurzelelement muss <GAEB> sein, gefunden: <${root.localName}>` });
    return { lv: null, errors, warnings, rawXml: xmlString };
  }

  // GAEBInfo
  const gaebInfo = child(root, 'GAEBInfo');
  const vers = txt(gaebInfo, 'Vers');
  if (!gaebInfo)
    warnings.push({ severity: 'warning', path: 'GAEB/GAEBInfo', message: 'Element <GAEBInfo> fehlt' });
  if (vers && vers !== '3.2' && vers !== '3.1')
    warnings.push({ severity: 'warning', path: 'GAEB/GAEBInfo/Vers',
      message: `GAEB-Version "${vers}" – nur 3.1/3.2 vollständig unterstützt` });

  // PrjInfo
  const prjInfo   = child(root, 'PrjInfo');
  const projEl    = child(prjInfo, 'Proj');
  const bldgSite  = child(projEl, 'BldgSite');
  const projectName   = txt(prjInfo, 'Name');
  const projectNumber = txt(prjInfo, 'LblPrj') || txt(projEl, 'PrjNo');
  const date      = txt(gaebInfo, 'Date');

  if (!projectName)
    warnings.push({ severity: 'warning', path: 'GAEB/PrjInfo/Name', tag: 'Name',
      message: 'Pflichtfeld <Name> in <PrjInfo> fehlt oder leer' });

  // Award
  const award = child(root, 'Award');
  if (!award) {
    errors.push({ severity: 'error', path: 'GAEB/Award', tag: 'Award',
      message: 'Pflichtknoten <Award> fehlt' });
    return { lv: null, errors, warnings, rawXml: xmlString };
  }

  const dataPhase = txt(award, 'DP');
  if (!dataPhase)
    warnings.push({ severity: 'warning', path: 'GAEB/Award/DP', tag: 'DP',
      message: 'Datenaustauschphase <DP> fehlt – Import trotzdem möglich' });

  // Bereiche (Bo)
  const bereiche: GaebBo[] = [];
  const allPositions: GaebPosition[] = [];
  const ozSeen = new Set<string>();

  const boElements = children(award, 'Bo');
  if (boElements.length === 0)
    warnings.push({ severity: 'warning', path: 'GAEB/Award/Bo',
      message: 'Keine <Bo>-Elemente (Leistungsbereiche) gefunden' });

  boElements.forEach((bo, boI) => {
    const boNum  = txt(bo, 'BoNum') || pad2(boI + 1);
    const boName = txt(bo, 'BoName');

    const lgs:       GaebLG[] = [];
    const boPosns:   GaebPosition[] = [];

    children(bo, 'LG').forEach((lg, lgI) => {
      const lgNum  = txt(lg, 'LGNum') || pad4(lgI + 1);
      const lgName = txt(lg, 'LGName');

      const ulgs:    GaebULG[] = [];
      const lgPosns: GaebPosition[] = [];

      children(lg, 'ULG').forEach((ulg, ulgI) => {
        const ulgNum  = txt(ulg, 'ULGNum') || pad4(ulgI + 1);
        const ulgName = txt(ulg, 'ULGName');
        const ulgPosns: GaebPosition[] = [];

        children(ulg, 'Pos').forEach(pos => {
          const p = parsePos(pos, txt, child, boNum, boName, lgNum, lgName, ulgNum, ulgName,
            ozSeen, errors, warnings);
          if (p) { ulgPosns.push(p); allPositions.push(p); }
        });
        ulgs.push({ num: ulgNum, name: ulgName, positions: ulgPosns });
      });

      // Positionen direkt in LG (ohne ULG)
      children(lg, 'Pos').forEach(pos => {
        const p = parsePos(pos, txt, child, boNum, boName, lgNum, lgName, '', '',
          ozSeen, errors, warnings);
        if (p) { lgPosns.push(p); allPositions.push(p); }
      });

      lgs.push({ num: lgNum, name: lgName, ulgs, positions: lgPosns });
    });

    // Positionen direkt in Bo (ohne LG)
    children(bo, 'Pos').forEach(pos => {
      const p = parsePos(pos, txt, child, boNum, boName, '', '', '', '',
        ozSeen, errors, warnings);
      if (p) { boPosns.push(p); allPositions.push(p); }
    });

    bereiche.push({ num: boNum, name: boName, lgs, positions: boPosns });
  });

  if (allPositions.length === 0)
    warnings.push({ severity: 'warning', path: 'GAEB/Award',
      message: 'Keine importierbaren Positionen gefunden' });

  const lv: GaebLV = {
    format,
    dataPhase,
    vers: vers || '?',
    projectName,
    projectNumber,
    address: {
      street:  txt(bldgSite, 'Street'),
      city:    txt(bldgSite, 'City'),
      zip:     txt(bldgSite, 'ZIP'),
      country: txt(bldgSite, 'Country') || 'DE',
    },
    date,
    bereiche,
    allPositions,
  };

  return { lv, errors, warnings, rawXml: xmlString };
}

function parsePos(
  pos: Element,
  txt: (el: Element | null | undefined, tag: string) => string,
  child: (el: Element | null | undefined, tag: string) => Element | null,
  boNum: string, boName: string,
  lgNum: string, lgName: string,
  ulgNum: string, ulgName: string,
  ozSeen: Set<string>,
  errors: GaebValidationError[],
  warnings: GaebValidationError[],
): GaebPosition | null {
  const posNum  = txt(pos, 'PosNum');
  const posType = txt(pos, 'PosType') || 'N';

  // Typ-Filter: Nur Normal, Eventualposition, Zuschlag importieren
  if (posType === 'L') return null; // Leerpositionen überspringen

  // Beschreibung
  const descEl  = child(pos, 'Description');
  const shortText = txt(descEl, 'ShortText') || txt(pos, 'ShortText');
  const complEl = child(descEl, 'CompleteText');
  const detailEl = child(complEl, 'DetailTxt');
  const longText  = txt(detailEl, 'Text') || txt(pos, 'LongText') || '';

  // Einheit
  const qtyUnit = txt(pos, 'QtyUnit');

  // Menge
  const qtyStr = txt(pos, 'Qty').replace(',', '.');
  const qty    = parseFloat(qtyStr) || 0;

  // Preise (optional)
  const upStr  = txt(pos, 'UP').replace(',', '.');
  const gpStr  = txt(pos, 'GP').replace(',', '.');
  const up     = parseFloat(upStr) || 0;
  const gp     = parseFloat(gpStr) || (up * qty);

  // Validierungen
  const path = `GAEB/Award/Bo[${boNum}]/LG[${lgNum}]/Pos[${posNum}]`;

  if (!posNum) {
    warnings.push({ severity: 'warning', path, tag: 'PosNum',
      message: 'Pflichtfeld <PosNum> fehlt – Position wird importiert ohne OZ' });
  } else if (ozSeen.has(`${boNum}.${lgNum}.${ulgNum}.${posNum}`)) {
    errors.push({ severity: 'error', path, tag: 'PosNum',
      message: `Doppelte Ordnungszahl <PosNum> "${posNum}" in Bo ${boNum}/LG ${lgNum}/ULG ${ulgNum}` });
  } else {
    ozSeen.add(`${boNum}.${lgNum}.${ulgNum}.${posNum}`);
  }

  if (!shortText)
    errors.push({ severity: 'error', path, tag: 'ShortText',
      message: `Pflichtfeld <ShortText> fehlt in Position ${posNum || '?'} (Bo:${boName}, LG:${lgName})` });

  if (!qtyUnit)
    errors.push({ severity: 'error', path, tag: 'QtyUnit',
      message: `Pflichtfeld <QtyUnit> fehlt in Position ${posNum || '?'}` });
  else if (!GAEB_TO_UNIT[qtyUnit] && !Object.values(GAEB_TO_UNIT).includes(qtyUnit))
    warnings.push({ severity: 'warning', path, tag: 'QtyUnit',
      message: `Unbekannte GAEB-Einheit "${qtyUnit}" – wird als "Stück" importiert` });

  if (qty <= 0)
    warnings.push({ severity: 'warning', path, tag: 'Qty',
      message: `Menge ${qty} in Position ${posNum || '?'} – bitte prüfen` });

  return {
    posNum: posNum || `AUTO${ozSeen.size}`,
    posType,
    shortText: shortText || '(kein Kurztext)',
    longText,
    unit:  qtyUnit,
    qty,
    up,
    gp,
    boNum, boName,
    lgNum, lgName,
    ulgNum, ulgName,
  };
}

// ─── GAEB → App-Positionen mappen ────────────────────────────────────────────

export interface ImportedPosition {
  name:                string;
  phaseType:           AppPhaseType;
  bereich?:            string;
  bereichUnterpunkt?:  string;
  unit:                string;
  quantity:            number;
  materialCostPerUnit: number;
  disposalCostPerUnit: number;
  laborHoursPerUnit:   number;
  laborHourlyRate:     number;
  description?:        string;
  category:            string;
  // Für Preview-Anzeige
  gaebPosNum:          string;
  gaebBoName:          string;
  gaebLgName:          string;
}

export function gaebToAppPositions(
  gaebPositions: GaebPosition[],
  defaultPhase: AppPhaseType,
  includePrice: boolean,
): ImportedPosition[] {
  return gaebPositions.map(gp => {
    const appUnit = GAEB_TO_UNIT[gp.unit] || GAEB_TO_UNIT[gp.unit.toLowerCase()] || 'Stück';

    // Phase aus Bo-Name bestimmen
    let phaseType: AppPhaseType = defaultPhase;
    if (gp.boName) {
      phaseType = BO_TO_PHASE[gp.boName] ?? defaultPhase;
    }

    // Einheitspreis-Aufteilung: wenn kein Preis vorhanden → alles 0
    const up = includePrice ? gp.up : 0;

    // Einfache Annahme: UP = Materialpreis + Lohnkosten/Einheit
    // Wir setzen materialCostPerUnit = UP (kein Labor-Split ohne weitere Info)
    const materialCostPerUnit = up;

    return {
      name:                gp.shortText,
      phaseType,
      bereich:             gp.lgName  || undefined,
      bereichUnterpunkt:   gp.ulgName || undefined,
      unit:                appUnit,
      quantity:            gp.qty,
      materialCostPerUnit,
      disposalCostPerUnit: 0,
      laborHoursPerUnit:   0,
      laborHourlyRate:     45,
      description:         gp.longText || undefined,
      category:            gp.lgName  || 'Import',
      gaebPosNum:          gp.posNum,
      gaebBoName:          gp.boName || '',
      gaebLgName:          gp.lgName || '',
    };
  });
}

// ─── Validierung (Post-Parse) ─────────────────────────────────────────────────

export function validateGaebLv(lv: GaebLV): GaebValidationError[] {
  const errors: GaebValidationError[] = [];

  if (!lv.projectName)
    errors.push({ severity: 'error', path: 'GAEB/PrjInfo/Name', tag: 'Name',
      message: 'Projektname fehlt' });

  if (!lv.projectNumber)
    errors.push({ severity: 'warning', path: 'GAEB/PrjInfo/LblPrj', tag: 'LblPrj',
      message: 'Projektnummer fehlt (LblPrj)' });

  if (lv.bereiche.length === 0)
    errors.push({ severity: 'error', path: 'GAEB/Award/Bo',
      message: 'Keine Leistungsbereiche (Bo) vorhanden' });

  if (lv.allPositions.length === 0)
    errors.push({ severity: 'error', path: 'GAEB/Award',
      message: 'Keine Positionen zum Importieren gefunden' });

  return errors;
}

// ─── Download ─────────────────────────────────────────────────────────────────

export function downloadGaebXml(
  xml: string,
  projectNumber: string,
): string {
  const today    = new Date().toISOString().slice(0, 10);
  const filename = `GAEB_LV_${projectNumber}_${today}.XML`;
  const blob     = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
}

// ─── Formatierungs-Hilfen (für UI) ────────────────────────────────────────────

export function fmtGaebUnit(unit: string): string {
  return GAEB_TO_UNIT[unit] || unit;
}

export function phaseLabel(phase: AppPhaseType): string {
  return PHASE_NAMES[phase] || phase;
}

export function xmlPreview(xml: string, maxLines = 60): string {
  return xml.split('\n').slice(0, maxLines).join('\n');
}
