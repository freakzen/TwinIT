
import type { BusinessProfile } from "./business";

const STORAGE_KEY = "twinit-business-profile";

export function saveBusiness(business: BusinessProfile): void {
  if (typeof window === "undefined") return;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(business));
}

export function getBusiness(): BusinessProfile | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) return null;

  try {
    return JSON.parse(stored) as BusinessProfile;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function deleteBusiness(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
