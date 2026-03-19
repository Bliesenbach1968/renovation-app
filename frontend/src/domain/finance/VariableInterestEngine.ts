/**
 * VariableInterestEngine – TypeScript Domain Module
 * ──────────────────────────────────────────────────
 * Reine Berechnungslogik für variable Projektfinanzierungszinsen.
 * Keine Abhängigkeiten, vollständig im Browser ausführbar.
 *
 * Spiegelt die Backend-Logik (variableInterestEngine.js) in TypeScript wider,
 * um lokale Vorschau-Berechnungen ohne API-Roundtrip zu ermöglichen.
 */

// ── Typen ────────────────────────────────────────────────────────────────────

export type DayCountConvention = 'ACT/360' | 'ACT/365' | '30E/360';
export type InterestMode       = 'capitalize' | 'payMonthly';

/** Zinsstaffel-Eintrag */
export interface StaffelEntry {
  /** Gültig ab diesem Datum */
  startDate: Date;
  /** Jahreszinssatz als Dezimalzahl, z.B. 0.05 für 5 % */
  annualRate: number;
}

/** Index + Marge Eintrag (z.B. EURIBOR + Spread) */
export interface IndexMarginEntry {
  startDate: Date;
  indexName: string;
  /** Aktueller Indexsatz als Dezimalzahl, z.B. 0.032 */
  indexRate: number;
  /** Marge als Dezimalzahl, z.B. 0.02 */
  margin: number;
  /** Zinsuntergrenze (floor), Standard 0 */
  floor?: number;
}

export type RateModel =
  | { type: 'staffel';     schedule: StaffelEntry[] }
  | { type: 'indexMargin'; entries: IndexMarginEntry[] };

/** Eintrag im Tilgungsplan */
export interface AmortizationEntry {
  startDate: Date;
  /** Fixer Tilgungsbetrag in EUR */
  amount?: number;
  /** Oder prozentualer Anteil am ausstehenden Saldo */
  pct?: number;
  frequency: 'monthly' | 'quarterly' | 'annual';
}

/** Kostenelement aus der Kostenkalkulation */
export interface CostItem {
  id: string;
  date: Date;
  amount: number;
  type: string;
  description: string;
}

/** Eingabeparameter für die Engine */
export interface FinanceEngineInput {
  acquisitionDate: Date;
  purchasePrice: number;
  /** Erwerbsnebenkosten als Prozentsatz, z.B. 9.0 für 9 % */
  acquisitionFeesPct?: number;
  /** Oder als Festbetrag */
  acquisitionFeesFixed?: number;
  /** Maklercourtage als Prozentsatz vom Kaufpreis */
  brokerCommissionPct?: number;
  costItems: CostItem[];
  rateModel: RateModel;
  dayCount?: DayCountConvention;
  interestMode?: InterestMode;
  /** Verzögerungstage zwischen Kostenfall und Auszahlung */
  lagDays?: number;
  amortizationPlan?: AmortizationEntry[];
  currency?: string;
  calcEndDate?: Date;
}

/** Eine Zeile im Zinsplan */
export interface SchedulePeriod {
  periodStart: Date;
  periodEnd: Date;
  /** Gewichteter durchschnittlicher Zinssatz in Prozent (z.B. 5.0) */
  rateApplied: number;
  drawdown: number;
  amortization: number;
  interest: number;
  fees: number;
  startingBalance: number;
  endingBalance: number;
}

/** Zusammenfassung */
export interface FinanceSummary {
  totalAcquisition: number;
  totalProjectCosts: number;
  totalInterest: number;
  totalAllIn: number;
  peakDebt: number;
  /** Gewichteter Durchschnittszins in Prozent */
  averageRate: number;
  periodsCount: number;
  currency: string;
}

export interface FinanceResult {
  summary: FinanceSummary;
  schedule: SchedulePeriod[];
}

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Kaufmännisches Runden (half-away-from-zero), behebt JS-Floating-Point-Artefakte */
function round(value: number, decimals = 2): number {
  if (value === 0) return 0;
  const sign = value < 0 ? -1 : 1;
  const abs  = Math.abs(value);
  return sign * Number(`${Math.round(Number(abs + 'e+' + decimals))}e-${decimals}`);
}

