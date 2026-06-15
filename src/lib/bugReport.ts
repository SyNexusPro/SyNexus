const LOCAL_BUG_REPORTS_KEY = "hivemind_bug_reports";

export type BugReportInput = {
  email?: string;
  subject: string;
  details: string;
  pageUrl?: string;
};

export type BugReportResult =
  | { ok: true; channel: "mailto" | "local" }
  | { ok: false; message: string };

function saveLocalBugReport(input: BugReportInput) {
  try {
    const raw = localStorage.getItem(LOCAL_BUG_REPORTS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    const entry = {
      ...input,
      createdAt: new Date().toISOString(),
    };
    const next = [...list, entry].slice(-30);
    localStorage.setItem(LOCAL_BUG_REPORTS_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
}

export async function submitBugReport(
  input: BugReportInput,
  supportEmail: string,
): Promise<BugReportResult> {
  const subject = input.subject.trim();
  const details = input.details.trim();
  if (!subject || !details) {
    return { ok: false, message: "Subject and details are required." };
  }

  saveLocalBugReport({
    ...input,
    subject,
    details,
    pageUrl: input.pageUrl ?? (typeof window !== "undefined" ? window.location.href : undefined),
  });

  const email = supportEmail.trim();
  if (email && typeof window !== "undefined") {
    const body = [
      details,
      "",
      input.email?.trim() ? `Reporter: ${input.email.trim()}` : "Reporter: (not provided)",
      input.pageUrl ? `Page: ${input.pageUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`[Synexus Bug] ${subject}`)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
    return { ok: true, channel: "mailto" };
  }

  return { ok: true, channel: "local" };
}
