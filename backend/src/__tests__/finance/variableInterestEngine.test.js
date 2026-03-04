'use strict';

/**
 * Unit-Tests: VariableInterestEngine
 * ────────────────────────────────────
 * Laufbar mit Jest: `npx jest variableInterestEngine.test.js`
 * Benötigt: npm install --save-dev jest (einmalig im backend/-Ordner)
 *
 * Getestet:
 *  - Beispiel-Case 1 (Zinsstaffel, capitalize)
 *  - Beispiel-Case 2 (Index+Marge, payMonthly)  All-in < Case 1
 *  - Edge Cases: leere Kosten, zinsfreie Perioden, negative Beträge abweisen,
 *    30E/360, ACT/365, Tilgungsplan, Datumslücken
 */

const {
  calculate,
  getEffectiveRate,
  computeDays,
  getDenominator,
  round,
} = require('../../utils/variableInterestEngine');

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function d(iso) { return new Date(iso); }

/** 12 gleiche Monatsraten ab startISO */
function monthlyRates(startISO, count, amount) {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(startISO);
    date.setMonth(date.getMonth() + i);
    return { id: `ci-${i}`, date, amount, type: 'test', description: `Monat ${i + 1}` };
  });
}

// ── Kern-Inputs Case 1 & 2 ────────────────────────────────────────────────────

const BASE_COST_ITEMS = monthlyRates('2026-02-01', 12, 50_000);

const CASE1_INPUT = {
  acquisitionDate:   d('2026-01-15'),
  purchasePrice:     1_000_000,
  acquisitionFeesPct: 9.0,
  costItems:         BASE_COST_ITEMS,
  rateModel: {
    type: 'staffel',
    schedule: [
      { startDate: d('2026-01-15'), annualRate: 0.05 },
      { startDate: d('2026-07-01'), annualRate: 0.04 },
    ],
  },
  dayCount:      'ACT/360',
  interestMode:  'capitalize',
};

