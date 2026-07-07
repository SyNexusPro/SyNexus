export const ORACLE_OPEN_LOGIN_EVENT = "synexus-oracle-open-login";
export const TITAN_GATE_OPEN_FLAG = "synexus_open_titan_gate";

export function markTitanGateOpenIntent(): void {
  try {
    sessionStorage.setItem(TITAN_GATE_OPEN_FLAG, "1");
  } catch {
    /* private mode / quota */
  }
}

export function consumeTitanGateOpenIntent(): boolean {
  try {
    const shouldOpen = sessionStorage.getItem(TITAN_GATE_OPEN_FLAG) === "1";
    if (shouldOpen) sessionStorage.removeItem(TITAN_GATE_OPEN_FLAG);
    return shouldOpen;
  } catch {
    return false;
  }
}

export function hasTitanGateOpenIntent(): boolean {
  try {
    return sessionStorage.getItem(TITAN_GATE_OPEN_FLAG) === "1";
  } catch {
    return false;
  }
}

export function scrollTitanGateIntoView(): void {
  requestAnimationFrame(() => {
    document.getElementById("oracle-admin")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

/** Open the Titan gate on the current Pulse page (hash + event + scroll). */
export function openTitanGateInPlace(): void {
  window.location.hash = "#oracle-admin";
  window.dispatchEvent(new Event(ORACLE_OPEN_LOGIN_EVENT));
  scrollTitanGateIntoView();
}

/** Navigate to Pulse Titan gate and open the login panel. */
export function openOracleLogin(): void {
  markTitanGateOpenIntent();
  const onPulse =
    window.location.pathname === "/pulse" || window.location.pathname.endsWith("/pulse");
  if (!onPulse) {
    window.location.href = "/pulse#oracle-admin";
    return;
  }
  openTitanGateInPlace();
}
