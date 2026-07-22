const SQUARE_HEADERS = { "Square-Version": "2026-05-20", "Content-Type": "application/json" };

function looksLikeWebhookId(value: string): boolean {
  return /^wbhk_/i.test(value);
}

function looksLikeCatalogId(value: string): boolean {
  return value.length >= 20 && /^[A-Z0-9]+$/i.test(value);
}

type CatalogObject = {
  id?: string;
  type?: string;
  item_variation_data?: { item_id?: string; name?: string; sku?: string };
  item_data?: { name?: string };
  subscription_plan_data?: {
    name?: string;
    subscription_plan_variations?: { id?: string; subscription_plan_variation_data?: { name?: string } }[];
  };
};

type CatalogSearchResponse = {
  objects?: CatalogObject[];
  errors?: { detail?: string; code?: string }[];
};

type CatalogListResponse = {
  objects?: CatalogObject[];
};

async function squareFetch(
  apiBase: string,
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...SQUARE_HEADERS,
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
}

async function searchCatalogBySku(
  apiBase: string,
  accessToken: string,
  sku: string,
  objectTypes: string[],
): Promise<CatalogObject | null> {
  const response = await squareFetch(apiBase, accessToken, "/v2/catalog/search", {
    method: "POST",
    body: JSON.stringify({
      object_types: objectTypes,
      query: {
        exact_query: {
          attribute_name: "sku",
          attribute_value: sku,
        },
      },
    }),
  });

  const data = (await response.json()) as CatalogSearchResponse;
  if (!response.ok) return null;
  return data.objects?.[0] ?? null;
}

async function getCatalogObject(
  apiBase: string,
  accessToken: string,
  objectId: string,
): Promise<CatalogObject | null> {
  const response = await squareFetch(
    apiBase,
    accessToken,
    `/v2/catalog/object/${encodeURIComponent(objectId)}`,
  );
  const data = (await response.json()) as { object?: CatalogObject };
  if (!response.ok) return null;
  return data.object ?? null;
}

async function listSubscriptionPlans(
  apiBase: string,
  accessToken: string,
): Promise<CatalogObject[]> {
  const response = await squareFetch(
    apiBase,
    accessToken,
    "/v2/catalog/list?types=SUBSCRIPTION_PLAN",
  );
  const data = (await response.json()) as CatalogListResponse;
  if (!response.ok) return [];
  return data.objects ?? [];
}

function firstSubscriptionVariationId(plan: CatalogObject): string | null {
  const variations = plan.subscription_plan_data?.subscription_plan_variations ?? [];
  return variations[0]?.id ?? null;
}

async function subscriptionVariationForItemName(
  apiBase: string,
  accessToken: string,
  itemName: string,
): Promise<string | null> {
  const normalized = itemName.trim().toLowerCase();
  if (!normalized) return null;

  const plans = await listSubscriptionPlans(apiBase, accessToken);
  for (const plan of plans) {
    const planName = plan.subscription_plan_data?.name?.trim().toLowerCase() ?? "";
    if (planName === normalized) {
      return firstSubscriptionVariationId(plan);
    }
  }
  return null;
}

async function resolveSkuToSubscriptionVariation(
  apiBase: string,
  accessToken: string,
  sku: string,
): Promise<string | null> {
  const subscriptionVariation = await searchCatalogBySku(apiBase, accessToken, sku, [
    "SUBSCRIPTION_PLAN_VARIATION",
  ]);
  if (subscriptionVariation?.id) return subscriptionVariation.id;

  const itemVariation = await searchCatalogBySku(apiBase, accessToken, sku, ["ITEM_VARIATION"]);
  if (!itemVariation?.id) return null;

  const itemId = itemVariation.item_variation_data?.item_id;
  if (!itemId) return null;

  const item = await getCatalogObject(apiBase, accessToken, itemId);
  const itemName = item?.item_data?.name;
  if (!itemName) return null;

  return subscriptionVariationForItemName(apiBase, accessToken, itemName);
}

/**
 * Square Payment Links expect a catalog subscription plan variation ID.
 * SKU (e.g. SyNexusPro) may live on the item — we map to the matching subscription plan.
 */
export async function resolvePlanVariationId(
  apiBase: string,
  accessToken: string,
  rawValue: string,
): Promise<{ id: string | null; source: "catalog_id" | "sku_lookup" | "invalid_webhook_id" | "empty" }> {
  const value = rawValue.trim();
  if (!value) return { id: null, source: "empty" };
  if (looksLikeWebhookId(value)) return { id: null, source: "invalid_webhook_id" };
  if (looksLikeCatalogId(value)) return { id: value, source: "catalog_id" };

  const fromSku = await resolveSkuToSubscriptionVariation(apiBase, accessToken, value);
  if (fromSku) return { id: fromSku, source: "sku_lookup" };

  return { id: value, source: "sku_lookup" };
}

export { looksLikeWebhookId };
