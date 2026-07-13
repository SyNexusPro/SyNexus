import { matchThreatPatterns, isLikelyBotEnvironment, sanitizeForLog, isSuspiciousAuthEmail, isSuspiciousAuthPassword } from "./patterns";
import { rateLimiter } from "./rateLimit";
import {
  appendSecurityEvent,
  blockFingerprint,
  getDeviceFingerprint,
  isFingerprintBlocked,
} from "./storage";
import type {
  GuardContext,
  SecurityAction,
  SecurityEvent,
  SecuritySeverity,
  SecurityThreatCode,
  SecurityVerdict,
} from "./types";

const PLAN_GRANT_KEY = "synexus_aegis_plan_grant";
const TRUSTED_PLAN_SOURCES = ["subscription_checkout", "square_checkout", "supabase_profile", "demo_session", "trial_7d", "admin", "owner"];

type PlanGrant = { plan: "PRO" | "FREE"; source: string; at: number };

function readPlanGrant(): PlanGrant | null {
  try {
    const raw = sessionStorage.getItem(PLAN_GRANT_KEY);
    return raw ? (JSON.parse(raw) as PlanGrant) : null;
  } catch {
    return null;
  }
}

function isTrustedProGrant(grant: PlanGrant | null): boolean {
  if (!grant || grant.plan !== "PRO") return false;
  if (!TRUSTED_PLAN_SOURCES.includes(grant.source)) return false;
  const maxAge =
    grant.source === "owner"
      ? 90 * 86_400_000
      : grant.source === "trial_7d"
        ? 8 * 86_400_000
        : grant.source === "demo_session"
          ? 8 * 86_400_000
          : 86_400_000;
  return Date.now() - grant.at < maxAge;
}

/** Single-purpose security bot — blocks abuse, cheating, phishing, and attacks. */
class SecurityBotCore {
  private initialized = false;
  private fingerprint = "unknown";
  private botEnvFlagged = false;

  init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    this.fingerprint = getDeviceFingerprint();
    this.botEnvFlagged = isLikelyBotEnvironment();

    if (this.botEnvFlagged) {
      this.record({
        action: "api_fetch",
        code: "BOT_AUTOMATION",
        severity: "medium",
        message: "Automated browser environment detected",
        blocked: false,
      });
    }

