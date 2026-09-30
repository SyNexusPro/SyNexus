/**
 * Set while a submit handler owns the auth flow (sign-up, password recovery).
 * Background listeners read this so the session events those handlers cause
 * cannot navigate the operator away mid-submit and restart the same flow.
 */
let running = 0;

export function beginInteractiveAuthFlow(): void {
  running += 1;
}

export function endInteractiveAuthFlow(): void {
  running = Math.max(0, running - 1);
}

export function isInteractiveAuthFlowRunning(): boolean {
  return running > 0;
}
