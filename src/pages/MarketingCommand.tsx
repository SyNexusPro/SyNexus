import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  generateDiscordPost,
  generateReferralBlurb,
  generateRedditPost,
  generateTelegramUpdate,
  generateTikTokScript,
  generateXPost,
  growthMissionLine,
  marketingAppOrigin,
} from "../lib/syMarketingGenerators";

const CHECKLIST_STORAGE = "hivemind_syneux_marketing_checklist_v1";

type CheckDef = { id: string; label: string };
const CHECK_ITEMS: readonly CheckDef[] = [
  { id: "x", label: "Post on X" },
  { id: "tiktok", label: "Post TikTok / Reel" },
  { id: "telegram", label: "Post Telegram update" },
  { id: "discord", label: "Post Discord update" },
  { id: "reply5", label: "Reply thoughtfully to 5 crypto posts (value, not spam)" },
  { id: "share", label: "Share live Synexus app link responsibly" },
  { id: "trial-promo", label: "Promote 7-day free Pro trial · $9.99/mo after (X, TikTok, Telegram)" },
  { id: "square", label: "Check Square subscriptions (dashboard audit)" },
] as const;

const CONTENT_CALENDAR = [
  { day: "Day 1", title: "Launch announcement", detail: "Tease Synexus + 7-day free Pro trial when you sign up." },
  { day: "Day 2", title: "Don’t get rugged", detail: "Sentinel Aegis framing on risk scans + pattern anomalies." },
  { day: "Day 3", title: "Sentinel Aegis risk scan", detail: "Walk through how risk overlays stay structured." },
  { day: "Day 4", title: "Whale tracking", detail: "Sentinel Leviathan cues + reading flow without guaranteeing moves." },
  { day: "Day 5", title: "7-day free trial offer", detail: "Sign up · full Pro for 7 days · card on file · $9.99/mo after." },
  { day: "Day 6", title: "Synexus Pro benefits", detail: "Titan briefings, Sentinel grid, faster refresh — what trial unlocks." },
  { day: "Day 7", title: "User feedback post", detail: "Amplify sober wins + trial-to-paid journey tone." },
] as const;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadChecks(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE);
    if (!raw) return {};
    const data = JSON.parse(raw) as { date?: string; items?: Record<string, boolean> };
    if (data.date !== todayKey()) return {};
    return { ...(data.items ?? {}) };
  } catch {
    return {};
  }
}

