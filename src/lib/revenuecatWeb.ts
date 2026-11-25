/**
 * ARCHIVED — RevenueCat Web Test Store. Kept for rollback only.
 * Production web checkout is Paddle. See src/lib/revenuecatArchive.ts.
 */
import { Purchases, type Package } from "@revenuecat/purchases-js";
import type { NativePackageId } from "./revenuecatNative";
import { isRevenueCatArchived } from "./revenuecatArchive";

const PACKAGE_KEYS: Record<NativePackageId, string> = {
  next_level_monthly: "$rc_custom_next_level_monthly",
  next_level_annual: "$rc_custom_next_level_annual",
  pantheon_monthly: "$rc_custom_pantheon_monthly",
};

const STORE_PRODUCTS: Record<NativePackageId, string> = {
  next_level_monthly: "next_level_monthly",
  next_level_annual: "next_level_annual",
  pantheon_monthly: "the_pantheon_monthly",
};

function testStoreKey(): string {
  return (import.meta.env.VITE_REVENUECAT_TEST_API_KEY || "").trim();
}

export function webTestStoreEnabled(): boolean {
  if (isRevenueCatArchived()) return false;
  return import.meta.env.VITE_REVENUECAT_USE_TEST_STORE === "true" && Boolean(testStoreKey());
}

/** ARCHIVED Test Store path. Prefer Paddle for web. */
export function webPurchasesAvailable(): boolean {
  if (isRevenueCatArchived()) return false;
  return typeof window !== "undefined" && webTestStoreEnabled();
}

export async function syncRevenueCatWebUser(userId: string | null): Promise<void> {
  if (!webPurchasesAvailable() || !userId) return;
  const apiKey = testStoreKey();
  if (Purchases.isConfigured()) {
    await Purchases.getSharedInstance().changeUser(userId);
    return;
  }
  Purchases.configure({ apiKey, appUserId: userId });
}

function matchPackage(packages: Package[], packageId: NativePackageId): Package | undefined {
  return packages.find((item) => {
    const productId = item.webBillingProduct?.identifier ?? item.rcBillingProduct?.identifier;
    return item.identifier === PACKAGE_KEYS[packageId] || productId === STORE_PRODUCTS[packageId];
  });
}

export async function listWebOfferingPackageIds(): Promise<string[]> {
  if (!webPurchasesAvailable()) return [];
  const offerings = await Purchases.getSharedInstance().getOfferings();
  return (offerings.current?.availablePackages ?? []).map((item) => {
    const productId = item.webBillingProduct?.identifier ?? item.rcBillingProduct?.identifier ?? "";
    return `${item.identifier}:${productId}`;
  });
}

export async function purchaseWebPackage(packageId: NativePackageId): Promise<void> {
  if (!webPurchasesAvailable()) {
    throw new Error("Web Test Store purchases are not enabled in this build.");
  }
  if (!Purchases.isConfigured()) {
    throw new Error("Sign in so RevenueCat can use your SyNexus account id.");
  }
  const offerings = await Purchases.getSharedInstance().getOfferings();
  const selected = matchPackage(offerings.current?.availablePackages ?? [], packageId);
  if (!selected) throw new Error("That subscription is not in the current store offering.");
  await Purchases.getSharedInstance().purchase({ rcPackage: selected });
}

export async function restoreWebPurchases(): Promise<void> {
  if (!webPurchasesAvailable() || !Purchases.isConfigured()) return;
  await Purchases.getSharedInstance().getCustomerInfo();
}
