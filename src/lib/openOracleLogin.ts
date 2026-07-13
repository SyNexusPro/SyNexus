export const ORACLE_OPEN_LOGIN_EVENT = "synexus-oracle-open-login";
export const ORACLE_OPEN_CHAT_EVENT = "synexus-oracle-open-chat";
export const ORACLE_CLOSE_CHAT_EVENT = "synexus-oracle-close-chat";
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

/** Scroll to inline sign-in on the home hero (below the brain art). */
export function scrollHomeSignInIntoView(): void {
  requestAnimationFrame(() => {
    document.getElementById("home-sign-in")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

/** Open the global Titan chat panel (AppShell OracleSupremePresence). */
export function openTitanChat(): void {
  window.dispatchEvent(new Event(ORACLE_OPEN_CHAT_EVENT));
}

export function notifyTitanChatClosed(): void {
  window.dispatchEvent(new Event(ORACLE_CLOSE_CHAT_EVENT));
}

export function notifyTitanChatOpen(): void {
  window.dispatchEvent(new Event(ORACLE_OPEN_CHAT_EVENT));
}

/** Open the Titan gate on the current Pulse page (hash + event + scroll). */
export function openTitanGateInPlace(): void {
  window.location.hash = "#oracle-admin";
  window.dispatchEvent(new Event(ORACLE_OPEN_LOGIN_EVENT));
  scrollTitanGateIntoView();
}

/** Open the global quick-login sheet from anywhere in the app. */
export function openOracleLogin(): void {
  window.dispatchEvent(new Event(ORACLE_OPEN_LOGIN_EVENT));
}
