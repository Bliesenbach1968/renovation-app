'use strict';

const {
  generateUniqueUnitName,
  generateUniqueRoomName,
  getFloorAbbrev,
} = require('../copyUtils');

// ─────────────────────────────────────────────
// getFloorAbbrev
// ─────────────────────────────────────────────
describe('getFloorAbbrev', () => {
  test('EG', ()  => expect(getFloorAbbrev(0)).toBe('EG'));
  test('KG', ()  => expect(getFloorAbbrev(-1)).toBe('KG'));
  test('TG', ()  => expect(getFloorAbbrev(-2)).toBe('TG'));
  test('TG2', () => expect(getFloorAbbrev(-3)).toBe('TG2'));
  test('DG', ()  => expect(getFloorAbbrev(20)).toBe('DG'));
  test('1.OG', () => expect(getFloorAbbrev(1)).toBe('1.OG'));
  test('5.OG', () => expect(getFloorAbbrev(5)).toBe('5.OG'));
});

// ─────────────────────────────────────────────
// generateUniqueUnitName – gleiche Etage
// ─────────────────────────────────────────────
describe('generateUniqueUnitName – gleiche Etage', () => {
  test('inkrementiert letzte Zahl', () => {
    expect(generateUniqueUnitName('WG links Nr.EG1', 0, 0, ['WG links Nr.EG1']))
      .toBe('WG links Nr.EG2');
  });

  test('überspringt bereits vorhandene Nummer', () => {
    expect(generateUniqueUnitName('WG links Nr.EG1', 0, 0, ['WG links Nr.EG1', 'WG links Nr.EG2']))
      .toBe('WG links Nr.EG3');
  });

  test('Name ohne Zahl → Kopie-Suffix', () => {
    const result = generateUniqueUnitName('Musterwohnung', 0, 0, ['Musterwohnung']);
    expect(result).toBe('Musterwohnung (Kopie)');
  });

  test('keine Kollision → unveränderter Name plus Inkrement', () => {
    expect(generateUniqueUnitName('WG links Nr.EG3', 0, 0, []))
      .toBe('WG links Nr.EG4');
  });
});

// ─────────────────────────────────────────────
// generateUniqueUnitName – andere Etage
// ─────────────────────────────────────────────
describe('generateUniqueUnitName – andere Etage', () => {
  test('EG → 1.OG: Kürzel ersetzen und Zahl auf 1 zurücksetzen', () => {
    expect(generateUniqueUnitName('WG links Nr.EG1', 0, 1, []))
      .toBe('WG links Nr.1.OG1');
  });

  test('EG → KG: Kürzel ersetzen', () => {
    expect(generateUniqueUnitName('Wohnung EG3', 0, -1, []))
      .toBe('Wohnung KG1');
  });

  test('bei Kollision auf Zielkürzel hochzählen', () => {
    expect(generateUniqueUnitName('WG links Nr.EG1', 0, 1, ['WG links Nr.1.OG1']))
      .toBe('WG links Nr.1.OG2');
  });

  test('Name enthält kein Kürzel → letzten Zahlenblock ersetzen', () => {
    const result = generateUniqueUnitName('Wohnung 3', 0, 1, []);
    expect(result).toBe('Wohnung 1.OG1');
  });
});

// ─────────────────────────────────────────────
// generateUniqueRoomName
// ─────────────────────────────────────────────
describe('generateUniqueRoomName', () => {
  test('kein Konflikt → Name unverändert', () => {
    expect(generateUniqueRoomName('Wohnzimmer', ['Bad', 'Küche']))
      .toBe('Wohnzimmer');
  });

  test('Konflikt → Kopie-Suffix', () => {
    expect(generateUniqueRoomName('Wohnzimmer', ['Wohnzimmer']))
      .toBe('Wohnzimmer (Kopie)');
  });

  test('Kopie bereits vorhanden → Kopie 2', () => {
    expect(generateUniqueRoomName('Wohnzimmer', ['Wohnzimmer', 'Wohnzimmer (Kopie)']))
      .toBe('Wohnzimmer (Kopie 2)');
  });

  test('mehrfache Kollision', () => {
    const existing = ['Bad', 'Bad (Kopie)', 'Bad (Kopie 2)', 'Bad (Kopie 3)'];
    expect(generateUniqueRoomName('Bad', existing)).toBe('Bad (Kopie 4)');
  });

  test('leere existierende Liste', () => {
    expect(generateUniqueRoomName('Schlafzimmer', [])).toBe('Schlafzimmer');
  });
});