function persistChecks(items: Record<string, boolean>) {
  try {
    localStorage.setItem(CHECKLIST_STORAGE, JSON.stringify({ date: todayKey(), items }));
  } catch {
    /* ignore */
  }
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function MarketingCommand() {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? marketingAppOrigin() : "";

  const [xPost, setXPost] = useState(() => generateXPost(Date.now()));
  const [tiktok, setTiktok] = useState(() => generateTikTokScript(Date.now()));
  const [telegram, setTelegram] = useState(() => generateTelegramUpdate(Date.now()));
  const [discord, setDiscord] = useState(() => generateDiscordPost(Date.now()));
  const [reddit, setReddit] = useState(() => generateRedditPost(Date.now()));
  const [referral, setReferral] = useState(() => generateReferralBlurb(Date.now()));

  useEffect(() => {
    setChecks(loadChecks());
  }, []);

  const toggleCheck = useCallback((id: string) => {
    setChecks((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      persistChecks(next);
      return next;
    });
  }, []);

  const copy = useCallback(async (field: string, text: string) => {
    const ok = await writeClipboard(text);
    if (ok) {
      setCopiedField(field);
      window.setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 2000);
    }
  }, []);

  const mission = useMemo(() => growthMissionLine(new Date()), []);

  return (
    <div className="page marketing-cmd">
      <header className="marketing-cmd__hero">
        <p className="marketing-cmd__badge">INTERNAL · MARKETING</p>
        <h1 className="marketing-cmd__title">Marketing Command Center</h1>
        <p className="marketing-cmd__sub">
          Synexus outbound studio — futuristic, restrained, trader-native. Generates copy only; you approve and post manually.
          <strong>No auto-posting</strong> to X, TikTok, Reddit, Discord, or Telegram.
        </p>
      </header>

      <nav className="marketing-cmd__nav" aria-label="Quick links">
        <Link className="marketing-cmd__nav-link" to="/">
          ← Feed
        </Link>
        <Link className="marketing-cmd__nav-link" to="/pulse">
          Pulse
        </Link>
        <Link className="marketing-cmd__nav-link" to="/analytics">
          Site analytics
        </Link>
      </nav>

      <section className="marketing-cmd-card" aria-labelledby="growth-mission">
        <div className="marketing-cmd-card__head">
          <h2 id="growth-mission" className="marketing-cmd-card__title">
            Today&apos;s Growth Mission
          </h2>
          <span className="marketing-cmd-card__chip">{todayKey()}</span>
        </div>
        <p className="marketing-cmd-mission">{mission}</p>
        <ExampleLine />
      </section>

      <section className="marketing-cmd-card" aria-labelledby="checklist-heading">
        <div className="marketing-cmd-card__head">
          <h2 id="checklist-heading" className="marketing-cmd-card__title">
            Daily Launch Checklist
          </h2>
        </div>
        <p className="marketing-cmd-card__muted">
          Resets nightly (local browser). Checked items persist for{" "}
          <strong>{todayKey()}</strong> only — stay accountable without spam tooling.
        </p>
        <ul className="marketing-cmd-checklist">
          {CHECK_ITEMS.map((item) => (
            <li key={item.id} className="marketing-cmd-checklist__item">
              <label className="marketing-cmd-check">
                <input
                  type="checkbox"
                  checked={Boolean(checks[item.id])}
                  onChange={() => toggleCheck(item.id)}
                />
                <span>{item.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className="marketing-cmd-stripe-hint">
          Square audit:{" "}
          <a
            href="https://squareup.com/dashboard/subscriptions"
            target="_blank"
            rel="noopener noreferrer"
            className="marketing-cmd-inline-link"
          >
            squareup.com/dashboard/subscriptions ↗
          </a>
        </p>
        {origin ? (
          <p className="marketing-cmd-linkbox">
            <span className="marketing-cmd-linkbox__label">Live Synexus app (this tab origin)</span>
            <code className="marketing-cmd-code">{origin}</code>
            <button
              type="button"
              className="marketing-cmd-mini-copy"
              onClick={() => void copy("origin", origin)}
            >
              {copiedField === "origin" ? "Copied!" : "Copy"}
            </button>
          </p>
        ) : (
          <p className="marketing-cmd-card__muted">Open this tool in-browser to expose your deployed origin automatically.</p>
        )}
      </section>

      <section className="marketing-cmd-card" aria-labelledby="generators-heading">
        <div className="marketing-cmd-card__head">
          <h2 id="generators-heading" className="marketing-cmd-card__title">
            Daily Content Generator
          </h2>
        </div>
        <p className="marketing-cmd-card__muted">
          Brand pillars: Synexus · The Synexus · Titan · Sentinels · Synexus Pro · $9.99/month ·
          AI intelligence · Sentinel analysis · whales · momentum · risk scanning.
        </p>

        <GeneratorBlock
          label="X Post"
          value={xPost}
          copied={copiedField === "x"}
          onRegen={() => setXPost(generateXPost(Date.now()))}
          onCopy={() => void copy("x", xPost)}
        />
        <GeneratorBlock
          label="TikTok Script"
          value={tiktok}
          copied={copiedField === "tiktok"}
          onRegen={() => setTiktok(generateTikTokScript(Date.now()))}
          onCopy={() => void copy("tiktok", tiktok)}
        />
        <GeneratorBlock
          label="Telegram Update"
          value={telegram}
          copied={copiedField === "telegram"}
          onRegen={() => setTelegram(generateTelegramUpdate(Date.now()))}
          onCopy={() => void copy("telegram", telegram)}
        />
        <GeneratorBlock
          label="Discord Post"
          value={discord}
          copied={copiedField === "discord"}
          onRegen={() => setDiscord(generateDiscordPost(Date.now()))}
          onCopy={() => void copy("discord", discord)}
        />
        <GeneratorBlock
          label="Reddit Post Draft"
          value={reddit}
          copied={copiedField === "reddit"}
          onRegen={() => setReddit(generateRedditPost(Date.now()))}
          onCopy={() => void copy("reddit", reddit)}
        />

        <div className="marketing-cmd-split">
          <h3 className="marketing-cmd-mini-title">Referral message generator</h3>
          <p className="marketing-cmd-card__muted">
            Warm invitations only — conversational, respectful, no brigading.
          </p>
          <GeneratorBlock
            label="Invite traders to try Synexus"
            value={referral}
            copied={copiedField === "referral"}
            onRegen={() => setReferral(generateReferralBlurb(Date.now()))}
            onCopy={() => void copy("referral", referral)}
          />
        </div>
      </section>

      <section className="marketing-cmd-card" aria-labelledby="calendar-heading">
        <div className="marketing-cmd-card__head">
          <h2 id="calendar-heading" className="marketing-cmd-card__title">
            7-Day Content Rhythm
          </h2>
        </div>
        <ol className="marketing-cmd-calendar">
          {CONTENT_CALENDAR.map((entry) => (
            <li key={entry.day} className="marketing-cmd-calendar__row">
              <span className="marketing-cmd-calendar__day">{entry.day}</span>
              <span className="marketing-cmd-calendar__title">{entry.title}</span>
              <p className="marketing-cmd-calendar__detail">{entry.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="marketing-cmd-foot">
        Manual posting only • Review each line for disclosures • Not financial advice
      </footer>
    </div>
  );
}

function ExampleLine() {
  return (
    <p className="marketing-cmd-example" role="note">
      <strong>Example:</strong> “Post one short video showing Sentinels detecting risk before a bad trade.”
    </p>
  );
}

function GeneratorBlock({
  label,
  value,
  copied,
  onRegen,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onRegen: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="marketing-cmd-gen">
      <div className="marketing-cmd-gen__bar">
        <span className="marketing-cmd-gen__label">{label}</span>
        <div className="marketing-cmd-gen__actions">
          <button type="button" className="marketing-cmd-btn marketing-cmd-btn--ghost" onClick={onRegen}>
            Regenerate
          </button>
          <button type="button" className="marketing-cmd-btn marketing-cmd-btn--primary" onClick={onCopy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <textarea className="marketing-cmd-textarea" readOnly rows={8} value={value} aria-label={`${label} draft`} />
    </div>
  );
}
