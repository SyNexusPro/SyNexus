export type SquareEnv = {
  SQUARE_USE_SANDBOX?: string;
  SQUARE_ACCESS_TOKEN?: string;
  SQUARE_LOCATION_ID?: string;
  SQUARE_SANDBOX_ACCESS_TOKEN?: string;
  SQUARE_SANDBOX_LOCATION_ID?: string;
  SQUARE_PLAN_VARIATION_ID_PRO?: string;
  SQUARE_ITEM_VARIATION_ID_PRO?: string;
  SQUARE_API_BASE?: string;
  SQUARE_WEBHOOK_SIGNATURE_KEY?: string;
  SQUARE_WEBHOOK_NOTIFICATION_URL?: string;
  VITE_APP_URL?: string;
};

function useSandbox(env: SquareEnv): boolean {
  const flag = env.SQUARE_USE_SANDBOX?.trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  const base = env.SQUARE_API_BASE?.trim().toLowerCase() ?? "";
  return base.includes("squareupsandbox.com");
}

function looksLikeApplicationId(value: string): boolean {
  return /^sandbox-sq0id[bp]-/i.test(value) || /^sq0id[bp]-/i.test(value);
}

export function readSquareConfig(env: SquareEnv) {
  const sandbox = useSandbox(env);
  const sandboxToken = env.SQUARE_SANDBOX_ACCESS_TOKEN?.trim() ?? "";
  const productionToken = env.SQUARE_ACCESS_TOKEN?.trim() ?? "";
  const accessToken = sandbox ? sandboxToken || productionToken : productionToken || sandboxToken;
  const locationId = (
    sandbox
      ? env.SQUARE_SANDBOX_LOCATION_ID?.trim() || env.SQUARE_LOCATION_ID?.trim()
      : env.SQUARE_LOCATION_ID?.trim() || env.SQUARE_SANDBOX_LOCATION_ID?.trim()
  ) ?? "";

  const explicitBase = env.SQUARE_API_BASE?.trim();
  const apiBase = (
    explicitBase ||
    (sandbox ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com")
  ).replace(/\/$/, "");

  return {
    sandbox,
    accessToken,
    locationId,
    planVariationIdPro:
      env.SQUARE_PLAN_VARIATION_ID_PRO?.trim() ||
      env.SQUARE_ITEM_VARIATION_ID_PRO?.trim() ||
      "",
    apiBase,
    webhookSignatureKey: env.SQUARE_WEBHOOK_SIGNATURE_KEY?.trim() ?? "",
    webhookNotificationUrl: env.SQUARE_WEBHOOK_NOTIFICATION_URL?.trim() ?? "",
    appUrl: env.VITE_APP_URL?.trim() ?? "",
    tokenLooksLikeApplicationId: looksLikeApplicationId(accessToken),
  };
}

export function isSquareConfigured(env: SquareEnv): boolean {
  const { accessToken, locationId, planVariationIdPro, tokenLooksLikeApplicationId } =
    readSquareConfig(env);
  return Boolean(
    accessToken && !tokenLooksLikeApplicationId && locationId && planVariationIdPro,
  );
}
