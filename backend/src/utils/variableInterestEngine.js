'use strict';

/**
 * VariableInterestEngine
 * ──────────────────────
 * Reine Berechnungslogik für variable Projektfinanzierungszinsen.
 * Keine DB-Abhängigkeiten – vollständig unit-testbar.
 *
 * Unterstützte Features:
 *  - Ereignisbasierte Zinsberechnung (tagesgenau)
 *  - Zinsstaffel (Staffel) und Index + Marge (z.B. EURIBOR + Spread)
 *  - Kapitalisierung (capitalize) oder monatliche Zahlung (payMonthly)
 *  - Day-count: ACT/360, ACT/365, 30E/360
 *  - Optionaler Tilgungsplan
 *  - Lag-Tage zwischen Kostenfall und Auszahlung
 *
 * @module variableInterestEngine
 */

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

/**
 * Rundet auf n Dezimalstellen (kaufmännisches Runden, "half away from zero").
 * Behebt JavaScript-Floating-Point-Artefakte (z.B. 1.005 * 100 = 100.499…).
 * @param {number} value
 * @param {number} [decimals=2]
 * @returns {number}
 */
function round(value, decimals = 2) {
  if (value === 0) return 0;
  const sign = value < 0 ? -1 : 1;
  const abs  = Math.abs(value);
  return sign * Number(`${Math.round(`${abs}e+${decimals}`)}e-${decimals}`);
}

/**
 * Berechnet die Anzahl der Zinszinstage zwischen zwei Daten.
 * @param {Date} from
 * @param {Date} to
 * @param {'ACT/360'|'ACT/365'|'30E/360'} dayCount
 * @returns {number}
 */
function computeDays(from, to, dayCount) {
  if (dayCount === '30E/360') {
    let d1 = from.getDate(), m1 = from.getMonth() + 1, y1 = from.getFullYear();
    let d2 = to.getDate(),   m2 = to.getMonth()   + 1, y2 = to.getFullYear();
    d1 = Math.min(d1, 30);
    d2 = Math.min(d2, 30);
    return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
  }
  // ACT/360 und ACT/365: tatsächliche Kalendertage
  const MS_PER_DAY = 86_400_000;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / MS_PER_DAY));
}

/**
 * Nenner je nach Day-Count-Konvention.
 * @param {'ACT/360'|'ACT/365'|'30E/360'} dayCount
 * @returns {number}
 */
function getDenominator(dayCount) {
  return dayCount === 'ACT/365' ? 365 : 360;
}

/**
 * Letzter Tag des Monats für ein gegebenes Datum.
 * @param {Date} date
 * @returns {Date}
 */
function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * Addiert Monate zu einem Datum (UTC-neutral, Europe/Berlin ignoriert für reine Arithmetik).
 * @param {Date} date
 * @param {number} months
 * @returns {Date}
 */
function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/**
 * Erstellt ein UTC-normiertes Datum (Uhrzeit = 00:00:00.000).
 * @param {Date|string} d
 * @returns {Date}
 */
