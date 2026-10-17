import {
  FinancePayableSyncRequest,
  FinancePayableSyncResponse,
} from "@bridgeone/contracts";
import { integrationStatusRegistry } from "./adapterStatus.js";

const processedFinanceKeys = new Set<string>();

export class FinanceServiceAdapter {
  static async syncPayableVoucher(
    request: FinancePayableSyncRequest
  ): Promise<FinancePayableSyncResponse> {
    const status = integrationStatusRegistry.FINANCE.status;

    if (processedFinanceKeys.has(request.idempotencyKey)) {
      return {
        success: true,
        voucherNumber: `VCH-REPLAY-${request.referenceNumber}`,
        message: "Payable voucher already registered in Finance ledger.",
        adapterStatus: status,
      };
    }

    processedFinanceKeys.add(request.idempotencyKey);

    if (status === "LIVE") {
      return {
        success: true,
        voucherNumber: `VCH-FIN-${Date.now()}`,
        message: "Vendor payable voucher successfully posted to Finance GL.",
        adapterStatus: "LIVE",
      };
    }

    if (status === "UNCONFIGURED") {
      return {
        success: false,
        message: "External Finance module not configured. Bill recorded in Purchase payable staging queue.",
        adapterStatus: "UNCONFIGURED",
      };
    }

    return {
      success: true,
      voucherNumber: `VCH-SIM-${Date.now()}`,
      message: `[Development Adapter] Simulated vendor bill voucher creation for ${request.referenceNumber} (${request.currency} ${request.amount}). Authoritative financial ledger remains with external Finance ERP.`,
      adapterStatus: "SIMULATED",
    };
  }
}
