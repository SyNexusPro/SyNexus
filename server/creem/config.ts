export type CreemEnv = {
  CREEM_API_KEY?: string;
  CREEM_PRODUCT_ID_PRO?: string;
  CREEM_WEBHOOK_SECRET?: string;
  VITE_APP_URL?: string;
};

export function resolveCreemApiBase(apiKey: string): string {
  return apiKey.startsWith("creem_test_") ? "https://test-api.creem.io" : "https://api.creem.io";
}

export function readCreemConfig(env: CreemEnv) {
  const apiKey = env.CREEM_API_KEY?.trim() ?? "";
  const productIdPro = env.CREEM_PRODUCT_ID_PRO?.trim() ?? "";
  const webhookSecret = env.CREEM_WEBHOOK_SECRET?.trim() ?? "";
  return {
    apiKey,
    productIdPro,
    webhookSecret,
    apiBase: apiKey ? resolveCreemApiBase(apiKey) : "",
  };
}
