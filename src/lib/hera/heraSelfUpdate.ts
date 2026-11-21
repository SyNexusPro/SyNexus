import { isOwnerScreen } from "../ownerScreen";

const CHECK_MS = 45_000;

function bundleFrom(htmlOrSrc: string): string {
  return htmlOrSrc.match(/\/assets\/index-[^"]+\.js/)?.[0] ?? "";
}

function currentBundle(): string {
  const node = document.querySelector('script[src*="/assets/index-"]');
  return bundleFrom(node?.getAttribute("src") ?? "");
}

/**
 * The owner phone loads Hera from the live site. When a new build is published,
 * reload it. No prompt and no cable.
 */
export function watchHeraSelfUpdate(): () => void {
  if (!isOwnerScreen()) return () => undefined;
  let current = currentBundle();
  let stopped = false;

  const check = async () => {
    if (stopped) return;
    try {
      const response = await fetch("/owner/hera", { cache: "no-store" });
      if (!response.ok) return;
      const next = bundleFrom(await response.text());
      if (!next) return;
      if (!current) {
        current = next;
        return;
      }
      if (next !== current) {
        if (sessionStorage.getItem("hera-build") === next) return;
        sessionStorage.setItem("hera-build", next);
        location.replace("/owner/hera");
      }
    } catch {
      /* A failed check leaves the live conversation alone. */
    }
  };

  const timer = window.setInterval(() => void check(), CHECK_MS);
  void check();
  return () => {
    stopped = true;
    window.clearInterval(timer);
  };
}
