const LAST_EMAIL_KEY = "synexus_last_email";

export function loadRememberedEmail(): string {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function saveRememberedEmail(email: string): void {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return;
  try {
    localStorage.setItem(LAST_EMAIL_KEY, normalized);
  } catch {
    /* storage full or blocked */
  }
}

export function clearRememberedEmail(): void {
  try {
    localStorage.removeItem(LAST_EMAIL_KEY);
  } catch {
    /* ignore */
  }
}
