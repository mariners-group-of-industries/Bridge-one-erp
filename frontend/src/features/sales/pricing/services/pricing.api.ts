import { apiRequest } from "@/lib/api/client";
import type { PricingQuery, PricingResult, ReturnRates, ReturnRatesQuery } from "../schemas/pricing.schema";

export const fetchPricing = (query: PricingQuery) => apiRequest<PricingResult>("/api/sales/pricing", { method: "POST", body: JSON.stringify(query) });

export const fetchReturnRates = (query: ReturnRatesQuery) =>
  apiRequest<ReturnRates[]>("/api/sales/pricing/return-rates", { method: "POST", body: JSON.stringify(query) });
