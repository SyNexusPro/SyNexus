/**
 * Anonymous Titan feedback — opt-in only, local aggregation for product improvement.
 */

export const TITAN_FEEDBACK_CONSENT_KEY = "synexus_titan_feedback_consent";
export const TITAN_FEEDBACK_LOG_KEY = "synexus_titan_feedback_log";

export type TitanFeedbackRating = "helpful" | "not_helpful";

export type TitanFeedbackEntry = {
  rating: TitanFeedbackRating;
  topic: string;
  at: number;
};

const MAX_ENTRIES = 40;

export function hasTitanFeedbackConsent(): boolean {
  try {
    return localStorage.getItem(TITAN_FEEDBACK_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setTitanFeedbackConsent(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(TITAN_FEEDBACK_CONSENT_KEY, "1");
    } else {
      localStorage.removeItem(TITAN_FEEDBACK_CONSENT_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function recordTitanFeedback(rating: TitanFeedbackRating, topic: string): void {
  if (!hasTitanFeedbackConsent()) return;
  const entry: TitanFeedbackEntry = {
    rating,
    topic: topic.slice(0, 120),
    at: Date.now(),
  };
  try {
    const raw = localStorage.getItem(TITAN_FEEDBACK_LOG_KEY);
    const existing = raw ? (JSON.parse(raw) as TitanFeedbackEntry[]) : [];
    const next = [...(Array.isArray(existing) ? existing : []), entry].slice(-MAX_ENTRIES);
    localStorage.setItem(TITAN_FEEDBACK_LOG_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
