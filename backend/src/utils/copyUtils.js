'use strict';

/**
 * Kürzel pro Etagenlevel für automatische Wohnungsnamen.
 * EG=0, 1.OG=1…19, DG=20, KG=-1, TG=-2, TG2=-3
 */
const FLOOR_ABBREVS = {
  '-3': 'TG2',
  '-2': 'TG',
  '-1': 'KG',
  '0':  'EG',
  '20': 'DG',
};

/** Gibt das Etagenkürzel für ein Level zurück. */
function getFloorAbbrev(level) {
  const key = String(level);
  if (FLOOR_ABBREVS[key]) return FLOOR_ABBREVS[key];
  if (level >= 1 && level <= 19) return `${level}.OG`;
  return `E${level}`;
}

/**
 * Generiert einen eindeutigen Wohnungsnamen beim Kopieren.
 *
 * Regeln:
 *  - Gleiche Etage   → letzte Ziffer hochzählen  ("WG links Nr.EG1" → "WG links Nr.EG2")
 *  - Andere Etage    → Etagenkürzel ersetzen + Zahl auf 1 setzen ("…EG1" → "…1.OG1")
 *  - Namenskollision → Suffix "-Kopie", "-Kopie (2)" …
 *
 * @param {string}   sourceName       Originalname der Wohnung
 * @param {number}   sourceFloorLevel Level der Quell-Etage
 * @param {number}   targetFloorLevel Level der Ziel-Etage
 * @param {string[]} existingNames    Vorhandene Wohnungsnamen in der Ziel-Etage
 * @returns {string}
 */
function generateUniqueUnitName(sourceName, sourceFloorLevel, targetFloorLevel, existingNames) {
  const existing = new Set(existingNames);
  if (sourceFloorLevel === targetFloorLevel) {
    return _sameFloorName(sourceName, existing);
  }
  return _otherFloorName(sourceName, sourceFloorLevel, targetFloorLevel, existing);
}

/** Gleiche Etage: letzte Zahl am Ende inkrementieren. */
function _sameFloorName(sourceName, existing) {
  const match = sourceName.match(/^([\s\S]*?)(\d+)$/);
  if (match) {
    const base = match[1];
    let num = parseInt(match[2], 10) + 1;
    let candidate = `${base}${num}`;
    while (existing.has(candidate)) {
      num++;
      candidate = `${base}${num}`;
    }
    return candidate;
  }
  return _withKopieSuffix(sourceName, existing);
}

/**
 * Andere Etage: Etagenkürzel + Zahl ersetzen.
 * Bsp: "WG links Nr.EG1" mit src=0,tgt=1 → "WG links Nr.1.OG1"
 */
function _otherFloorName(sourceName, sourceFloorLevel, targetFloorLevel, existing) {
  const srcAbbrev = getFloorAbbrev(sourceFloorLevel);
  const tgtAbbrev = getFloorAbbrev(targetFloorLevel);

  // Suche <srcAbbrev><Zahl> irgendwo im String (letztes Vorkommen)
  const abbrevEsc = _escapeRegex(srcAbbrev);
  const lastAbbrevNum = new RegExp(`(${abbrevEsc})(\\d+)(?!.*${abbrevEsc}\\d)`, 'g');

  let candidate;
  if (lastAbbrevNum.test(sourceName)) {
    candidate = sourceName.replace(
      new RegExp(`(${abbrevEsc})(\\d+)(?!.*${abbrevEsc}\\d)`),
      `${tgtAbbrev}1`
    );
  } else {
    // Kein Kürzel gefunden: letzte Zahl durch tgtAbbrev + 1 ersetzen
    const trailingNum = sourceName.match(/^([\s\S]*?)(\d+)$/);
    if (trailingNum) {
      candidate = `${trailingNum[1]}${tgtAbbrev}1`;
    } else {
      candidate = `${sourceName} ${tgtAbbrev}1`;
    }
  }

  if (!existing.has(candidate)) return candidate;

  // Hochzählen: tgtAbbrev1 → tgtAbbrev2 …
  const tgtEsc = _escapeRegex(tgtAbbrev);
  const base = candidate.replace(new RegExp(`${tgtEsc}\\d+$`), tgtAbbrev);
  let n = 2;
  let next = `${base}${n}`;
  while (existing.has(next)) {
    n++;
    next = `${base}${n}`;
  }
  return next;
}

/**
 * Generiert einen eindeutigen Raumnamen beim Kopieren.
 * Bei Kollision: Suffix " (Kopie)", " (Kopie 2)" …
 *
 * @param {string}   sourceName    Originalname des Raums
 * @param {string[]} existingNames Vorhandene Raumnamen in Zielwohnung/-etage
 * @returns {string}
 */
function generateUniqueRoomName(sourceName, existingNames) {
  const existing = new Set(existingNames);
  if (!existing.has(sourceName)) return sourceName;
  return _withKopieSuffix(sourceName, existing);
}

/** Hängt Kopie-Suffix an und zählt bei weiterer Kollision hoch. */
function _withKopieSuffix(name, existing) {
  let candidate = `${name} (Kopie)`;
  let n = 2;
  while (existing.has(candidate)) {
    candidate = `${name} (Kopie ${n++})`;
  }
  return candidate;
}

function _escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { generateUniqueUnitName, generateUniqueRoomName, getFloorAbbrev };
