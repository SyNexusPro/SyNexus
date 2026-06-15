/** Synexus Aegis — security bot event taxonomy. */

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

export type SecurityThreatCode =
  | "RATE_LIMIT"
  | "INJECTION"
  | "PHISHING"
  | "SCRAPE_BURST"
  | "REPORT_SPAM"
  | "AUTH_ABUSE"
  | "PLAN_TAMPER"
  | "BOT_AUTOMATION"
  | "SUSPICIOUS_LINK"
  | "IMPERSONATION"
  | "BLOCKED_FINGERPRINT"
  | "INVALID_INPUT";

export type SecurityAction =
  | "token_scan"
  | "token_report"
  | "bug_report"
  | "auth_sign_in"
  | "auth_sign_up"
  | "api_fetch"
  | "user_input"
  | "plan_check"
  | "clipboard_paste"
  | "oracle_chat";

export type SecurityVerdict = {
  allowed: boolean;
  code?: SecurityThreatCode;
  severity?: SecuritySeverity;
  message?: string;
  retryAfterMs?: number;
};

export type SecurityEvent = {
  id: string;
  at: string;
  action: SecurityAction;
  code: SecurityThreatCode;
  severity: SecuritySeverity;
  message: string;
  detail?: Record<string, unknown>;
  blocked: boolean;
};

export type GuardContext = {
  action: SecurityAction;
  userId?: string;
  meta?: Record<string, unknown>;
};
