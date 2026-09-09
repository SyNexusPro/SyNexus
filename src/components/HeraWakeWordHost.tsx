import { useHeraWakeWord } from "../hooks/useHeraWakeWord";
import { HeraWakeWordConsent } from "./HeraWakeWordConsent";

/** Runs foreground wake-word listening and the microphone disclosure. */
export function HeraWakeWordHost() {
  useHeraWakeWord();
  return <HeraWakeWordConsent />;
}
