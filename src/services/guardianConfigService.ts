import type { DeepPartial, GuardianEngineConfig } from "../data/guardianEngine";

export async function loadGuardianConfigOverride(): Promise<
  DeepPartial<GuardianEngineConfig> | undefined
> {
  try {
    const response = await fetch("/guardian-config.json", { cache: "no-store" });
    if (!response.ok) return undefined;
    const data = (await response.json()) as DeepPartial<GuardianEngineConfig>;
    return data;
  } catch {
    return undefined;
  }
}