    this.installPlanTamperWatch();
    this.installClipboardGuard();
    this.installCrossTabPlanWatch();
  }

  getFingerprint() {
    return this.fingerprint;
  }

  /** Call when Pro is legitimately granted (Stripe, profile sync, demo). */
  recordPlanGrant(plan: "PRO" | "FREE", source: string) {
    const grant: PlanGrant = { plan, source, at: Date.now() };
    try {
      sessionStorage.setItem(PLAN_GRANT_KEY, JSON.stringify(grant));
    } catch {
      // ignore
    }
  }

  guardAuthCredentials(email: string, password: string, kind: "sign_in" | "sign_up"): SecurityVerdict {
    const action = kind === "sign_in" ? "auth_sign_in" : "auth_sign_up";
    const rateVerdict = this.guardAction(action, email.toLowerCase());
    if (!rateVerdict.allowed) return rateVerdict;

    if (isSuspiciousAuthEmail(email)) {
      return this.deny({
        action,
        code: "INVALID_INPUT",
        severity: "medium",
        message: "Use a valid email address to sign in.",
      });
    }

    if (isSuspiciousAuthPassword(password)) {
      return this.deny({
        action,
        code: "INJECTION",
        severity: "high",
        message: "Password contains disallowed characters.",
      });
    }

    return this.guardUserInput(email, { action });
  }

  /** Strip fake Pro if local storage was tampered with. */
  enforcePlanIntegrity(storedPlan: string, hasPaidProfile: boolean): "PRO" | "FREE" {
    const verdict = this.verifyPlanIntegrity(storedPlan, hasPaidProfile);
    if (!verdict.allowed && storedPlan === "PRO") {
      try {
        localStorage.setItem("hivemind_paid_plan", "FREE");
      } catch {
        /* ignore */
      }
      return "FREE";
    }
    return storedPlan === "PRO" ? "PRO" : "FREE";
  }

  rejectInvalidInput(action: SecurityAction, message: string): SecurityVerdict {
    return this.deny({
      action,
      code: "INVALID_INPUT",
      severity: "medium",
      message,
    });
  }

  /** Verify local PRO flag wasn't set without a recent trusted grant. */
  verifyPlanIntegrity(storedPlan: string, hasPaidProfile: boolean): SecurityVerdict {
    if (storedPlan !== "PRO") return { allowed: true };

    if (hasPaidProfile) {
      this.recordPlanGrant("PRO", "supabase_profile");
      return { allowed: true };
    }

    if (isTrustedProGrant(readPlanGrant())) {
      return { allowed: true };
    }

    return this.deny({
      action: "plan_check",
      code: "PLAN_TAMPER",
      severity: "high",
      message: "Pro access must come from a valid subscription — local override blocked.",
    });
  }

  guardUserInput(text: string, ctx: GuardContext): SecurityVerdict {
    const rate = rateLimiter.check("user_input", this.fingerprint);
    if (!rate.allowed) {
      return this.deny({
        action: ctx.action,
        code: "RATE_LIMIT",
        severity: "medium",
        message: "Too many requests. Slow down and try again.",
        retryAfterMs: rate.retryAfterMs,
      });
    }

    const threats = matchThreatPatterns(text);
    if (threats.injection) {
      return this.deny({
        action: ctx.action,
        code: "INJECTION",
        severity: "critical",
        message: "Blocked: disallowed script or injection pattern.",
        detail: { sample: sanitizeForLog(text) },
      });
    }
    if (threats.phishing) {
      return this.deny({
        action: ctx.action,
        code: "PHISHING",
        severity: "critical",
        message: "Blocked: content requests wallet secrets or looks like a phishing attempt.",
      });
    }
    if (threats.impersonation) {
      return this.deny({
        action: ctx.action,
        code: "IMPERSONATION",
        severity: "high",
        message: "Blocked: impersonation or fake support language detected.",
      });
    }
    if (threats.suspiciousLink) {
      return this.deny({
        action: ctx.action,
        code: "SUSPICIOUS_LINK",
        severity: "high",
        message: "Blocked: suspicious or lookalike link detected.",
      });
    }

    return { allowed: true };
  }

  guardAction(action: SecurityAction, key?: string): SecurityVerdict {
    if (isFingerprintBlocked(this.fingerprint)) {
      return this.deny({
        action,
        code: "BLOCKED_FINGERPRINT",
        severity: "critical",
        message: "This device is temporarily blocked due to repeated abuse.",
      });
    }

    if (this.botEnvFlagged && (action === "token_report" || action === "auth_sign_up")) {
      return this.deny({
        action,
        code: "BOT_AUTOMATION",
        severity: "high",
        message: "Automated activity blocked. Use a normal browser to continue.",
      });
    }

    const rate = rateLimiter.check(action, key ?? this.fingerprint);
    if (!rate.allowed) {
      this.escalateIfNeeded(action);
      return this.deny({
        action,
        code: "RATE_LIMIT",
        severity: "medium",
        message: "Too many attempts. Please wait before trying again.",
        retryAfterMs: rate.retryAfterMs,
      });
    }

    return { allowed: true };
  }

  private abuseStrikes = new Map<string, number>();

  private escalateIfNeeded(action: SecurityAction) {
    const id = `${this.fingerprint}:${action}`;
    const strikes = (this.abuseStrikes.get(id) ?? 0) + 1;
    this.abuseStrikes.set(id, strikes);
    if (strikes >= 5) {
      blockFingerprint(this.fingerprint, `Repeated ${action} abuse`, 3_600_000);
      this.record({
        action,
        code: "RATE_LIMIT",
        severity: "critical",
        message: `Device blocked for repeated ${action} abuse`,
        blocked: true,
      });
      this.abuseStrikes.delete(id);
    }
  }

  private deny(opts: {
    action: SecurityAction;
    code: SecurityThreatCode;
    severity: SecuritySeverity;
    message: string;
    retryAfterMs?: number;
    detail?: Record<string, unknown>;
  }): SecurityVerdict {
    this.record({
      action: opts.action,
      code: opts.code,
      severity: opts.severity,
      message: opts.message,
      blocked: true,
      detail: opts.detail,
    });
    return {
      allowed: false,
      code: opts.code,
      severity: opts.severity,
      message: opts.message,
      retryAfterMs: opts.retryAfterMs,
    };
  }

  private record(opts: {
    action: SecurityAction;
    code: SecurityThreatCode;
    severity: SecuritySeverity;
    message: string;
    blocked: boolean;
    detail?: Record<string, unknown>;
  }) {
    const event: SecurityEvent = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      action: opts.action,
      code: opts.code,
      severity: opts.severity,
      message: opts.message,
      blocked: opts.blocked,
      detail: opts.detail,
    };
    appendSecurityEvent(event, this.fingerprint);

    if (import.meta.env.DEV) {
      const tag = opts.blocked ? "BLOCKED" : "LOG";
      console.warn(`[Synexus Aegis] ${tag} ${opts.code}: ${opts.message}`);
    }
  }

  private installPlanTamperWatch() {
    const key = "hivemind_paid_plan";
    const original = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (k: string, value: string) => {
      if (k === key && value === "PRO") {
        if (!isTrustedProGrant(readPlanGrant())) {
          this.record({
            action: "plan_check",
            code: "PLAN_TAMPER",
            severity: "high",
            message: "Untrusted attempt to set Pro plan in local storage",
            blocked: true,
          });
          return;
        }
      }
      original(k, value);
    };
  }

  private installClipboardGuard() {
    document.addEventListener("paste", (e) => {
      const text = e.clipboardData?.getData("text") ?? "";
      if (!text) return;
      const verdict = this.guardUserInput(text, { action: "clipboard_paste" });
      if (!verdict.allowed && verdict.severity === "critical") {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  private installCrossTabPlanWatch() {
    window.addEventListener("storage", (e) => {
      if (e.key !== "hivemind_paid_plan" || e.newValue !== "PRO") return;
      this.record({
        action: "plan_check",
        code: "PLAN_TAMPER",
        severity: "medium",
        message: "Cross-tab Pro plan change detected — verifying grant",
        blocked: false,
      });
      this.enforcePlanIntegrity("PRO", false);
    });
  }
}

export const securityBot = new SecurityBotCore();

export function initSecurityBot() {
  securityBot.init();
}

export function guardOrThrow(verdict: SecurityVerdict): void {
  if (!verdict.allowed) {
    throw new Error(verdict.message ?? "Action blocked by Synexus security.");
  }
}
