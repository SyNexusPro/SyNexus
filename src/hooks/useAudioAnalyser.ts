import { useEffect, useState } from "react";
import { heraRealtimeController } from "../lib/hera/HeraRealtimeController";

/** Smoothed outgoing-speech amplitude for Hera's mouth. Does not own the audio graph. */
export function useAudioAnalyser() {
  const [mouthOpen, setMouthOpen] = useState(0);
  useEffect(() => {
    return heraRealtimeController.subscribe({
      onMouthOpen: setMouthOpen,
    });
  }, []);
  return mouthOpen;
}
