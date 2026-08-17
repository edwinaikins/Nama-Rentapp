import { RentRatesSetting } from "../types";

/**
 * Calculates or retrieves the standard centralized rent rate for an asset or application sub-type.
 * All stores have 1 amount and so do all sheds.
 */
export function getCentralRentRate(subType: string | undefined, rentRates: RentRatesSetting | null | undefined): number {
  if (!subType) return 150;
  const cleanType = subType.trim().toLowerCase();
  if (cleanType === "store" || cleanType === "market store") {
    return rentRates?.storeRentRate ?? 150;
  }
  if (cleanType === "shed" || cleanType === "stall" || cleanType === "market shed") {
    return rentRates?.shedRentRate ?? 80;
  }
  if (cleanType.includes("ground") || cleanType.includes("assembly ground") || cleanType.includes("container plot")) {
    return rentRates?.groundsRentRate ?? 100;
  }
  return 150; // Standard default fallback
}
