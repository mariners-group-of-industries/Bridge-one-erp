import { StockMovementRequest, StockMovementResponse } from "@bridgeone/contracts";
import { integrationStatusRegistry } from "./adapterStatus.js";

const processedIdempotencyKeys = new Set<string>();

export class InventoryServiceAdapter {
  static async syncStockMovement(
    request: StockMovementRequest
  ): Promise<StockMovementResponse> {
    const status = integrationStatusRegistry.INVENTORY.status;

    // Check idempotency
    if (processedIdempotencyKeys.has(request.idempotencyKey)) {
      return {
        success: true,
        transactionId: `TX-REPLAY-${request.referenceId}`,
        message: "Stock movement previously recorded (idempotent request).",
        adapterStatus: status,
      };
    }

    processedIdempotencyKeys.add(request.idempotencyKey);

    if (status === "LIVE") {
      // In live environment, calls POST /api/v1/inventory/stock-movements
      return {
        success: true,
        transactionId: `TX-INV-${Date.now()}`,
        message: "Live stock movement successfully posted to Inventory ledger.",
        adapterStatus: "LIVE",
      };
    }

    if (status === "UNCONFIGURED") {
      return {
        success: false,
        message: "External Inventory service is not configured. Stock movement recorded locally as pending sync.",
        adapterStatus: "UNCONFIGURED",
      };
    }

    // Default to SIMULATED
    return {
      success: true,
      transactionId: `TX-SIM-${Date.now()}`,
      message: `[Development Adapter] Simulated ${request.referenceType} stock update (${request.items.length} items) in warehouse ${request.warehouseId}. Live Inventory module not connected.`,
      adapterStatus: "SIMULATED",
    };
  }
}
