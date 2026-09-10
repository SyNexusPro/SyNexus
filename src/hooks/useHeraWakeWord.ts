import { useEffect, useRef } from "react";
import { HERA_WAKE_PHRASE } from "../config/heraWakeWord";
import { useAppIsActive } from "./useAppIsActive";
import { useTitanChatOpen } from "./useTitanChatOpen";
import { useTitanLoginOpen } from "./useTitanChatOpen";
import { useHeraWakeWordSetting } from "./useHeraWakeWordSetting";
import {
  isNativeAndroidWakeEngine,
  launchHeraFromWake,
  requestMicrophoneAccess,
} from "../lib/hera/wakeWord";
import { isWebWakeWordSupported, startWebWakeWord } from "../lib/hera/wakeWordWeb";
import { HeraWakeWordNative } from "../lib/hera/wakeWordNative";
import { unlockTitanSpeech } from "../lib/titanVoice";

/**
 * Foreground wake-word host. Inactive until Listen is on and Hera is closed.
 * Does not stream microphone audio to SyNexus servers.
 */
export function useHeraWakeWord() {
  const { enabled, setPermission } = useHeraWakeWordSetting();
  const heraOpen = useTitanChatOpen();
  const loginOpen = useTitanLoginOpen();
  const appActive = useAppIsActive();
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      stopRef.current?.();
      stopRef.current = null;

      if (!enabled || heraOpen || loginOpen || !appActive) return;
      if (typeof document !== "undefined" && document.hidden) return;

      unlockTitanSpeech();

      if (isNativeAndroidWakeEngine()) {
        try {
          const avail = await HeraWakeWordNative.isAvailable();
          if (cancelled) return;
          if (!avail.available) {
            setPermission("unsupported");
            return;
          }
          const wakeHandle = await HeraWakeWordNative.addListener("wake", (event) => {
            launchHeraFromWake(event.remainder ?? "");
          });
          const errHandle = await HeraWakeWordNative.addListener("error", (event) => {
            if (/permission|not allowed|denied/i.test(event.message)) setPermission("denied");
          });
          await HeraWakeWordNative.start({ phrase: HERA_WAKE_PHRASE });
          if (cancelled) {
            await HeraWakeWordNative.stop();
            await wakeHandle.remove();
            await errHandle.remove();
            return;
          }
          setPermission("granted");
          stopRef.current = () => {
            void HeraWakeWordNative.stop();
            void wakeHandle.remove();
            void errHandle.remove();
          };
          return;
        } catch {
          /* fall through to web engine */
        }
      }

      if (!isWebWakeWordSupported()) {
        setPermission("unsupported");
        return;
      }

      const mic = await requestMicrophoneAccess();
      if (cancelled) return;
      setPermission(mic);
      if (mic !== "granted") return;

      const handle = startWebWakeWord({
        onWake: (remainder) => launchHeraFromWake(remainder),
        onError: (message) => {
          if (/permission/i.test(message)) setPermission("denied");
        },
      });
      stopRef.current = handle.stop;
    }

    void start();
    return () => {
      cancelled = true;
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [appActive, enabled, heraOpen, loginOpen, setPermission]);
}