function toDay(d: Date | string): Date {
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

/** Zinszinstage je Day-Count-Konvention */
export function computeDays(from: Date, to: Date, dayCount: DayCountConvention): number {
  if (dayCount === '30E/360') {
    let d1 = from.getDate(), m1 = from.getMonth() + 1, y1 = from.getFullYear();
    let d2 = to.getDate(),   m2 = to.getMonth()   + 1, y2 = to.getFullYear();
    d1 = Math.min(d1, 30);
    d2 = Math.min(d2, 30);
    return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
  }
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
}

export function getDenominator(dayCount: DayCountConvention): number {
  return dayCount === 'ACT/365' ? 365 : 360;
}

/** Effektiver Jahreszinssatz zum gegebenen Datum */
export function getEffectiveRate(date: Date, rateModel: RateModel): number {
  const d = toDay(date);
  if (rateModel.type === 'staffel') {
    const sorted = [...rateModel.schedule].sort(
      (a, b) => toDay(a.startDate).getTime() - toDay(b.startDate).getTime()
    );
    let rate = 0;
    for (const e of sorted) {
      if (toDay(e.startDate).getTime() <= d.getTime()) rate = e.annualRate;
    }
    return rate;
  }
  const sorted = [...rateModel.entries].sort(
    (a, b) => toDay(a.startDate).getTime() - toDay(b.startDate).getTime()
  );
  let active: IndexMarginEntry | null = null;
  for (const e of sorted) {
    if (toDay(e.startDate).getTime() <= d.getTime()) active = e;
  }
  if (!active) return 0;
  return Math.max(active.indexRate + active.margin, active.floor ?? 0);
}

/** Sichere Monatsgrenzen ohne JS-Datumsüberlauf (z.B. Jan31+1M → Feb28, nicht Mar3) */
function generateMonthBoundaries(start: Date, end: Date): Date[] {
  const boundaries: Date[] = [];
  const endDay = toDay(end);
  let y = start.getFullYear();
  let m = start.getMonth();

  let cursor = new Date(y, m + 1, 0); // letzter Tag des Start-Monats
  while (cursor.getTime() < endDay.getTime()) {
    boundaries.push(toDay(cursor));
    m++;
    if (m > 11) { m = 0; y++; }
    cursor = new Date(y, m + 1, 0);
  }
  if (!boundaries.length || boundaries[boundaries.length - 1].getTime() !== endDay.getTime()) {
    boundaries.push(endDay);
  }
  return boundaries;
}

type InternalEventType = 'drawdown' | 'amortization' | 'rateChange' | 'periodBoundary';
interface InternalEvent {
  date: Date;
  type: InternalEventType;
  amount?: number;
  rate?: number;
  amountFixed?: number;
  pct?: number;
}

const EVENT_PRIO: Record<InternalEventType, number> = {
  rateChange: 0, drawdown: 1, amortization: 2, periodBoundary: 3,
};

// ── Hauptfunktion ─────────────────────────────────────────────────────────────

/**
 * Berechnet Zinsplan und Zusammenfassung.
 * Wirft bei ungültigen Eingaben einen Error.
 */
export function calculate(input: FinanceEngineInput): FinanceResult {
  const {
    acquisitionDate: rawAcq,
    purchasePrice,
    acquisitionFeesPct,
    acquisitionFeesFixed,
    costItems      = [],
    rateModel,
    dayCount       = 'ACT/360',
    interestMode   = 'payMonthly',
    lagDays        = 0,
    amortizationPlan = [],
    currency       = 'EUR',
    calcEndDate: rawEnd,
  } = input;

  if (purchasePrice < 0) throw new Error('purchasePrice muss ≥ 0 sein');

  const acquisitionDate = toDay(rawAcq);
  const baseFees = acquisitionFeesFixed != null
    ? acquisitionFeesFixed
    : (acquisitionFeesPct != null ? purchasePrice * acquisitionFeesPct / 100 : 0);
  const brokerFees = input.brokerCommissionPct != null ? purchasePrice * input.brokerCommissionPct / 100 : 0;
  const feesAmount = baseFees + brokerFees;
  const totalAcq = purchasePrice + feesAmount;
  const totalCosts = costItems.reduce((s, ci) => s + (ci.amount > 0 ? ci.amount : 0), 0);

  let calcEndDate: Date;
  if (rawEnd) {
    calcEndDate = toDay(rawEnd);
  } else if (costItems.length > 0) {
    const lastMs = Math.max(...costItems.map(ci => toDay(ci.date).getTime()));
    calcEndDate = toDay(addMonths(new Date(lastMs), 6));
  } else {
    calcEndDate = toDay(addMonths(acquisitionDate, 18));
  }
  if (calcEndDate.getTime() <= acquisitionDate.getTime()) {
    calcEndDate = toDay(addMonths(acquisitionDate, 1));
  }

  // Events aufbauen
  const events: InternalEvent[] = [];

  events.push({ date: acquisitionDate, type: 'drawdown', amount: totalAcq });

  for (const ci of costItems) {
    if (ci.amount <= 0) continue;
    const d = toDay(ci.date);
    if (lagDays > 0) d.setDate(d.getDate() + lagDays);
    events.push({ date: d, type: 'drawdown', amount: ci.amount });
  }

  // Rate-Change-Events
  const rateEntries = rateModel.type === 'staffel'
    ? rateModel.schedule.map(e => ({ date: toDay(e.startDate), rate: e.annualRate }))
    : rateModel.entries.map(e => ({
        date: toDay(e.startDate),
        rate: Math.max(e.indexRate + e.margin, e.floor ?? 0),
      }));
  rateEntries.forEach(e => events.push({ date: e.date, type: 'rateChange', rate: e.rate }));

  // Tilgungen
  for (const entry of amortizationPlan) {
    const freqM = entry.frequency === 'monthly' ? 1 : entry.frequency === 'quarterly' ? 3 : 12;
    let d = toDay(entry.startDate);
    while (d.getTime() <= calcEndDate.getTime()) {
      events.push({ date: new Date(d), type: 'amortization', amountFixed: entry.amount, pct: entry.pct });
      d = toDay(addMonths(d, freqM));
    }
  }

  // Monatsgrenzen
  generateMonthBoundaries(acquisitionDate, calcEndDate).forEach(mb =>
    events.push({ date: mb, type: 'periodBoundary' })
  );

  events.sort((a, b) => {
    const dt = a.date.getTime() - b.date.getTime();
    return dt !== 0 ? dt : (EVENT_PRIO[a.type] ?? 9) - (EVENT_PRIO[b.type] ?? 9);
  });

  // Zustand
  let balance         = 0;
  let currentDate     = toDay(acquisitionDate);
  let currentRate     = getEffectiveRate(acquisitionDate, rateModel);
  let totalInterest   = 0;
  let peakDebt        = 0;
  let totalWRate      = 0;
  let totalDays       = 0;

  let periodStart     = toDay(acquisitionDate);
  let periodStartBal  = 0;
  let periodDrawdown  = 0;
  let periodAmort     = 0;
  let periodInterest  = 0;
  let periodWRate     = 0;
  let periodDays      = 0;

  const schedule: SchedulePeriod[] = [];
  const denom = getDenominator(dayCount);

  for (const ev of events) {
    const evDate = toDay(ev.date);

    if (evDate.getTime() > currentDate.getTime() && balance > 0.005) {
      const days = computeDays(currentDate, evDate, dayCount);
      if (days > 0) {
        const interest = balance * currentRate * days / denom;
        totalInterest  += interest;
        periodInterest += interest;
        periodWRate    += currentRate * days;
        periodDays     += days;
        totalWRate     += currentRate * days;
        totalDays      += days;
        if (interestMode === 'capitalize') balance += interest;
        peakDebt = Math.max(peakDebt, balance);
      }
    }

    switch (ev.type) {
      case 'rateChange':
        currentRate = ev.rate!;
        break;
      case 'drawdown':
        balance        += ev.amount!;
        periodDrawdown += ev.amount!;
        peakDebt        = Math.max(peakDebt, balance);
        break;
      case 'amortization': {
        const amt = ev.amountFixed != null
          ? ev.amountFixed
          : (ev.pct != null ? balance * ev.pct / 100 : 0);
        const actual = Math.min(Math.max(amt, 0), balance);
        balance     -= actual;
        periodAmort += actual;
        break;
      }
      case 'periodBoundary': {
        const avgRate = periodDays > 0 ? periodWRate / periodDays : currentRate;
        schedule.push({
          periodStart:     new Date(periodStart),
          periodEnd:       new Date(evDate),
          rateApplied:     round(avgRate * 100, 4),
          drawdown:        round(periodDrawdown, 2),
          amortization:    round(periodAmort, 2),
          interest:        round(periodInterest, 2),
          fees:            0,
          startingBalance: round(Math.max(0, periodStartBal), 2),
          endingBalance:   round(Math.max(0, balance), 2),
        });
        periodStart    = new Date(evDate);
        periodStartBal = balance;
        periodDrawdown = 0;
        periodAmort    = 0;
        periodInterest = 0;
        periodWRate    = 0;
        periodDays     = 0;
        break;
      }
    }
    currentDate = evDate;
  }

  const avgRate = totalDays > 0 ? totalWRate / totalDays : 0;

  return {
    summary: {
      totalAcquisition:  round(totalAcq, 2),
      totalProjectCosts: round(totalCosts, 2),
      totalInterest:     round(totalInterest, 2),
      totalAllIn:        round(totalAcq + totalCosts + totalInterest, 2),
      peakDebt:          round(peakDebt, 2),
      averageRate:       round(avgRate * 100, 4),
      periodsCount:      schedule.length,
      currency,
    },
    schedule,
  };
}

export { round };
