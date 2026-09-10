/** Google Analytics 4 — public measurement ID (override via VITE_GA_MEASUREMENT_ID). */
export const GA_MEASUREMENT_ID =
  (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim() || "G-N7W1GFMFC2";
