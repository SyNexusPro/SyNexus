import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";
import {
  BiometricAuth,
  BiometryError,
  BiometryErrorType,
  BiometryType,
} from "@aparajita/capacitor-biometric-auth";

export type BiometricSupport = {
  available: boolean;
  label: string;
  biometryType: BiometryType;
  native: boolean;
  reason?: string;
};

export type BiometricVault = {
  email: string;
  refreshToken: string;
  enabledAt: number;
};

const VAULT_KEY = "synexus_biometric_vault";
const ENABLED_KEY = "synexus_biometric_enabled";

export type BiometricEnrollResult = "enrolled" | "already" | "unavailable" | "cancelled" | "failed";

function biometryLabel(type: BiometryType): string {
  switch (type) {
    case BiometryType.faceId:
    case BiometryType.faceAuthentication:
      return "Face ID";
    case BiometryType.touchId:
      return "Touch ID";
    case BiometryType.fingerprintAuthentication:
      return "Fingerprint";
    case BiometryType.irisAuthentication:
      return "Iris scan";
    default:
      return "Biometrics";
  }
}

export async function getBiometricSupport(): Promise<BiometricSupport> {
  const native = Capacitor.isNativePlatform();
  if (!native) {
    return {
      available: false,
      label: "Biometrics",
      biometryType: BiometryType.none,
      native: false,
      reason: "Use the SyNexus mobile app for Face ID or fingerprint sign-in.",
    };
  }

  try {
    const result = await BiometricAuth.checkBiometry();
    return {
      available: result.isAvailable,
      label: biometryLabel(result.biometryType),
      biometryType: result.biometryType,
      native: true,
      reason: result.isAvailable ? undefined : result.reason || result.code,
    };
  } catch {
    return {
      available: false,
      label: "Biometrics",
      biometryType: BiometryType.none,
      native: true,
      reason: "Biometric check failed on this device.",
    };
  }
}

export async function promptBiometric(reason: string): Promise<void> {
  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: "Cancel",
      androidTitle: "SyNexus",
      androidSubtitle: reason,
      allowDeviceCredential: true,
    });
  } catch (err) {
    if (err instanceof BiometryError) {
      if (
        err.code === BiometryErrorType.userCancel ||
        err.code === BiometryErrorType.systemCancel ||
        err.code === BiometryErrorType.appCancel
      ) {
        throw new Error("Biometric sign-in cancelled.");
      }
    }
    throw err instanceof Error ? err : new Error("Biometric verification failed.");
  }
}

async function saveVault(vault: BiometricVault): Promise<void> {
  await SecureStoragePlugin.set({ key: VAULT_KEY, value: JSON.stringify(vault) });
  await Preferences.set({ key: ENABLED_KEY, value: "1" });
}

async function loadVault(): Promise<BiometricVault | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { value } = await SecureStoragePlugin.get({ key: VAULT_KEY });
    if (!value) return null;
    const parsed = JSON.parse(value) as BiometricVault;
    if (!parsed.email || !parsed.refreshToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function isBiometricLoginEnabled(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { value } = await Preferences.get({ key: ENABLED_KEY });
    if (value !== "1") return false;
    const vault = await loadVault();
    return Boolean(vault?.refreshToken);
  } catch {
    return false;
  }
}

export async function getBiometricLoginEmailHint(): Promise<string | null> {
  const vault = await loadVault();
  return vault?.email ?? null;
}

export async function enableBiometricLogin(email: string, refreshToken: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Biometric login is available in the SyNexus mobile app.");
  }
  const support = await getBiometricSupport();
  if (!support.available) {
    throw new Error(`${support.label} is not set up on this device.`);
  }
  await promptBiometric(`Enable ${support.label} sign-in for SyNexus`);
  await saveVault({
    email: email.trim().toLowerCase(),
    refreshToken,
    enabledAt: Date.now(),
  });
}

export async function loadBiometricRefreshToken(): Promise<BiometricVault | null> {
  const support = await getBiometricSupport();
  if (!support.available) {
    throw new Error(`${support.label} is not available on this device.`);
  }
  await promptBiometric(`Sign in to SyNexus with ${support.label}`);
  return loadVault();
}

export async function clearBiometricLogin(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await SecureStoragePlugin.remove({ key: VAULT_KEY });
    }
    await Preferences.remove({ key: ENABLED_KEY });
  } catch {
    /* ignore */
  }
}

export async function refreshBiometricVaultToken(email: string, refreshToken: string): Promise<void> {
  if (!(await isBiometricLoginEnabled())) return;
  if (!Capacitor.isNativePlatform()) return;
  const existing = await loadVault();
  await saveVault({
    email,
    refreshToken,
    enabledAt: existing?.enabledAt ?? Date.now(),
  });
}

/** Prompt once after a successful email login to save biometrics for next time. */
export async function enrollBiometricAfterLogin(
  email: string,
  refreshToken: string,
): Promise<BiometricEnrollResult> {
  if (!Capacitor.isNativePlatform()) return "unavailable";

  const support = await getBiometricSupport();
  if (!support.available) return "unavailable";
  if (await isBiometricLoginEnabled()) return "already";

  try {
    await enableBiometricLogin(email, refreshToken);
    return "enrolled";
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("cancelled")) return "cancelled";
    return "failed";
  }
}
