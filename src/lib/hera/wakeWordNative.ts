import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

export type HeraWakeWordPlugin = {
  isAvailable(): Promise<{ available: boolean; engine: string }>;
  start(options: { phrase: string }): Promise<void>;
  stop(): Promise<void>;
  addListener(
    eventName: "wake",
    listenerFunc: (event: { phrase: string; remainder?: string }) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: "error",
    listenerFunc: (event: { message: string }) => void,
  ): Promise<PluginListenerHandle>;
};

/**
 * Native Android on-device wake-word engine.
 * Audio for this listener must stay on-device — never POST mic audio to SyNexus.
 */
export const HeraWakeWordNative = registerPlugin<HeraWakeWordPlugin>("HeraWakeWord");