function toDay(d) {
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

// ── Zinsmodell ────────────────────────────────────────────────────────────────

/**
 * Ermittelt den effektiven Jahreszinssatz zum gegebenen Datum aus dem Zinsmodell.
 *
 * @param {Date} date
 * @param {Object} rateModel
 * @param {'staffel'|'indexMargin'} rateModel.type
 * @param {Array<{startDate:Date,annualRate:number}>} [rateModel.schedule]   Staffel-Einträge
 * @param {Array<{startDate:Date,indexRate:number,margin:number,floor?:number}>} [rateModel.entries] Index-Marge-Einträge
 * @returns {number} Jahreszinssatz als Dezimalzahl (z.B. 0.05 für 5 %)
 */
function getEffectiveRate(date, rateModel) {
  const d = toDay(date);

  if (rateModel.type === 'staffel') {
    const sorted = [...(rateModel.schedule || [])].sort(
      (a, b) => toDay(a.startDate) - toDay(b.startDate)
    );
    let rate = 0;
    for (const entry of sorted) {
      if (toDay(entry.startDate) <= d) rate = +entry.annualRate;
    }
    return rate;
  }

  if (rateModel.type === 'indexMargin') {
    const sorted = [...(rateModel.entries || [])].sort(
      (a, b) => toDay(a.startDate) - toDay(b.startDate)
    );
    let active = null;
    for (const entry of sorted) {
      if (toDay(entry.startDate) <= d) active = entry;
    }
    if (!active) return 0;
    const raw = +active.indexRate + +active.margin;
    return Math.max(raw, +(active.floor ?? 0));
  }

  return 0;
}

// ── Monatsgrenzen ─────────────────────────────────────────────────────────────

/**
 * Erzeugt ein Array von Monatsend-Grenzpunkten [erster Monatsend nach start, ..., endDate].
 * Verwendet explizite Jahr/Monat-Arithmetik, um JS-Datumsüberlauf zu vermeiden
 * (z.B. addMonths(Jan-31, 1) → March-3 statt Feb-28).
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Date[]}
 */
function generateMonthBoundaries(startDate, endDate) {
  const boundaries = [];
  const end = toDay(endDate);
  let y = startDate.getFullYear();
  let m = startDate.getMonth();   // 0-based

  // Erster Grenzpunkt: letzter Tag des Start-Monats
  let cursor = new Date(y, m + 1, 0);

  while (cursor.getTime() < end.getTime()) {
    boundaries.push(toDay(cursor));
    // Nächsten Monatsend berechnen über sichere Monat-Index-Arithmetik
    m++;
    if (m > 11) { m = 0; y++; }
    cursor = new Date(y, m + 1, 0);
  }
  // Exaktes Ende sicherstellen
  if (boundaries.length === 0 || boundaries[boundaries.length - 1].getTime() !== end.getTime()) {
    boundaries.push(end);
  }
  return boundaries;
}

// ── Tilgungs-Events ───────────────────────────────────────────────────────────

/**
 * Erzeugt Tilgungs-Events aus einem Tilgungsplan.
 * @param {Array<{startDate:Date,amount?:number,pct?:number,frequency:string}>} plan
 * @param {Date} endDate
 * @returns {Array<{date:Date,type:'amortization',amountFixed?:number,pct?:number}>}
 */
function buildAmortizationEvents(plan, endDate) {
  if (!plan || plan.length === 0) return [];
  const events = [];
  const end = toDay(endDate);

  for (const entry of plan) {
    const freqMonths = entry.frequency === 'monthly' ? 1
      : entry.frequency === 'quarterly' ? 3 : 12;
    let d = toDay(entry.startDate);
    while (d <= end) {
      events.push({
        date: new Date(d),
        type: 'amortization',
        amountFixed: entry.amount != null ? +entry.amount : undefined,
        pct:         entry.pct   != null ? +entry.pct   : undefined,
      });
      d = toDay(addMonths(d, freqMonths));
    }
  }
  return events;
}

// ── Hauptfunktion ─────────────────────────────────────────────────────────────

/**
 * Berechnet Zinsplan und Zusammenfassung für eine variable Projektfinanzierung.
 *
 * Algorithmus: Ereignisbasiert (Event-driven).
 *  1. Alle Ereignisse (Drawdowns, Zinswechsel, Tilgungen, Monatsgrenzen) werden
 *     chronologisch sortiert.
 *  2. Zwischen zwei aufeinanderfolgenden Ereignissen wird der Zins tagesgenau auf
 *     den ausstehenden Saldo berechnet.
 *  3. Bei "capitalize": Zins wird dem Saldo zugeschlagen (Zinseszins).
 *     Bei "payMonthly":  Zins wird als Zahlung erfasst; Saldo bleibt unverändert.
 *
 * @param {Object} input
 * @param {Date}   input.acquisitionDate
 * @param {number} input.purchasePrice
 * @param {number} [input.acquisitionFeesPct]   z.B. 9.0 für 9 %
 * @param {number} [input.acquisitionFeesFixed] Festbetrag
 * @param {Array<{id:string,date:Date,amount:number,type:string,description:string}>} input.costItems
 * @param {Object} input.rateModel
 * @param {'ACT/360'|'ACT/365'|'30E/360'} [input.dayCount='ACT/360']
 * @param {'capitalize'|'payMonthly'} [input.interestMode='payMonthly']
 * @param {number}  [input.lagDays=0]
 * @param {Array}   [input.amortizationPlan=[]]
 * @param {string}  [input.currency='EUR']
 * @param {Date}    [input.calcEndDate]
 * @returns {{ summary: Object, schedule: Object[] }}
 */
function calculate(input) {
  const {
    acquisitionDate: rawAcqDate,
    purchasePrice,
    acquisitionFeesPct,
    acquisitionFeesFixed,
    acquisitionFeesLump,
    brokerCommissionPct,
    costItems      = [],
    rateModel,
    dayCount       = 'ACT/360',
    interestMode   = 'payMonthly',
    lagDays        = 0,
    amortizationPlan = [],
    currency       = 'EUR',
    calcEndDate: rawCalcEndDate,
  } = input;

  // ── Validierung ──────────────────────────────────────────────────────
  if (purchasePrice == null || purchasePrice < 0)
    throw new Error('purchasePrice muss ≥ 0 sein');
  if (!rateModel || !rateModel.type)
    throw new Error('rateModel ist erforderlich');

  const acquisitionDate = toDay(rawAcqDate);

  // ── Gebühren berechnen ───────────────────────────────────────────────
  const baseFees = acquisitionFeesFixed != null
    ? +acquisitionFeesFixed
    : (acquisitionFeesPct != null ? purchasePrice * acquisitionFeesPct / 100 : 0);
  const brokerFees = brokerCommissionPct != null ? purchasePrice * brokerCommissionPct / 100 : 0;
  const feesAmount = baseFees + (acquisitionFeesLump != null ? +acquisitionFeesLump : 0) + brokerFees;
  const totalAcquisitionDrawdown = purchasePrice + feesAmount;
  const totalProjectCosts = costItems.reduce((s, ci) => s + (ci.amount > 0 ? ci.amount : 0), 0);

  // ── Berechnungsende ──────────────────────────────────────────────────
  let calcEndDate;
  if (rawCalcEndDate) {
    calcEndDate = toDay(rawCalcEndDate);
  } else if (costItems.length > 0) {
    const lastMs = Math.max(...costItems.map(ci => toDay(ci.date).getTime()));
    calcEndDate = toDay(addMonths(new Date(lastMs), 6));
  } else {
    calcEndDate = toDay(addMonths(acquisitionDate, 18));
  }
  // Mindestens 1 Monat nach Ankauf
  if (calcEndDate <= acquisitionDate) {
    calcEndDate = toDay(addMonths(acquisitionDate, 1));
  }

  // ── Events zusammenstellen ───────────────────────────────────────────
  /** @type {Array<{date:Date,type:string,amount?:number,rate?:number,amountFixed?:number,pct?:number}>} */
  const events = [];

  // Ankaufs-Drawdown
  events.push({ date: acquisitionDate, type: 'drawdown', amount: totalAcquisitionDrawdown });

  // Projektkosten-Drawdowns
  for (const ci of costItems) {
    if (ci.amount <= 0) continue; // negative Beträge verhindern
    const d = toDay(ci.date);
    if (lagDays > 0) d.setDate(d.getDate() + lagDays);
    events.push({ date: d, type: 'drawdown', amount: ci.amount });
  }

  // Zinswechsel-Events (nur Zukunft relativ zu acquisitionDate – der erste Eintrag
  // der Staffel setzt den Anfangszinssatz, Wechsel davor können ignoriert werden)
  const buildRateEvents = (rm) => {
    const list = rm.type === 'staffel'
      ? (rm.schedule || []).map(e => ({ date: toDay(e.startDate), rate: +e.annualRate }))
      : (rm.entries  || []).map(e => ({
          date: toDay(e.startDate),
          rate: Math.max(+e.indexRate + +e.margin, +(e.floor ?? 0)),
        }));
    return list.map(e => ({ ...e, type: 'rateChange' }));
  };
  events.push(...buildRateEvents(rateModel));

  // Tilgungs-Events
  events.push(...buildAmortizationEvents(amortizationPlan, calcEndDate));

  // Monatsgrenzen als Period-Boundary-Events
  const monthBoundaries = generateMonthBoundaries(acquisitionDate, calcEndDate);
  for (const mb of monthBoundaries) {
    events.push({ date: mb, type: 'periodBoundary' });
  }

  // ── Sortierung: nach Datum, dann nach Priorität ──────────────────────
  // rateChange(0) < drawdown(1) < amortization(2) < periodBoundary(3)
  const PRIO = { rateChange: 0, drawdown: 1, amortization: 2, periodBoundary: 3 };
  events.sort((a, b) => {
    const dt = a.date.getTime() - b.date.getTime();
    return dt !== 0 ? dt : (PRIO[a.type] ?? 9) - (PRIO[b.type] ?? 9);
  });

  // ── Zustandsvariablen ────────────────────────────────────────────────
  let balance         = 0;                                         // ausstehender Saldo
  let currentDate     = toDay(acquisitionDate);                    // aktuelles Datum
  let currentRate     = getEffectiveRate(acquisitionDate, rateModel); // Anfangszins
  let totalInterest   = 0;
  let peakDebt        = 0;
  let totalWRateDays  = 0;  // Σ(rate × days) für Durchschnittszins
  let totalDays       = 0;

  // Per-Periode-Akkumulatoren
  let periodStart       = toDay(acquisitionDate);
  let periodStartBal    = 0;
  let periodDrawdown    = 0;
  let periodAmortization = 0;
  let periodInterest    = 0;
  let periodWRate       = 0; // Σ(rate × days) für gewichteten Periodenzins
  let periodDays        = 0;

  /** @type {Array<Object>} */
  const schedule = [];

  const denominator = getDenominator(dayCount);

  // ── Hauptschleife ────────────────────────────────────────────────────
  for (const ev of events) {
    const evDate = toDay(ev.date);

    // Zins aufgelaufen zwischen currentDate und evDate
    if (evDate > currentDate && balance > 0.005) {
      const days = computeDays(currentDate, evDate, dayCount);
      if (days > 0) {
        // Interne Rechengenauigkeit: 8 Dezimalstellen
        const interest = balance * currentRate * days / denominator;

        totalInterest    += interest;
        periodInterest   += interest;
        periodWRate      += currentRate * days;
        periodDays       += days;
        totalWRateDays   += currentRate * days;
        totalDays        += days;

        if (interestMode === 'capitalize') {
          balance += interest;
        }
        peakDebt = Math.max(peakDebt, balance);
      }
    }

    // Event anwenden
    switch (ev.type) {
      case 'rateChange':
        currentRate = ev.rate;
        break;

      case 'drawdown':
        balance      += ev.amount;
        periodDrawdown += ev.amount;
        peakDebt      = Math.max(peakDebt, balance);
        break;

      case 'amortization': {
        const amt = ev.amountFixed != null
          ? ev.amountFixed
          : (ev.pct != null ? balance * ev.pct / 100 : 0);
        const actual = Math.min(Math.max(amt, 0), balance);
        balance            -= actual;
        periodAmortization += actual;
        break;
      }

      case 'periodBoundary': {
        const avgRate = periodDays > 0
          ? periodWRate / periodDays
          : currentRate;

        schedule.push({
          periodStart:    new Date(periodStart),
          periodEnd:      new Date(evDate),
          rateApplied:    round(avgRate * 100, 4),          // in Prozent
          drawdown:       round(periodDrawdown, 2),
          amortization:   round(periodAmortization, 2),
          interest:       round(periodInterest, 2),
          fees:           0,
          startingBalance: round(Math.max(0, periodStartBal), 2),
          endingBalance:  round(Math.max(0, balance), 2),
        });

        // Periode zurücksetzen
        periodStart        = new Date(evDate);
        periodStartBal     = balance;
        periodDrawdown     = 0;
        periodAmortization = 0;
        periodInterest     = 0;
        periodWRate        = 0;
        periodDays         = 0;
        break;
      }
    }

    currentDate = evDate;
  }

  // ── Zusammenfassung ──────────────────────────────────────────────────
  const averageRate = totalDays > 0 ? totalWRateDays / totalDays : 0;

  const summary = {
    totalAcquisition: round(totalAcquisitionDrawdown, 2),
    totalProjectCosts: round(totalProjectCosts, 2),
    totalInterest:    round(totalInterest, 2),
    totalAllIn:       round(totalAcquisitionDrawdown + totalProjectCosts + totalInterest, 2),
    peakDebt:         round(peakDebt, 2),
    averageRate:      round(averageRate * 100, 4), // in Prozent
    periodsCount:     schedule.length,
    currency,
  };

  return { summary, schedule };
}

module.exports = {
  calculate,
  getEffectiveRate,
  computeDays,
  getDenominator,
  generateMonthBoundaries,
  round,
  toDay,
};
