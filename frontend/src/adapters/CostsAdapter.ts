/**
 * CostsAdapter – Frontend Interfaces & Dummy-Adapter
 * ────────────────────────────────────────────────────
 * Definiert die Vertrags-Interfaces für die beiden Datenquellen der
 * Finanzierungsberechnung. Der DummyAdapter liefert synthetische Testdaten
 * und kann durch echte API-Aufrufe ersetzt werden.
 *
 * TODO: DummyAdapter durch einen echten ApiAdapter ersetzen, der
 *       GET /api/v1/projects/:id/finance/... aufruft, sobald die
 *       Backend-Endpunkte in Produktion sind.
 */

import type { CostItem } from '../domain/finance/VariableInterestEngine';

// ── Interfaces ────────────────────────────────────────────────────────────────

/** Rückgabewert von getAcquisitionData() */
export interface AcquisitionData {
  purchasePrice: number;
  acquisitionDate: Date;
  /** Erwerbsnebenkosten als Prozentsatz, z.B. 9.0 für 9 % */
  acquisitionFeesPct?: number;
  /** Oder als Festbetrag */
  acquisitionFeesFixed?: number;
}

/** Adapter-Interface – alle Implementierungen müssen dies erfüllen */
export interface ICostsAdapter {
  /**
   * Gibt Ankaufsdaten zurück oder null wenn noch nicht konfiguriert.
   * @param projectId MongoDB ObjectId als String
   */
  getAcquisitionData(projectId: string): Promise<AcquisitionData | null>;

  /**
   * Gibt die Projektkosten als zeitlich geordnete Liste zurück.
   * Jeder Eintrag repräsentiert einen Abruf/Zahlungstermin.
   * @param projectId MongoDB ObjectId als String
   */
  getProjectCostItems(projectId: string): Promise<CostItem[]>;
}

// ── Dummy-Adapter (Testdaten für Beispiel-Case 1) ────────────────────────────

/**
 * Liefert synthetische Testdaten entsprechend Beispiel-Case 1:
 *  - Kauf 1.000.000 €, Nebenkosten 9 %, Erwerb 15.01.2026
 *  - Projektkosten 600.000 € in 12 gleichen Monatsraten ab 01.02.2026
 *
 * TODO: Diesen Adapter durch ApiCostsAdapter ersetzen.
 */
export class DummyCostsAdapter implements ICostsAdapter {
  async getAcquisitionData(_projectId: string): Promise<AcquisitionData> {
    return {
      purchasePrice:     1_000_000,
      acquisitionDate:   new Date('2026-01-15'),
      acquisitionFeesPct: 9.0,
    };
  }

  async getProjectCostItems(_projectId: string): Promise<CostItem[]> {
    const items: CostItem[] = [];
    for (let i = 0; i < 12; i++) {
      const date = new Date(2026, 1 + i, 1); // Feb 2026 – Jan 2027
      items.push({
        id:          `dummy-cost-${i}`,
        date,
        amount:      50_000,
        type:        'renovation',
        description: `Sanierungskosten Monat ${i + 1}`,
      });
    }
    return items;
  }
}

// ── API-Adapter (Platzhalter – verbindet sich mit dem Backend) ────────────────

/**
 * Echter Adapter, der die gespeicherten FinanceParams und die aggregierten
 * Projektkosten vom Backend lädt.
 *
 * TODO: Implementieren sobald die Backend-Routen erreichbar sind.
 *       (Aktuell werden die Params direkt im FinancePage-State gehalten
 *        und über POST /finance/params berechnet.)
 */
export class ApiCostsAdapter implements ICostsAdapter {
  constructor(private baseUrl: string, private token: string) {}

  async getAcquisitionData(projectId: string): Promise<AcquisitionData | null> {
    // TODO: GET /api/v1/projects/:projectId/finance/params
    const res = await fetch(`${this.baseUrl}/api/v1/projects/${projectId}/finance/params`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const fp = json.data;
    return {
      purchasePrice:       fp.purchasePrice,
      acquisitionDate:     new Date(fp.acquisitionDate),
      acquisitionFeesPct:  fp.acquisitionFeesPct,
      acquisitionFeesFixed: fp.acquisitionFeesFixed,
    };
  }

  async getProjectCostItems(projectId: string): Promise<CostItem[]> {
    // TODO: Dedizierter Endpunkt GET /api/v1/projects/:projectId/finance/costItems
    //       oder Ableitung aus der bestehenden Kostenkalkulation.
    //       Aktuell liefert das Backend die costItems intern im Controller.
    console.warn(`ApiCostsAdapter.getProjectCostItems(${projectId}) – nicht implementiert, gibt [] zurück`);
    return [];
  }
}
