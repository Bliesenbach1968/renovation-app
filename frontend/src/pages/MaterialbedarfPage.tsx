import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { getProject, getPositions, getRooms } from '../api/projects';
import type { Position, Room } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MatSource {
  positionId: string;
  positionName: string;
  roomName: string;
  bereichPath: string;
  phaseLabel: string;
  origQty: number;
  origUnit: string;
  matQty: number;
  matUnit: string;
  note: string;
}

interface MatLine {
  key: string;        // aggregation key
  groupKey: string;   // group key for ordering
  groupLabel: string; // display group
  name: string;       // material display name
  totalQty: number;
  unit: string;
  wastePercent?: number;
  detailNote?: string;
  subQty?: number;    // secondary quantity (e.g., piece count for tiles)
  subUnit?: string;
  sources: MatSource[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  demolition: 'Entkernung',
  renovation: 'Renovierung',
  specialConstruction: 'Sonderarbeiten',
};

const MATERIAL_PHASES = new Set(['demolition', 'renovation', 'specialConstruction']);

// Group ordering: lower = shown first
const GROUP_ORDER: Record<string, number> = {
  boden_fliesen: 1, boden_parkett: 2, boden_laminat: 3, boden_vinyl: 4,
  estrich: 10, estrich_daemmung: 11, estrich_kleber: 12,
  estrich_fuge: 13, estrich_silikon: 14, sockelleisten: 15,
  wand_fliesen: 20, wand_spachtel: 21, wand_farbe: 22, wand_tapete: 23,
  decke_farbe: 24, decke_spachtel: 25,
  trockenbau_profil: 30, trockenbau_rigips: 31,
  sanitar: 40, elektrik: 50, heizung: 60,
  tuer_fenster: 70, treppenhaus: 80, aussenanlage: 90, sonstiges: 99,
};

const fmtQty = (n: number, unit: string) => {
  const formatted = n.toLocaleString('de-DE', {
    minimumFractionDigits: unit === 'Stück' || unit === 'Sack' ? 0 : 2,
    maximumFractionDigits: unit === 'm³' ? 3 : 2,
  });
  return `${formatted} ${unit}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Extraction Engine
// ─────────────────────────────────────────────────────────────────────────────

function nl(s?: string | null) {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function slugify(s: string) {
  return nl(s).replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').substring(0, 40);
}

function parseTileSize(name: string): { w: number; h: number } | null {
  const m = name.match(/(\d+)\s*[xX×]\s*(\d+)/);
  return m ? { w: parseInt(m[1]), h: parseInt(m[2]) } : null;
}

function extractMaterials(pos: Position, roomName: string): MatLine[] {
  if (!MATERIAL_PHASES.has(pos.phaseType)) return [];
  if (pos.quantity <= 0) return [];
  if (pos.unit === 'Psch') return [];

  const qty  = pos.quantity;
  const unit = pos.unit;
  const bp   = nl(pos.bereichUnterpunkt);  // bereiche path (most reliable)
  const nm   = nl(pos.name);
  const desc = nl(pos.description);
  const all  = `${nm} ${desc} ${bp}`;
  const phaseLabel = PHASE_LABELS[pos.phaseType] || pos.phaseType;
  const bereichDisplay = pos.bereichUnterpunkt || pos.bereich || '';
  const lines: MatLine[] = [];

  const src = (matQty: number, matUnit: string, note = ''): MatSource => ({
    positionId: pos._id, positionName: pos.name, roomName,
    bereichPath: bereichDisplay, phaseLabel,
    origQty: qty, origUnit: unit, matQty, matUnit, note,
  });

  // ── helpers ─────────────────────────────────────────────────────────────────
  function pushLine(line: Omit<MatLine, 'sources'>, srcNote = '') {
    lines.push({ ...line, sources: [src(line.totalQty, line.unit, srcNote)] });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BODEN
  // ─────────────────────────────────────────────────────────────────────────

  // Bodenbelag – Fliesen  (bp: "3. Boden > a) Bodenbelag > aa) Fliesen")
  const isBodenFliesen = bp.includes('aa) fliesen') || bp.includes('boden') && bp.includes('fliesen')
    || (nm.includes('flies') || nm.includes('kachel')) && (bp.includes('boden') || bp.includes('belag'));
  if (isBodenFliesen && unit === 'm²') {
    const size = parseTileSize(pos.name);
    const label = size ? `Bodenfliesen ${size.w}×${size.h} cm` : 'Bodenfliesen';
    const key = `boden_fliesen_${size ? `${size.w}x${size.h}` : slugify(pos.name)}`;
    const matQty = +(qty * 1.10).toFixed(2);
    const subQty = size ? Math.ceil(qty * (10000 / (size.w * size.h)) * 1.10) : undefined;
    pushLine({ key, groupKey: 'boden_fliesen', groupLabel: 'Bodenbelag – Fliesen',
      name: label, totalQty: matQty, unit: 'm²', wastePercent: 10,
      detailNote: size ? `${(10000/(size.w*size.h)).toFixed(1)} Stk/m² · inkl. 10% Verschnitt` : 'inkl. 10% Verschnitt',
      subQty, subUnit: size ? 'Stück' : undefined,
    }, `${qty} m² + 10% Verschnitt`);
    return lines;
  }

  // Bodenbelag – Parkett  (bp: "ab) Parkett")
  const isParkett = bp.includes('ab) parkett') || nm.includes('parkett') || nm.includes('diele');
  if (isParkett && unit === 'm²') {
    const matQty = +(qty * 1.10).toFixed(2);
    pushLine({ key: `parkett_${slugify(pos.name)}`, groupKey: 'boden_parkett',
      groupLabel: 'Bodenbelag – Parkett', name: pos.name.substring(0, 60),
      totalQty: matQty, unit: 'm²', wastePercent: 10,
      detailNote: 'inkl. 10% Verschnitt',
    }, `${qty} m² + 10% Verschnitt`);
    return lines;
  }

  // Bodenbelag – Laminat  (bp: "ac) Laminat")
  const isLaminat = bp.includes('ac) laminat') || nm.includes('laminat');
  if (isLaminat && unit === 'm²') {
    const matQty = +(qty * 1.10).toFixed(2);
    pushLine({ key: `laminat_${slugify(pos.name)}`, groupKey: 'boden_laminat',
      groupLabel: 'Bodenbelag – Laminat', name: pos.name.substring(0, 60),
      totalQty: matQty, unit: 'm²', wastePercent: 10,
    }, `${qty} m² + 10% Verschnitt`);
    return lines;
  }

  // Bodenbelag – Vinyl  (bp: "ad) Vinyl")
  const isVinyl = bp.includes('ad) vinyl') || nm.includes('vinyl') || nm.includes('pvc-b') || nm.includes('klick');
  if (isVinyl && unit === 'm²') {
    const matQty = +(qty * 1.10).toFixed(2);
    pushLine({ key: `vinyl_${slugify(pos.name)}`, groupKey: 'boden_vinyl',
      groupLabel: 'Bodenbelag – Vinyl / PVC', name: pos.name.substring(0, 60),
      totalQty: matQty, unit: 'm²', wastePercent: 10,
    }, `${qty} m² + 10% Verschnitt`);
    return lines;
  }

  // Estrich  (bp: "b) Estrich")
  const isEstrich = bp.includes('b) estrich') || nm.includes('estrich') || desc.includes('estrich');
  if (isEstrich && unit === 'm²') {
    const thick = pos.estrichThickness ?? 0;
    const thickLabel = thick > 0 ? ` ${thick} mm` : '';
    const nameLabel = thick > 0
      ? (`${pos.name.substring(0, 40)}${thickLabel}`).replace(/\s+/g, ' ')
      : pos.name.substring(0, 60);
    const key = thick > 0 ? `estrich_${thick}mm` : `estrich_${slugify(pos.name)}`;

    if (thick > 0) {
      const volM3 = +(qty * thick / 1000).toFixed(3);
      // Volume (m³) – for ordering/delivery
      lines.push({ key: `${key}_vol`, groupKey: 'estrich', groupLabel: 'Estrich & Untergrund',
        name: nameLabel, totalQty: volM3, unit: 'm³',
        detailNote: `${qty} m² × ${thick} mm Schichtdicke`,
        sources: [src(volM3, 'm³', `${qty} m² × ${thick} mm / 1000 = ${volM3} m³`)],
      });
      // Surface area (m²) – for screed area
      lines.push({ key: `${key}_m2`, groupKey: 'estrich', groupLabel: 'Estrich & Untergrund',
        name: `${nameLabel} – Fläche`, totalQty: qty, unit: 'm²',
        sources: [src(qty, 'm²')],
      });
    } else {
      lines.push({ key, groupKey: 'estrich', groupLabel: 'Estrich & Untergrund',
        name: nameLabel, totalQty: qty, unit,
        sources: [src(qty, unit)],
      });
    }
    return lines;
  }

  // Trittschalldämmung  (bp: "c) Trittschalldämmung")
  const isDaemmung = bp.includes('c) trittschall') || nm.includes('trittschall')
    || nm.includes('daemmung') || nm.includes('pe-schaum') || nm.includes('pe schaum');
  if (isDaemmung && unit === 'm²') {
    const thick = pos.estrichThickness ?? 0;
    const thickLabel = thick > 0 ? ` ${thick} mm` : '';
    const matQty = +(qty * 1.05).toFixed(2);
    pushLine({ key: `daemmung_${thick > 0 ? thick + 'mm' : slugify(pos.name)}`,
      groupKey: 'estrich_daemmung', groupLabel: 'Estrich & Untergrund',
      name: `Trittschalldämmung${thickLabel}`, totalQty: matQty, unit: 'm²', wastePercent: 5,
    }, `${qty} m² + 5% Verschnitt`);
    return lines;
  }

  // Kleber  (bp: "d) Kleber")
  const isKleber = bp.includes('d) kleber') || nm.includes('kleber') || nm.includes('haftbrucke') || nm.includes('haftbrücke');
  if (isKleber) {
    pushLine({ key: `kleber_${slugify(pos.name)}`, groupKey: 'estrich_kleber',
      groupLabel: 'Estrich & Untergrund', name: pos.name.substring(0, 60),
      totalQty: qty, unit,
    });
    return lines;
  }

  // Fugenmaterial  (bp: "e) Fugenmaterial")
  const isFuge = bp.includes('e) fugenmaterial') || nm.includes('fugenmaterial') || nm.includes('fuge') || nm.includes('fugenmort');
  if (isFuge) {
    pushLine({ key: `fuge_${slugify(pos.name)}`, groupKey: 'estrich_fuge',
      groupLabel: 'Estrich & Untergrund', name: pos.name.substring(0, 60),
      totalQty: qty, unit,
    });
    return lines;
  }

  // Silikon  (bp: "f) Silikon")
  const isSilikon = bp.includes('f) silikon') || nm.includes('silikon') || nm.includes('silicon');
  if (isSilikon) {
    pushLine({ key: `silikon_${slugify(pos.name)}`, groupKey: 'estrich_silikon',
      groupLabel: 'Estrich & Untergrund', name: pos.name.substring(0, 60),
      totalQty: qty, unit,
    });
    return lines;
  }

  // Sockelleisten  (bp: "g) Sockelleisten")
  const isSockel = bp.includes('g) sockelleisten') || nm.includes('sockelleiste') || nm.includes('fussleiste') || nm.includes('fußleiste') || nm.includes('abschlussleiste');
  if (isSockel) {
    const matQty = +(qty * 1.10).toFixed(2);
    const usedUnit = unit === 'lfm' ? 'lfm' : unit;
    pushLine({ key: `sockel_${slugify(pos.name)}`, groupKey: 'sockelleisten',
      groupLabel: 'Sockelleisten', name: pos.name.substring(0, 60),
      totalQty: matQty, unit: usedUnit, wastePercent: 10,
    }, `${qty} ${usedUnit} + 10% Verschnitt`);
    return lines;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WÄNDE
  // ─────────────────────────────────────────────────────────────────────────

  // Wandfliesen  (bp: "1. Wände > e) Fliesen")
  const isWandFliesen = (bp.includes('1. wande') || bp.includes('1. wände')) && bp.includes('e) fliesen')
    || (nm.includes('wandflies') || nm.includes('wandkachel'))
    || bp.includes('4. badezimmer') && (nm.includes('flies') || nm.includes('kachel'));
  if (isWandFliesen && unit === 'm²') {
    const size = parseTileSize(pos.name);
    const label = size ? `Wandfliesen ${size.w}×${size.h} cm` : 'Wandfliesen';
    const key = `wand_fliesen_${size ? `${size.w}x${size.h}` : slugify(pos.name)}`;
    const matQty = +(qty * 1.10).toFixed(2);
    const subQty = size ? Math.ceil(qty * (10000 / (size.w * size.h)) * 1.10) : undefined;
    pushLine({ key, groupKey: 'wand_fliesen', groupLabel: 'Wandbelag – Fliesen',
      name: label, totalQty: matQty, unit: 'm²', wastePercent: 10,
      detailNote: size ? `${(10000/(size.w*size.h)).toFixed(1)} Stk/m² · inkl. 10% Verschnitt` : 'inkl. 10% Verschnitt',
      subQty, subUnit: size ? 'Stück' : undefined,
    }, `${qty} m² + 10% Verschnitt`);
    return lines;
  }

  // Allgemeine Fliesen (Keyword, kein bereichUnterpunkt)
  const isGenericFliesen = !bp && (nm.includes('flies') || nm.includes('kachel')) && unit === 'm²';
  if (isGenericFliesen) {
    const size = parseTileSize(pos.name);
    const label = size ? `Fliesen ${size.w}×${size.h} cm` : 'Fliesen';
    const key = `fliesen_gen_${size ? `${size.w}x${size.h}` : slugify(pos.name)}`;
    const matQty = +(qty * 1.10).toFixed(2);
    const subQty = size ? Math.ceil(qty * (10000 / (size.w * size.h)) * 1.10) : undefined;
    pushLine({ key, groupKey: 'boden_fliesen', groupLabel: 'Bodenbelag – Fliesen',
      name: label, totalQty: matQty, unit: 'm²', wastePercent: 10,
      subQty, subUnit: size ? 'Stück' : undefined,
    }, `${qty} m² + 10% Verschnitt`);
    return lines;
  }

  // Spachtel  (bp: "a) Spachteln")
  const isSpachtel = bp.includes('a) spachtel') || nm.includes('spachtel');
  if (isSpachtel && unit === 'm²') {
    const isDecke = bp.includes('2. decken');
    pushLine({ key: `spachtel_${isDecke ? 'decke' : 'wand'}_${slugify(pos.name)}`,
      groupKey: isDecke ? 'decke_spachtel' : 'wand_spachtel',
      groupLabel: isDecke ? 'Decke' : 'Wandbelag',
      name: pos.name.substring(0, 60), totalQty: qty, unit,
      detailNote: 'ca. 0,5–1 kg/m²',
    });
    return lines;
  }

  // Streichen/Farbe  (bp: "b) Streichen")
  const isFarbe = bp.includes('b) streichen') || nm.includes('streichen') || nm.includes('anstrich') || nm.includes('dispersion');
  if (isFarbe && unit === 'm²') {
    const isDecke = bp.includes('2. decken');
    pushLine({ key: `farbe_${isDecke ? 'decke' : 'wand'}_${slugify(pos.name)}`,
      groupKey: isDecke ? 'decke_farbe' : 'wand_farbe',
      groupLabel: isDecke ? 'Decke' : 'Wandbelag',
      name: pos.name.substring(0, 60), totalQty: qty, unit,
      detailNote: `ca. ${Math.ceil(qty / 7)} Liter (1 L / 7 m²)`,
    });
    return lines;
  }

  // Tapete  (bp: "c) Tapeten")
  const isTapete = bp.includes('c) tapeten') || nm.includes('tapete');
  if (isTapete && unit === 'm²') {
    const matQty = +(qty * 1.10).toFixed(2);
    pushLine({ key: `tapete_${slugify(pos.name)}`, groupKey: 'wand_tapete',
      groupLabel: 'Wandbelag', name: pos.name.substring(0, 60),
      totalQty: matQty, unit: 'm²', wastePercent: 10,
    }, `${qty} m² + 10% Verschnitt`);
    return lines;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TROCKENBAU
  // ─────────────────────────────────────────────────────────────────────────

  // Wandprofile / Deckenprofile  (bp: "da) Wandprofile" or "da) Deckenprofile")
  const isProfil = bp.includes('da) wandprofil') || bp.includes('da) deckenprofil')
    || nm.includes('cw-profil') || nm.includes('uw-profil') || nm.includes('cd-profil') || nm.includes('ud-profil')
    || (nm.includes('profil') && (bp.includes('trockenb') || nm.includes('trockenb')));
  if (isProfil) {
    pushLine({ key: `profil_${slugify(pos.name)}`, groupKey: 'trockenbau_profil',
      groupLabel: 'Trockenbau', name: pos.name.substring(0, 60), totalQty: qty, unit,
    });
    return lines;
  }

  // Rigipsplatten  (bp: "db) Rigipsplatten")
  const isRigips = bp.includes('db) rigipsplatten') || nm.includes('rigips') || nm.includes('gipskarton') || nm.includes('gkb') || nm.includes('gkf') || nm.includes('gk-platte');
  if (isRigips && unit === 'm²') {
    const matQty = +(qty * 1.05).toFixed(2);
    const sheets = Math.ceil(matQty / 3.125); // 1250×2500mm = 3.125 m²
    pushLine({ key: `rigips_${slugify(pos.name)}`, groupKey: 'trockenbau_rigips',
      groupLabel: 'Trockenbau', name: pos.name.substring(0, 60),
      totalQty: matQty, unit: 'm²', wastePercent: 5,
      subQty: sheets, subUnit: 'Platten (1250×2500)',
      detailNote: `${sheets} Platten à 3,125 m²`,
    }, `${qty} m² + 5% Verschnitt`);
    return lines;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SANITÄR
  // ─────────────────────────────────────────────────────────────────────────

  const isBad = bp.includes('4. badezimmer') || bp.includes('5. kuche') || bp.includes('5. küche');
  const isSanitar = isBad || nm.includes('toilette') || nm.includes('spulkasten') || nm.includes('spülkasten')
    || nm.includes('wc-') || nm.includes('waschbecken') || nm.includes('badewanne') || nm.includes('duschtasse')
    || nm.includes('armatur') || nm.includes('heizkorp') || nm.includes('badheizkorp')
    || nm.includes('siphon') || nm.includes('ablauf') || nm.includes('lufr') || nm.includes('luft');
  if (isSanitar) {
    pushLine({ key: `sanitar_${slugify(pos.name)}`, groupKey: 'sanitar',
      groupLabel: 'Sanitär & Badezimmer', name: pos.name.substring(0, 60), totalQty: qty, unit,
    });
    return lines;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ELEKTRIK
  // ─────────────────────────────────────────────────────────────────────────

  const isElektrik = bp.includes('7. elektrik') || bp.includes('iv. elektrik')
    || nm.includes('steckdose') || nm.includes('lichtschalter') || nm.includes('kabel')
    || nm.includes('verteiler') || nm.includes('rauchmelder') || nm.includes('antenne')
    || nm.includes('unterputz') || nm.includes('aufputz') || nm.includes('sicherung');
  if (isElektrik) {
    pushLine({ key: `elektrik_${slugify(pos.name)}`, groupKey: 'elektrik',
      groupLabel: 'Elektrik', name: pos.name.substring(0, 60), totalQty: qty, unit,
    });
    return lines;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HEIZUNG
  // ─────────────────────────────────────────────────────────────────────────

  const isHeizung = bp.includes('8. heizung') || bp.includes('v. heizung') || bp.includes('v.i heizung') || bp.includes('v.ii sanitar')
    || nm.includes('heizkorp') || nm.includes('thermostat') || nm.includes('fussbodenheizung') || nm.includes('fußbodenheizung')
    || nm.includes('steigleitung') || nm.includes('fernwarme') || nm.includes('fernwärme');
  if (isHeizung) {
    pushLine({ key: `heizung_${slugify(pos.name)}`, groupKey: 'heizung',
      groupLabel: 'Heizung & Sanitärleitungen', name: pos.name.substring(0, 60), totalQty: qty, unit,
    });
    return lines;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TÜREN & FENSTER
  // ─────────────────────────────────────────────────────────────────────────

  const isTuer = bp.includes('6. turen') || bp.includes('6. türen') || bp.includes('vii. fenster') || bp.includes('7. fenster')
    || ((nm.includes('tur') || nm.includes('tür') || nm.includes('fenster') || nm.includes('zargen')) && unit === 'Stück');
  if (isTuer) {
    pushLine({ key: `tuer_${slugify(pos.name)}`, groupKey: 'tuer_fenster',
      groupLabel: 'Türen & Fenster', name: pos.name.substring(0, 60), totalQty: qty, unit,
    });
    return lines;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TREPPENHAUS / AUSSENANLAGE
  // ─────────────────────────────────────────────────────────────────────────

  if (bp.includes('ii. treppenhaus')) {
    pushLine({ key: `treppe_${slugify(pos.name)}`, groupKey: 'treppenhaus',
      groupLabel: 'Treppenhaus', name: pos.name.substring(0, 60), totalQty: qty, unit,
    });
    return lines;
  }

  if (bp.includes('iii. aussenanlage') || bp.includes('iii. außenanlage')) {
    pushLine({ key: `aussen_${slugify(pos.name)}`, groupKey: 'aussenanlage',
      groupLabel: 'Außenanlage', name: pos.name.substring(0, 60), totalQty: qty, unit,
    });
    return lines;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FALLBACK – keyword-based for positions without bereichUnterpunkt
  // ─────────────────────────────────────────────────────────────────────────

  // Keyword: generic tiles
  if ((nm.includes('flies') || nm.includes('kachel')) && unit === 'm²') {
    const size = parseTileSize(pos.name);
    const matQty = +(qty * 1.10).toFixed(2);
    pushLine({ key: `fliesen_fb_${size ? `${size.w}x${size.h}` : slugify(pos.name)}`,
      groupKey: 'boden_fliesen', groupLabel: 'Bodenbelag – Fliesen',
      name: size ? `Fliesen ${size.w}×${size.h} cm` : pos.name.substring(0, 60),
      totalQty: matQty, unit: 'm²', wastePercent: 10,
      subQty: size ? Math.ceil(qty * (10000/(size.w*size.h)) * 1.10) : undefined,
      subUnit: size ? 'Stück' : undefined,
    }, `${qty} m² + 10% Verschnitt`);
    return lines;
  }

  if ((nm.includes('parkett') || nm.includes('diele')) && unit === 'm²') {
    const matQty = +(qty * 1.10).toFixed(2);
    pushLine({ key: `parkett_fb_${slugify(pos.name)}`, groupKey: 'boden_parkett',
      groupLabel: 'Bodenbelag – Parkett', name: pos.name.substring(0, 60),
      totalQty: matQty, unit: 'm²', wastePercent: 10,
    }, `${qty} m² + 10% Verschnitt`);
    return lines;
  }

  if (nm.includes('laminat') && unit === 'm²') {
    const matQty = +(qty * 1.10).toFixed(2);
    pushLine({ key: `laminat_fb_${slugify(pos.name)}`, groupKey: 'boden_laminat',
      groupLabel: 'Bodenbelag – Laminat', name: pos.name.substring(0, 60),
      totalQty: matQty, unit: 'm²', wastePercent: 10,
    }, `${qty} m² + 10% Verschnitt`);
    return lines;
  }

  if ((nm.includes('sockelleiste') || nm.includes('fussleiste') || nm.includes('fußleiste')) && unit === 'lfm') {
    const matQty = +(qty * 1.10).toFixed(2);
    pushLine({ key: `sockel_fb_${slugify(pos.name)}`, groupKey: 'sockelleisten',
      groupLabel: 'Sockelleisten', name: pos.name.substring(0, 60),
      totalQty: matQty, unit: 'lfm', wastePercent: 10,
    }, `${qty} lfm + 10% Verschnitt`);
    return lines;
  }

  if ((nm.includes('estrich') || desc.includes('estrich')) && unit === 'm²') {
    const thick = pos.estrichThickness ?? 0;
    if (thick > 0) {
      const vol = +(qty * thick / 1000).toFixed(3);
      lines.push({ key: `estrich_fb_${thick}mm_vol`, groupKey: 'estrich', groupLabel: 'Estrich & Untergrund',
        name: `Estrich ${thick} mm`, totalQty: vol, unit: 'm³',
        detailNote: `${qty} m² × ${thick} mm`, sources: [src(vol, 'm³')],
      });
      lines.push({ key: `estrich_fb_${thick}mm_m2`, groupKey: 'estrich', groupLabel: 'Estrich & Untergrund',
        name: `Estrich ${thick} mm – Fläche`, totalQty: qty, unit: 'm²', sources: [src(qty, 'm²')],
      });
      return lines;
    }
    pushLine({ key: `estrich_fb_${slugify(pos.name)}`, groupKey: 'estrich',
      groupLabel: 'Estrich & Untergrund', name: pos.name.substring(0, 60), totalQty: qty, unit,
    });
    return lines;
  }

  // Stück / lfm items without specific classification → include as-is
  if (unit === 'Stück' || unit === 'lfm' || unit === 'm²' || unit === 'm³'
      || unit === 'kg' || unit === 't' || unit === 'Sack') {
    pushLine({ key: `sonst_${slugify(pos.name)}`, groupKey: 'sonstiges',
      groupLabel: 'Sonstiges', name: pos.name.substring(0, 60), totalQty: qty, unit,
    });
  }

  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation
// ─────────────────────────────────────────────────────────────────────────────

function aggregateLines(raw: MatLine[]): MatLine[] {
  const map = new Map<string, MatLine>();
  for (const line of raw) {
    if (map.has(line.key)) {
      const ex = map.get(line.key)!;
      ex.totalQty = +(ex.totalQty + line.totalQty).toFixed(3);
      if (ex.subQty != null && line.subQty != null) ex.subQty += line.subQty;
      ex.sources.push(...line.sources);
    } else {
      map.set(line.key, { ...line, sources: [...line.sources] });
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const ga = GROUP_ORDER[a.groupKey] ?? 98;
    const gb = GROUP_ORDER[b.groupKey] ?? 98;
    if (ga !== gb) return ga - gb;
    return a.name.localeCompare(b.name, 'de');
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel Export
// ─────────────────────────────────────────────────────────────────────────────

async function downloadExcel(lines: MatLine[], projectName: string) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Materialbedarf');

  ws.columns = [
    { width: 28 }, // Gruppe
    { width: 40 }, // Material
    { width: 14 }, // Menge
    { width: 10 }, // Einheit
    { width: 14 }, // Stückzahl/Alternativ
    { width: 10 }, // Verschnitt
    { width: 40 }, // Hinweis
  ];

  const H = { argb: 'FF1E3A5F' };
  const hdr = ws.addRow(['Gruppe', 'Material / Bezeichnung', 'Menge gesamt', 'Einheit', 'Stück / Alt.', 'Verschnitt', 'Hinweis']);
  hdr.height = 22;
  hdr.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: H }; c.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }; c.alignment = { vertical: 'middle' }; });

  let lastGroup = '';
  const STRIPE = 'FFF0F4FA';

  for (const line of lines) {
    const isNewGroup = line.groupLabel !== lastGroup;
    if (isNewGroup) {
      const grpRow = ws.addRow([line.groupLabel]);
      grpRow.height = 18;
      grpRow.getCell(1).font = { bold: true, size: 9 };
      grpRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } };
      lastGroup = line.groupLabel;
    }

    const qtyStr = line.totalQty.toLocaleString('de-DE', { minimumFractionDigits: line.unit === 'm³' ? 3 : 2, maximumFractionDigits: 3 });
    const row = ws.addRow([
      '', line.name, +qtyStr.replace('.', '').replace(',', '.'), line.unit,
      line.subQty != null ? `${line.subQty} ${line.subUnit}` : '',
      line.wastePercent ? `+${line.wastePercent}%` : '',
      line.detailNote ?? '',
    ]);
    row.height = 16;
    row.getCell(3).numFmt = '#,##0.00';
    row.getCell(3).alignment = { horizontal: 'right' };
    row.eachCell(c => { c.font = { size: 9 }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STRIPE } }; });

    // Sources sub-rows
    for (const s of line.sources) {
      const sRow = ws.addRow(['', `  ↳ ${s.roomName || '–'} · ${s.positionName}`, s.origQty, s.origUnit, '', '', s.note]);
      sRow.height = 14;
      sRow.eachCell(c => { c.font = { size: 8, italic: true, color: { argb: 'FF888888' } }; });
    }
  }

  ws.addRow([]);
  ws.addRow([`Materialbedarf – ${projectName}`, '', '', '', '', '', `Erstellt: ${new Date().toLocaleDateString('de-DE')}`]);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `Materialbedarf_${projectName.replace(/\s+/g, '_')}.xlsx`;
  a.click(); URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Components
// ─────────────────────────────────────────────────────────────────────────────

function QtyBadge({ qty, unit, sub }: { qty: number; unit: string; sub?: { qty: number; unit: string } }) {
  return (
    <div className="text-right">
      <span className="font-bold text-sm text-gray-900">{fmtQty(qty, unit)}</span>
      {sub && (
        <div className="text-xs text-gray-500 mt-0.5">≈ {fmtQty(sub.qty, sub.unit)}</div>
      )}
    </div>
  );
}

function WasteBadge({ percent }: { percent: number }) {
  return (
    <span className="text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded px-1.5 py-0.5">
      +{percent}% Verschnitt
    </span>
  );
}

function SourceList({ sources }: { sources: MatSource[] }) {
  const byRoom = sources.reduce<Record<string, MatSource[]>>((acc, s) => {
    const key = s.roomName || '–';
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="mt-2 ml-4 space-y-1 text-xs text-gray-500 border-l-2 border-gray-100 pl-3">
      {Object.entries(byRoom).map(([room, srcs]) => (
        <div key={room}>
          <span className="font-medium text-gray-600">{room}</span>
          {srcs.map((s, i) => (
            <div key={i} className="ml-2 flex justify-between gap-4">
              <span className="truncate flex-1">{s.positionName}{s.bereichPath ? ` · ${s.bereichPath}` : ''}</span>
              <span className="shrink-0 tabular-nums">{fmtQty(s.origQty, s.origUnit)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function MaterialbedarfPage() {
  const { id } = useParams<{ id: string }>();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [exporting, setExporting] = useState(false);

  const { data: project } = useQuery(['project', id], () => getProject(id!));
  const { data: allPositions = [], isLoading } = useQuery(
    ['positions', 'all', id],
    () => getPositions(id!, {}),
    { enabled: !!id },
  );
  const { data: allRooms = [] } = useQuery(['rooms', id], () => getRooms(id!), { enabled: !!id });

  const roomMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const r of allRooms as Room[]) m[r._id] = r.name;
    return m;
  }, [allRooms]);

  // Apply phase filter to positions
  const filteredPositions = useMemo(() => {
    const pos = allPositions as import('../types').Position[];
    return phaseFilter === 'all' ? pos : pos.filter(p => p.phaseType === phaseFilter);
  }, [allPositions, phaseFilter]);

  // Extract and aggregate materials
  const materialLines = useMemo(() => {
    const raw: MatLine[] = [];
    for (const pos of filteredPositions) {
      const roomId = typeof pos.roomId === 'string' ? pos.roomId : (pos.roomId as any)?._id;
      const roomName = roomId ? (roomMap[roomId] ?? '–') : '–';
      raw.push(...extractMaterials(pos, roomName));
    }
    return aggregateLines(raw);
  }, [filteredPositions, roomMap]);

  // Search filter
  const visibleLines = useMemo(() => {
    if (!searchTerm.trim()) return materialLines;
    const q = searchTerm.toLowerCase();
    return materialLines.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.groupLabel.toLowerCase().includes(q) ||
      l.sources.some(s => s.positionName.toLowerCase().includes(q) || s.roomName.toLowerCase().includes(q))
    );
  }, [materialLines, searchTerm]);

  // Group by groupLabel
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; lines: MatLine[] }>();
    for (const line of visibleLines) {
      if (!map.has(line.groupLabel)) {
        map.set(line.groupLabel, { key: line.groupKey, label: line.groupLabel, lines: [] });
      }
      map.get(line.groupLabel)!.lines.push(line);
    }
    return Array.from(map.values());
  }, [visibleLines]);

  const toggle = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try { await downloadExcel(visibleLines, project?.name ?? 'Projekt'); }
    finally { setExporting(false); }
  };

  const totalLineCount = materialLines.length;

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <a href={`/projects/${id}`} className="hover:text-primary-600">{project?.name ?? 'Projekt'}</a>
        <span>/</span>
        <span className="text-gray-800 font-medium">Materialbedarf</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Materialbedarf</h1>
          {!isLoading && (
            <p className="text-sm text-gray-400 mt-0.5">
              {totalLineCount} Materialarten · {(allPositions as any[]).filter(p => MATERIAL_PHASES.has(p.phaseType)).length} Positionen analysiert
            </p>
          )}
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || materialLines.length === 0}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          {exporting ? 'Exportieren…' : 'Excel Export'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {[
            { key: 'all', label: 'Alle Phasen' },
            { key: 'demolition', label: 'Entkernung' },
            { key: 'renovation', label: 'Renovierung' },
            { key: 'specialConstruction', label: 'Sonderarbeiten' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setPhaseFilter(opt.key)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${phaseFilter === opt.key ? 'bg-white text-primary-700 font-semibold shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Material oder Raum suchen…"
          className="input text-sm py-1.5 w-56"
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-4 py-2">
        <span><span className="font-medium text-amber-600">+10% Verschnitt</span> bei Fliesen, Parkett, Laminat, Sockelleisten</span>
        <span><span className="font-medium text-amber-600">+5% Verschnitt</span> bei Rigipsplatten, Trittschalldämmung</span>
        <span><span className="font-medium text-blue-600">m³</span> bei Estrich = m² × Schichtdicke</span>
      </div>

      {isLoading && (
        <div className="card py-12 text-center text-gray-400 text-sm">Positionen werden geladen…</div>
      )}

      {!isLoading && groups.length === 0 && (
        <div className="card py-12 text-center text-gray-400">
          <p className="font-medium">Keine Materialien gefunden.</p>
          <p className="text-sm mt-1">Füge Positionen im Bereich „Gebäude & Räume" hinzu.</p>
          <Link to={`/projects/${id}/building`} className="btn-primary mt-4 inline-block text-sm">
            Zur Gebäudestruktur
          </Link>
        </div>
      )}

      {/* Material groups */}
      {groups.map(group => (
        <div key={group.label} className="card p-0 overflow-hidden">
          {/* Group header */}
          <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5 flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-700">{group.label}</h2>
            <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{group.lines.length}</span>
          </div>

          {/* Material rows */}
          <div className="divide-y divide-gray-50">
            {group.lines.map(line => (
              <div key={line.key}>
                <div
                  className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/60 cursor-pointer transition-colors"
                  onClick={() => toggle(line.key)}
                >
                  {/* Expand toggle */}
                  <button className="mt-0.5 text-gray-300 hover:text-gray-500 shrink-0">
                    <svg className={`w-3.5 h-3.5 transition-transform ${expandedKeys.has(line.key) ? 'rotate-90' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Material name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-800">{line.name}</span>
                      {line.wastePercent && <WasteBadge percent={line.wastePercent} />}
                    </div>
                    {line.detailNote && (
                      <p className="text-xs text-gray-400 mt-0.5">{line.detailNote}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      aus {line.sources.length} Position{line.sources.length !== 1 ? 'en' : ''}
                      {' · '}
                      {[...new Set(line.sources.map(s => s.roomName))].filter(r => r !== '–').slice(0, 3).join(', ')}
                      {[...new Set(line.sources.map(s => s.roomName))].filter(r => r !== '–').length > 3 ? ' …' : ''}
                    </p>
                  </div>

                  {/* Quantity */}
                  <QtyBadge
                    qty={line.totalQty}
                    unit={line.unit}
                    sub={line.subQty != null && line.subUnit ? { qty: line.subQty, unit: line.subUnit } : undefined}
                  />
                </div>

                {/* Expanded sources */}
                {expandedKeys.has(line.key) && (
                  <div className="px-4 pb-3 bg-gray-50/40">
                    <SourceList sources={line.sources} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Summary footer */}
      {groups.length > 0 && (
        <div className="text-xs text-gray-400 text-right pb-4">
          * Alle Mengen inkl. angegebenem Verschnittfaktor. Angaben ohne Gewähr – Aufmaß vor Bestellung empfohlen.
        </div>
      )}
    </div>
  );
}
