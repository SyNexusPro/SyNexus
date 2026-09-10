import { lazy, type ComponentType, type LazyExoticComponent } from "react";

type ModuleDefault<T> = { default: T };

/**
 * Retry lazy route chunks once — fixes "Something went wrong" after deploy when
 * the browser still has an old index.html pointing at removed asset files.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  importer: () => Promise<ModuleDefault<T>>,
  label = "screen",
): LazyExoticComponent<T> {
  return lazy(async () => {
    const refreshed = sessionStorage.getItem("synexus_chunk_retry") === "1";
    try {
      const mod = await importer();
      sessionStorage.removeItem("synexus_chunk_retry");
      return mod;
    } catch (error) {
      if (!refreshed) {
        sessionStorage.setItem("synexus_chunk_retry", "1");
        window.location.reload();
        await new Promise<void>(() => {
          /* reload in flight */
        });
      }
      console.error(`SyNexus failed to load ${label} chunk`, error);
      throw error;
    }
  });
}
