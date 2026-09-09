/** Named module for the Hera wake-word stack — reuses the existing on-device listener. */
export {
  armHeraWakeLaunch,
  closeHeraWakeConsent,
  consumeHeraWakeLaunch,
  enableHeraWakeWordFromUi,
  getHeraWakePermission,
  hasHeraWakeConsent,
  isHeraWakeConsentOpen,
  isHeraWakeEnabled,
  isNativeAndroidWakeEngine,
  launchHeraFromWake,
  matchWakePhrase,
  isWakeOnlyUtterance,
  notifyHeraWakeChanged,
  openHeraWakeConsent,
  peekHeraWakeLaunch,
  probeMicrophonePermission,
  requestMicrophoneAccess,
  setHeraWakeConsent,
  setHeraWakeEnabled,
  setHeraWakePermission,
} from "./wakeWord";

export type { HeraWakeLaunch, HeraWakePermission, WakeMatch } from "./wakeWord";

export { HERA_WAKE_PHRASE, HERA_WAKE_ALIASES } from "../../config/heraWakeWord";
