export const ORACLE_OPEN_LOGIN_EVENT = "synexus-oracle-open-login";

/** Navigate to Pulse Oracle gate and open the login panel. */
export function openOracleLogin() {
  const onPulse = window.location.pathname === "/pulse" || window.location.pathname.endsWith("/pulse");
  if (!onPulse) {
    window.location.assign("/pulse#oracle-admin");
    return;
  }
  window.location.hash = "oracle-admin";
  window.dispatchEvent(new Event(ORACLE_OPEN_LOGIN_EVENT));
}