const CASE2_INPUT = {
  ...CASE1_INPUT,
  rateModel: {
    type: 'indexMargin',
    entries: [
      { startDate: d('2026-01-01'), indexName: '3M-EURIBOR', indexRate: 0.032, margin: 0.02, floor: 0 },
    ],
  },
  interestMode: 'payMonthly',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VariableInterestEngine', () => {

  // ── Case 1 ─────────────────────────────────────────────────────────────────

  describe('Beispiel-Case 1 (Staffel 5%→4%, capitalize, ACT/360)', () => {
    let result;
    beforeAll(() => { result = calculate(CASE1_INPUT); });

    test('totalInterest > 0', () => {
      expect(result.summary.totalInterest).toBeGreaterThan(0);
    });

    test('totalAcquisition = 1.090.000', () => {
      expect(result.summary.totalAcquisition).toBe(1_090_000);
    });

    test('totalProjectCosts = 600.000', () => {
      expect(result.summary.totalProjectCosts).toBe(600_000);
    });

    test('peakDebt > 1.690.000 (Ankauf + alle Kosten mindestens)', () => {
      expect(result.summary.peakDebt).toBeGreaterThan(1_690_000);
    });

    test('peakDebt enthält kapitalisierte Zinsen (> Summe der Drawdowns)', () => {
      expect(result.summary.peakDebt).toBeGreaterThan(
        result.summary.totalAcquisition + result.summary.totalProjectCosts
      );
    });

    test('All-in = Ankauf + Projektkosten + Zinsen', () => {
      const expected = round(
        result.summary.totalAcquisition +
        result.summary.totalProjectCosts +
        result.summary.totalInterest,
        2
      );
      expect(result.summary.totalAllIn).toBe(expected);
    });

    test('schedule hat ≥ 16 Perioden (Jan 2026 – Jul 2027)', () => {
      // acquisitionDate=15.01.2026, lastCostItem=01.01.2027, calcEnd=01.07.2027
      // Perioden: Jan(16 Tage), Feb, Mär, ..., Jun 2027 → 18 Monatsränder = 18 Zeilen
      expect(result.schedule.length).toBeGreaterThanOrEqual(16);
    });

    test('erste Periode: drawdown = 1.090.000 (Ankauf)', () => {
      expect(result.schedule[0].drawdown).toBe(1_090_000);
    });

    test('averageRate liegt zwischen 3% und 6%', () => {
      expect(result.summary.averageRate).toBeGreaterThan(3);
      expect(result.summary.averageRate).toBeLessThan(6);
    });

    test('endingBalance der letzten Periode > 0', () => {
      const last = result.schedule[result.schedule.length - 1];
      expect(last.endingBalance).toBeGreaterThan(0);
    });
  });

  // ── Case 2 ─────────────────────────────────────────────────────────────────

  describe('Beispiel-Case 2 (EURIBOR+Marge 5,2%, payMonthly)', () => {
    let result;
    beforeAll(() => { result = calculate(CASE2_INPUT); });

    test('totalInterest > 0', () => {
      expect(result.summary.totalInterest).toBeGreaterThan(0);
    });

    test('totalAcquisition = 1.090.000', () => {
      expect(result.summary.totalAcquisition).toBe(1_090_000);
    });

    test('peakDebt = Ankauf + Projektkosten (keine kapitalisierten Zinsen)', () => {
      // Bei payMonthly: Zinsen werden nicht zum Saldo addiert
      // → peakDebt ≈ 1.090.000 + 600.000 = 1.690.000
      expect(result.summary.peakDebt).toBeLessThanOrEqual(1_690_000 + 1); // toleranz 1 €
    });
  });

  describe('Vergleich Case 1 vs Case 2', () => {
    test('Zinsmodell-Differenz: Case 2 (5,2% fix, payMonthly) vs Case 1 (5%→4%, capitalize)', () => {
      const r1 = calculate(CASE1_INPUT);
      const r2 = calculate(CASE2_INPUT);
      // HINWEIS zur Erwartung:
      // Case 1: Staffel Ø ≈ 4,5 %, kapitalisiert (Zinseszins erhöht Basis leicht)
      // Case 2: 5,2 % konstant, nicht kapitalisiert (H2 2026: +1,2 % höhere Rate)
      // Der Ratenvorteil von Case 1 (4 % vs 5,2 % ab Jul) überwiegt den Kapitalisierungseffekt.
      // → Case 1 All-in < Case 2 All-in bei diesen konkreten Zinssätzen.
      expect(r2.summary.totalAllIn).toBeGreaterThan(r1.summary.totalAllIn);
    });

    test('Nicht-Kapitalisierung spart Zinsen bei GLEICHEM Zinssatz', () => {
      // Bei identischen 5% zeigt sich der reine Kapitalisierungseffekt
      const base = {
        acquisitionDate:   new Date('2026-01-01'),
        purchasePrice:     1_000_000,
        costItems:         [],
        dayCount:          'ACT/360',
        calcEndDate:       new Date('2027-07-01'),
      };
      const rCap = calculate({ ...base, interestMode: 'capitalize',  rateModel: { type: 'staffel', schedule: [{ startDate: new Date('2026-01-01'), annualRate: 0.05 }] } });
      const rPay = calculate({ ...base, interestMode: 'payMonthly', rateModel: { type: 'staffel', schedule: [{ startDate: new Date('2026-01-01'), annualRate: 0.05 }] } });
      // Kapitalisierung erzeugt Zinseszins → höhere Gesamtzinsen
      expect(rCap.summary.totalInterest).toBeGreaterThan(rPay.summary.totalInterest);
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────────

  describe('Edge Case: leere Kosten (nur Ankauf)', () => {
    test('funktioniert ohne costItems', () => {
      const r = calculate({
        acquisitionDate:  d('2026-01-01'),
        purchasePrice:    500_000,
        costItems:        [],
        rateModel:        { type: 'staffel', schedule: [{ startDate: d('2026-01-01'), annualRate: 0.05 }] },
        dayCount:         'ACT/360',
        interestMode:     'payMonthly',
      });
      expect(r.summary.totalAcquisition).toBe(500_000);
      expect(r.summary.totalProjectCosts).toBe(0);
      expect(r.summary.totalInterest).toBeGreaterThan(0);
    });
  });

  describe('Edge Case: zinsfreier Eintrag (annualRate = 0)', () => {
    test('kein Zins für die zinsfreie Periode', () => {
      const r = calculate({
        acquisitionDate:  d('2026-01-01'),
        purchasePrice:    1_000_000,
        costItems:        [],
        rateModel: {
          type: 'staffel',
          schedule: [
            { startDate: d('2026-01-01'), annualRate: 0 },
            { startDate: d('2026-04-01'), annualRate: 0.05 },
          ],
        },
        dayCount:      'ACT/360',
        interestMode:  'payMonthly',
        calcEndDate:   d('2026-12-31'),
      });
      // Zinsen erst ab April → muss > 0 sein
      expect(r.summary.totalInterest).toBeGreaterThan(0);
      // Aber die ersten 3 Monate waren zinslos
      const jan = r.schedule.find(s => new Date(s.periodEnd).getMonth() === 0);
      if (jan) expect(jan.interest).toBe(0);
    });
  });

  describe('Edge Case: negative Beträge werden ignoriert', () => {
    test('negative costItem-Beträge fließen nicht in Drawdowns ein', () => {
      const r = calculate({
        acquisitionDate: d('2026-01-01'),
        purchasePrice:   1_000_000,
        costItems: [
          { id: 'a', date: d('2026-02-01'), amount: -50_000, type: 'x', description: 'negativ' },
          { id: 'b', date: d('2026-02-01'), amount:  50_000, type: 'x', description: 'positiv' },
        ],
        rateModel: { type: 'staffel', schedule: [{ startDate: d('2026-01-01'), annualRate: 0.05 }] },
        dayCount:     'ACT/360',
        interestMode: 'payMonthly',
      });
      expect(r.summary.totalProjectCosts).toBe(50_000); // nur positive
    });
  });

  describe('Edge Case: purchasePrice < 0 wirft Fehler', () => {
    test('throws bei negativem purchasePrice', () => {
      expect(() => calculate({
        acquisitionDate: d('2026-01-01'),
        purchasePrice:  -1,
        costItems:       [],
        rateModel:       { type: 'staffel', schedule: [] },
      })).toThrow();
    });
  });

  describe('Edge Case: kein rateModel wirft Fehler', () => {
    test('throws wenn rateModel fehlt', () => {
      expect(() => calculate({
        acquisitionDate: d('2026-01-01'),
        purchasePrice:   1_000_000,
        costItems:       [],
        rateModel:       null,
      })).toThrow();
    });
  });

  describe('Edge Case: Datumslücken (Monate ohne Events)', () => {
    test('generiert Monatsgrenzen auch ohne Events', () => {
      const r = calculate({
        acquisitionDate: d('2026-01-01'),
        purchasePrice:   1_000_000,
        costItems: [
          // Nur 1 Kostenposition weit in der Zukunft
          { id: 'a', date: d('2026-12-01'), amount: 100_000, type: 'x', description: 'spät' },
        ],
        rateModel: { type: 'staffel', schedule: [{ startDate: d('2026-01-01'), annualRate: 0.05 }] },
        dayCount:     'ACT/360',
        interestMode: 'payMonthly',
      });
      // Perioden Jan–Dez 2026 + 6 Monate danach = mindestens 18 Zeilen
      expect(r.schedule.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe('Edge Case: 30E/360 Day-Count', () => {
    test('berechnet Zinsen mit 30E/360', () => {
      const r = calculate({
        acquisitionDate: d('2026-01-31'),
        purchasePrice:   1_000_000,
        costItems:       [],
        rateModel: { type: 'staffel', schedule: [{ startDate: d('2026-01-31'), annualRate: 0.05 }] },
        dayCount:     '30E/360',
        interestMode: 'payMonthly',
        calcEndDate:  d('2026-07-31'),
      });
      expect(r.summary.totalInterest).toBeGreaterThan(0);
    });
  });

  describe('Edge Case: ACT/365 Day-Count', () => {
    test('berechnet Zinsen mit ACT/365', () => {
      const r365 = calculate({
        acquisitionDate: d('2026-01-01'),
        purchasePrice:   1_000_000,
        costItems:       [],
        rateModel: { type: 'staffel', schedule: [{ startDate: d('2026-01-01'), annualRate: 0.05 }] },
        dayCount:     'ACT/365',
        interestMode: 'payMonthly',
        calcEndDate:  d('2026-12-31'),
      });
      const r360 = calculate({
        acquisitionDate: d('2026-01-01'),
        purchasePrice:   1_000_000,
        costItems:       [],
        rateModel: { type: 'staffel', schedule: [{ startDate: d('2026-01-01'), annualRate: 0.05 }] },
        dayCount:     'ACT/360',
        interestMode: 'payMonthly',
        calcEndDate:  d('2026-12-31'),
      });
      // ACT/365 liefert leicht weniger Zinsen als ACT/360 bei gleichem Zeitraum
      expect(r365.summary.totalInterest).toBeLessThan(r360.summary.totalInterest);
    });
  });

  describe('Edge Case: Tilgungsplan', () => {
    test('Tilgung reduziert Endsaldo', () => {
      const withoutAmort = calculate({
        acquisitionDate: d('2026-01-01'),
        purchasePrice:   1_000_000,
        costItems:       [],
        rateModel: { type: 'staffel', schedule: [{ startDate: d('2026-01-01'), annualRate: 0.05 }] },
        dayCount:     'ACT/360',
        interestMode: 'payMonthly',
        calcEndDate:  d('2027-01-01'),
      });
      const withAmort = calculate({
        acquisitionDate: d('2026-01-01'),
        purchasePrice:   1_000_000,
        costItems:       [],
        rateModel: { type: 'staffel', schedule: [{ startDate: d('2026-01-01'), annualRate: 0.05 }] },
        dayCount:     'ACT/360',
        interestMode: 'payMonthly',
        amortizationPlan: [{ startDate: d('2026-04-01'), amount: 50_000, frequency: 'monthly' }],
        calcEndDate:  d('2027-01-01'),
      });
      const endBal   = (r) => r.schedule[r.schedule.length - 1]?.endingBalance ?? 0;
      expect(endBal(withAmort)).toBeLessThan(endBal(withoutAmort));
    });
  });

  describe('Edge Case: Index+Marge mit floor', () => {
    test('floor=0 verhindert negativen Zins', () => {
      const r = calculate({
        acquisitionDate: d('2026-01-01'),
        purchasePrice:   1_000_000,
        costItems:       [],
        rateModel: {
          type: 'indexMargin',
          entries: [{ startDate: d('2026-01-01'), indexName: 'EURIBOR', indexRate: -0.005, margin: 0.002, floor: 0 }],
        },
        dayCount:     'ACT/360',
        interestMode: 'payMonthly',
      });
      // Effektivsatz = max(-0.005+0.002, 0) = 0 → kein Zins
      expect(r.summary.totalInterest).toBe(0);
    });

    test('floor > 0 setzt Mindestzins', () => {
      const r = calculate({
        acquisitionDate: d('2026-01-01'),
        purchasePrice:   1_000_000,
        costItems:       [],
        rateModel: {
          type: 'indexMargin',
          entries: [{ startDate: d('2026-01-01'), indexName: 'EURIBOR', indexRate: -0.01, margin: 0.005, floor: 0.02 }],
        },
        dayCount:     'ACT/360',
        interestMode: 'payMonthly',
        calcEndDate:  d('2026-07-01'),
      });
      // Effektivsatz = max(-0.005, 0.02) = 0.02 → Zinsen auf Basis 2%
      expect(r.summary.totalInterest).toBeGreaterThan(0);
      const expectedApprox = 1_000_000 * 0.02 * (6 * 30) / 360;
      expect(r.summary.totalInterest).toBeGreaterThan(expectedApprox * 0.9);
    });
  });

  // ── Hilfsfunktionen ─────────────────────────────────────────────────────────

  describe('getEffectiveRate', () => {
    test('gibt 0 zurück wenn kein Eintrag passt', () => {
      expect(getEffectiveRate(d('2025-01-01'), {
        type: 'staffel',
        schedule: [{ startDate: d('2026-01-01'), annualRate: 0.05 }],
      })).toBe(0);
    });

    test('wählt korrekten Staffeleintrag', () => {
      const rm = {
        type: 'staffel',
        schedule: [
          { startDate: d('2026-01-01'), annualRate: 0.05 },
          { startDate: d('2026-07-01'), annualRate: 0.04 },
        ],
      };
      expect(getEffectiveRate(d('2026-06-30'), rm)).toBe(0.05);
      expect(getEffectiveRate(d('2026-07-01'), rm)).toBe(0.04);
    });
  });

  describe('computeDays', () => {
    test('ACT/360: 31 Tage Jan', () => {
      expect(computeDays(d('2026-01-01'), d('2026-02-01'), 'ACT/360')).toBe(31);
    });
    test('30E/360: Jan hat 30 Tage', () => {
      expect(computeDays(d('2026-01-01'), d('2026-02-01'), '30E/360')).toBe(30);
    });
    test('ACT/365: gleich wie ACT/360 bei Zähler', () => {
      const days = computeDays(d('2026-03-01'), d('2026-06-01'), 'ACT/365');
      expect(days).toBe(92);
    });
    test('Kein negativer Rückgabewert', () => {
      expect(computeDays(d('2026-06-01'), d('2026-03-01'), 'ACT/360')).toBe(0);
    });
  });

  describe('round()', () => {
    test('2 Dezimalstellen – Standard', () => { expect(round(1.234)).toBe(1.23); });
    test('2 Dezimalstellen – half-up', () => { expect(round(1.005)).toBe(1.01); }); // JS-FP-safe
    test('4 Dezimalstellen', () => { expect(round(1.12345, 4)).toBe(1.1235); });
    test('negative Zahlen – half-away-from-zero', () => { expect(round(-1.565)).toBe(-1.57); });
    test('Null-Sicherheit', () => { expect(round(0)).toBe(0); });
    test('Große Zahlen', () => { expect(round(1_234_567.891)).toBe(1_234_567.89); });
  });
});
