/**
 * ARCHIVED — RevenueCat native purchases. Kept for rollback only.
 * Web billing is Paddle. See src/lib/revenuecatArchive.ts.
 */
import { Capacitor } from "@capacitor/core";
import { Purchases, PURCHASES_ERROR_CODE } from "@revenuecat/purchases-capacitor";
import { isRevenueCatArchived } from "./revenuecatArchive";

const NEXT_LEVEL_MONTHLY = "$rc_custom_next_level_monthly";
const NEXT_LEVEL_ANNUAL = "$rc_custom_next_level_annual";
const PANTHEON_MONTHLY = "$rc_custom_pantheon_monthly";

export type NativePackageId = "next_level_monthly" | "next_level_annual" | "pantheon_monthly";

const PACKAGE_KEYS: Record<NativePackageId, string> = {
  next_level_monthly: NEXT_LEVEL_MONTHLY,
  next_level_annual: NEXT_LEVEL_ANNUAL,
  pantheon_monthly: PANTHEON_MONTHLY,
};

const STORE_PRODUCTS: Record<NativePackageId, string> = {
  next_level_monthly: "next_level_monthly",
  next_level_annual: "next_level_annual",
  pantheon_monthly: "the_pantheon_monthly",
};

function publicSdkKey(): string {
  const useTestStore = String(import.meta.env.VITE_REVENUECAT_USE_TEST_STORE || "").trim().toLowerCase() === "true";
  const testKey = (import.meta.env.VITE_REVENUECAT_TEST_API_KEY || "").trim();
  const liveKey = (import.meta.env.VITE_REVENUECAT_API_KEY || "").trim();
  // Never prefer the Test Store key unless the explicit test flag is on.
  if (useTestStore && testKey) return testKey;
  return liveKey || testKey;
}

export function nativePurchasesAvailable(): boolean {
  if (isRevenueCatArchived()) return false;
  return Capacitor.isNativePlatform() && Boolean(publicSdkKey());
}

export async function syncRevenueCatUser(userId: string | null): Promise<void> {
  if (isRevenueCatArchived() || !nativePurchasesAvailable()) return;
  const apiKey = publicSdkKey();
  if (!userId) {
    await Purchases.configure({ apiKey });
    return;
  }
  await Purchases.configure({ apiKey, appUserID: userId });
  await Purchases.logIn({ appUserID: userId });
}

export async function purchaseNativePackage(packageId: NativePackageId): Promise<void> {
  if (!nativePurchasesAvailable()) throw new Error("Store purchases are available in the iOS and Android app.");
  const offerings = await Purchases.getOfferings();
  const packages = offerings.current?.availablePackages ?? [];
  const selected = packages.find((item) => {
    const productId = (item as { product?: { identifier?: string } }).product?.identifier;
    return item.identifier === PACKAGE_KEYS[packageId] || productId === STORE_PRODUCTS[packageId];
  });
  if (!selected) throw new Error("That subscription is not in the current store offering.");
  await Purchases.purchasePackage({ aPackage: selected });
}

export async function restoreNativePurchases(): Promise<void> {
  if (!nativePurchasesAvailable()) return;
  await Purchases.restorePurchases();
}

export function purchaseErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return "Purchase cancelled.";
  if (error instanceof Error && error.message) return error.message;
  return "The store could not complete that purchase.";
}
