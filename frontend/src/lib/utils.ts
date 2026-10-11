export { cn } from "./cn";

export function formatCurrency(amount: number, currency: string = "BDT") {
  return `${currency} ${(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
