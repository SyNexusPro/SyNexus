/**
 * Which server secrets are present. Values are never returned.
 */
export type IntegrationRow = {
  service: string;
  variable: string;
  configured: boolean;
  required: boolean;
};

type Env = Record<string, string | undefined>;

function present(env: Env, ...names: string[]): boolean {
  return names.some((name) => Boolean(env[name]?.trim()));
}

export function integrationPresence(env: Env): IntegrationRow[] {
  return [
    { service: "OpenAI", variable: "OPENAI_API_KEY", configured: present(env, "OPENAI_API_KEY"), required: true },
    { service: "Supabase", variable: "SUPABASE_URL", configured: present(env, "SUPABASE_URL", "VITE_SUPABASE_URL"), required: true },
    { service: "Supabase service role", variable: "SUPABASE_SERVICE_ROLE_KEY", configured: present(env, "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"), required: true },
    { service: "Helius", variable: "HELIUS_API_KEY", configured: present(env, "HELIUS_API_KEY"), required: true },
    { service: "Jupiter", variable: "JUPITER_API_KEY", configured: present(env, "JUPITER_API_KEY"), required: false },
    { service: "Jupiter fee account", variable: "JUPITER_FEE_ACCOUNT", configured: present(env, "JUPITER_FEE_ACCOUNT", "VITE_JUPITER_FEE_ACCOUNT"), required: false },
    { service: "CoinGecko", variable: "COINGECKO_API_KEY", configured: present(env, "COINGECKO_API_KEY"), required: false },
    { service: "GoPlus", variable: "GOPLUS_APP_KEY", configured: present(env, "GOPLUS_APP_KEY"), required: false },
    { service: "RevenueCat", variable: "REVENUECAT_SECRET_API_KEY", configured: present(env, "REVENUECAT_SECRET_API_KEY"), required: false },
    { service: "Cron", variable: "CRON_SECRET", configured: present(env, "CRON_SECRET"), required: true },
    { service: "ElevenLabs", variable: "ELEVENLABS_API_KEY", configured: present(env, "ELEVENLABS_API_KEY"), required: false },
  ];
}
