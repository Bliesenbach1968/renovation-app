/**
 * Finance API Client
 * ──────────────────
 * Alle API-Aufrufe für das Finanzierungsmodul.
 * Verbindet sich mit den Backend-Routen unter /api/v1/projects/:id/finance/
 */

import client from './client';
import type { FinanceSummary, SchedulePeriod } from '../domain/finance/VariableInterestEngine';

// ── Typen ────────────────────────────────────────────────────────────────────

export interface StaffelEntryDto {
  startDate: string; // ISO-String
  annualRate: number;
}

export interface IndexMarginEntryDto {
  startDate: string;
  indexName: string;
  indexRate: number;
  margin: number;
  floor?: number;
}

export interface AmortizationEntryDto {
  startDate: string;
  amount?: number;
  pct?: number;
  frequency: 'monthly' | 'quarterly' | 'annual';
}

/** Entspricht dem FinanceParams-Mongoose-Modell */
export interface FinanceParamsDto {
  _id?: string;
  projectId?: string;
  acquisitionDate: string;
  purchasePrice: number;
  acquisitionFeesPct?: number | null;
  acquisitionFeesFixed?: number | null;
  acquisitionFeesLump?: number | null;
  rateModelType: 'staffel' | 'indexMargin';
  staffelSchedule: StaffelEntryDto[];
  indexMarginEntries: IndexMarginEntryDto[];
  dayCount: 'ACT/360' | 'ACT/365' | '30E/360';
  interestMode: 'capitalize' | 'payMonthly';
  lagDays: number;
  currency: string;
  amortizationPlan: AmortizationEntryDto[];
  calcEndDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FinanceCalculationResult {
  params: FinanceParamsDto;
  costItemsCount: number;
  summary: FinanceSummary;
  schedule: SchedulePeriod[];
}

// ── API-Funktionen ────────────────────────────────────────────────────────────

/**
 * Gespeicherte Finanzierungsparameter laden.
 * Wirft 404 wenn noch keine Parameter angelegt wurden.
 */
export const getFinanceParams = async (projectId: string): Promise<FinanceParamsDto> => {
  const { data } = await client.get(`/projects/${projectId}/finance/params`);
  return data.data as FinanceParamsDto;
};

/**
 * Parameter speichern und sofort neu berechnen.
 * Gibt params + summary + schedule zurück.
 */
export const saveFinanceParams = async (
  projectId: string,
  params: Partial<FinanceParamsDto>
): Promise<FinanceCalculationResult> => {
  const { data } = await client.post(`/projects/${projectId}/finance/params`, params);
  return data.data as FinanceCalculationResult;
};

/**
 * Nur die Zusammenfassung abrufen (aus gespeicherten Parametern berechnet).
 */
export const getFinanceSummary = async (projectId: string): Promise<FinanceSummary> => {
  const { data } = await client.get(`/projects/${projectId}/finance/summary`);
  return data.data as FinanceSummary;
};

/**
 * Nur den Zinsplan abrufen (aus gespeicherten Parametern berechnet).
 */
export const getFinanceSchedule = async (projectId: string): Promise<SchedulePeriod[]> => {
  const { data } = await client.get(`/projects/${projectId}/finance/schedule`);
  return data.data as SchedulePeriod[];
};
