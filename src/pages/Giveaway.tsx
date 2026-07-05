import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  GIVEAWAY_BONUS_RULES,
  GIVEAWAY_END_ISO,
  GIVEAWAY_ENTRY_RULES,
  GIVEAWAY_PRIZES,
  GIVEAWAY_START_ISO,
  buildGiveawayReferralLink,
  isGiveawayActive,
} from "../config/giveaway";
import {
  claimGiveawaySocialBonus,
  fetchGiveawayStatus,
  saveGiveawayProfile,
  shareGiveaway,
  syncGiveawayEntries,
  type GiveawayStatus,
} from "../lib/giveaway";
import { fetchProfile, getCurrentUser } from "../lib/supabaseData";
import { hasSupabaseEnv } from "../lib/supabaseClient";

function formatGiveawayDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function saveErrorMessage(code?: string): string {
  switch (code) {
    case "display_name":
      return "Display name must be at least 2 characters.";
    case "username":
      return "Username must be 3–30 characters (letters, numbers, underscores).";
    case "bio":
      return "Bio must be at least 10 characters — tell us how you trade or what you scan.";
    case "username_taken":
      return "That username is taken. Try another.";
    case "schema_missing":
      return "Giveaway database not ready yet — run supabase/giveaway.sql in Supabase.";
    default:
      return "Could not save profile. Try again.";
  }
}

export function Giveaway() {
  const active = isGiveawayActive();
  const [status, setStatus] = useState<GiveawayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");

  const refresh = useCallback(async (sync = false) => {
    if (!hasSupabaseEnv) {
      setStatus({ ok: false, authenticated: false, active });
      setLoading(false);
      return;
    }
    const next = sync ? await syncGiveawayEntries() : await fetchGiveawayStatus();
    setStatus(next);
    setLoading(false);
  }, [active]);

  useEffect(() => {
    void refresh(true);
  }, [refresh]);

  useEffect(() => {
    if (!status?.authenticated) return;
    void getCurrentUser().then(async (user) => {
      if (!user) return;
      const profile = await fetchProfile(user.id);
      if (profile?.display_name) setDisplayName(profile.display_name);
      if (profile?.username) setUsername(profile.username);
      if (profile?.bio) setBio(profile.bio);
    });
  }, [status?.authenticated]);

  const referralLink = useMemo(() => {
    if (!status?.referralCode) return "";
    return buildGiveawayReferralLink(status.referralCode);
  }, [status?.referralCode]);

  const signedIn = Boolean(status?.authenticated);
  const eligible = Boolean(status?.eligible);

  async function handleSaveProfile() {
    setBusy(true);
    setMessage({ tone: "info", text: "Saving profile…" });
    const result = await saveGiveawayProfile(displayName, username, bio);
    if (result.saveError) {
      setMessage({ tone: "error", text: saveErrorMessage(result.saveError) });
      setBusy(false);
      return;
    }
    setStatus(result);
    setMessage({ tone: "success", text: "Profile saved — +1 entry when verified email is on file." });
    setBusy(false);
  }

  async function handleShare() {
    if (!status?.referralCode) return;
    setBusy(true);
    const shareResult = await shareGiveaway(status.referralCode);
    if (shareResult === "shared" || shareResult === "copied") {
      const claimed = await claimGiveawaySocialBonus();
      setStatus(claimed);
      setMessage({
        tone: "success",
        text:
          shareResult === "copied"
            ? "Share text copied — +2 entries added after you post!"
            : "Thanks for sharing — +2 bonus entries added!",
      });
    } else {
      setMessage({ tone: "error", text: "Could not open share. Copy your invite link below." });
    }
    setBusy(false);
  }

  async function handleCopyReferral() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setMessage({ tone: "success", text: "Invite link copied." });
    } catch {
      setMessage({ tone: "error", text: "Copy failed — select the link manually." });
    }
  }

  return (
    <div className="page giveaway-page">
      <section className="giveaway-page__hero marketing-panel">
        <p className="giveaway-page__eyebrow">Synexus.pro launch giveaway</p>
        <h1 className="giveaway-page__title">Join Synexus.pro and win incredible tech</h1>
        <p className="giveaway-page__lede">
          To celebrate launch, we&apos;re giving away over <strong>$700 in prizes</strong> to early community
          members. Create a free account, verify your email, and stack bonus entries — the more you earn, the
          better your odds.
        </p>
        {active ? (
          <p className="giveaway-page__dates">
            Runs {formatGiveawayDate(GIVEAWAY_START_ISO)} – {formatGiveawayDate(GIVEAWAY_END_ISO)} (UTC)
          </p>
        ) : (
          <p className="giveaway-page__dates giveaway-page__dates--ended">This giveaway period has ended.</p>
        )}
      </section>

      <section className="giveaway-page__prizes marketing-panel">
        <h2>Prizes</h2>
        <div className="giveaway-page__prize-grid">
          {GIVEAWAY_PRIZES.map((prize) => (
            <article key={prize.id} className="giveaway-page__prize">
              <span className="giveaway-page__prize-emoji" aria-hidden>
                {prize.emoji}
              </span>
              <p className="giveaway-page__prize-rank">{prize.rank}</p>
              <h3>{prize.title}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="giveaway-page__rules marketing-panel">
        <h2>How to enter</h2>
        <ul className="giveaway-page__checklist">
          {GIVEAWAY_ENTRY_RULES.map((rule) => {
            let done = false;
            if (rule.id === "signup") done = signedIn;
            if (rule.id === "email") done = Boolean(status?.emailVerified);
            if (rule.id === "profile") done = Boolean(status?.profileComplete);
            return (
              <li key={rule.id} className={done ? "giveaway-page__checklist-item--done" : undefined}>
                <span className="giveaway-page__check" aria-hidden>
                  {done ? "✅" : "⬜"}
                </span>
                <span>{rule.label}</span>
              </li>
            );
          })}
        </ul>
        {!signedIn ? (
          <Link className="giveaway-page__cta" to="/pulse">
            Create free account on Pulse
          </Link>
        ) : null}
      </section>

      <section className="giveaway-page__rules marketing-panel">
        <h2>Earn bonus entries</h2>
        <ul className="giveaway-page__bonus-list">
          {GIVEAWAY_BONUS_RULES.map((rule) => (
            <li key={rule.id}>
              <strong>+{rule.entries}</strong>
              <span>{rule.label}</span>
            </li>
          ))}
        </ul>
        <p className="giveaway-page__fineprint">
          The more entries you earn, the better your chances of winning. Referrals count when your friend signs up
          and verifies their email during the giveaway window.
        </p>
      </section>

      {signedIn ? (
        <section className="giveaway-page__dashboard marketing-panel">
          <div className="giveaway-page__score">
            <p className="giveaway-page__score-label">Your entries</p>
            <p className="giveaway-page__score-value">{status?.totalEntries ?? 0}</p>
            <p className="giveaway-page__score-meta">
              {eligible ? "Fully entered" : "Complete email + profile to qualify"}
              {typeof status?.referralCount === "number" && status.referralCount > 0
                ? ` · ${status.referralCount} friend${status.referralCount === 1 ? "" : "s"} referred`
                : ""}
            </p>
          </div>

          {message ? (
            <p className={`giveaway-page__message giveaway-page__message--${message.tone}`} role="status">
              {message.text}
            </p>
          ) : null}

          {!status?.emailVerified ? (
            <div className="giveaway-page__callout">
              <p>
                Verify your email to unlock entries. Open Pulse, check your inbox for the confirmation link, then
                return here.
              </p>
              <Link to="/pulse">Go to Pulse →</Link>
            </div>
          ) : null}

          <div className="giveaway-page__panel">
            <h3>Complete your profile</h3>
            <p>Add a display name, username, and short bio (+1 entry when saved).</p>
            <div className="giveaway-page__fields">
              <label>
                <span>Display name</span>
                <input
                  value={displayName}
                  disabled={busy || !active}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How we greet you on Pulse"
                />
              </label>
              <label>
                <span>Username</span>
                <input
                  value={username}
                  disabled={busy || !active}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_handle"
                  autoComplete="username"
                />
              </label>
              <label>
                <span>Bio</span>
                <textarea
                  value={bio}
                  disabled={busy || !active}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="What tokens you scan, how you use Synexus…"
                  rows={3}
                />
              </label>
            </div>
            <button type="button" className="giveaway-page__btn" disabled={busy || !active} onClick={() => void handleSaveProfile()}>
              {busy ? "Saving…" : status?.profileComplete ? "Update profile" : "Save profile & claim entry"}
            </button>
          </div>

          <div className="giveaway-page__panel">
            <h3>Invite friends (+5 each)</h3>
            <p>When someone signs up and verifies through your link, you get five bonus entries.</p>
            <code className="giveaway-page__referral">{referralLink || "Loading…"}</code>
            <div className="giveaway-page__actions">
              <button type="button" className="giveaway-page__btn" disabled={!referralLink || busy} onClick={() => void handleCopyReferral()}>
                Copy invite link
              </button>
            </div>
          </div>

          <div className="giveaway-page__panel">
            <h3>Share on social (+2)</h3>
            <p>
              {status?.socialClaimed
                ? "Social bonus claimed — thanks for spreading the word!"
                : "Post about Synexus.pro, then tap below to claim your bonus entries."}
            </p>
            <button
              type="button"
              className="giveaway-page__btn giveaway-page__btn--secondary"
              disabled={busy || !active || Boolean(status?.socialClaimed)}
              onClick={() => void handleShare()}
            >
              Share Synexus.pro
            </button>
          </div>

          <p className="giveaway-page__hint">
            Daily login (+1/day) credits automatically when you sign in on Pulse during the giveaway.
          </p>

          <button type="button" className="giveaway-page__refresh" disabled={loading || busy} onClick={() => void refresh(true)}>
            Refresh entry count
          </button>
        </section>
      ) : null}

      <section className="giveaway-page__legal marketing-panel">
        <h2>Official rules (summary)</h2>
        <ul className="giveaway-page__legal-list">
          <li>No purchase necessary. Open to individuals 18+ where permitted by law.</li>
          <li>One Synexus account per person. Duplicate or bot accounts are disqualified.</li>
          <li>Prizes are as listed; no cash alternative unless required by law.</li>
          <li>Winners contacted via verified account email after the giveaway ends.</li>
          <li>Synexus may modify or cancel the promotion for fraud, abuse, or legal compliance.</li>
        </ul>
        <p className="giveaway-page__fineprint">
          Questions? <Link to="/contact">Contact us</Link>. See also{" "}
          <Link to="/terms">Terms</Link> and <Link to="/privacy">Privacy</Link>.
        </p>
      </section>
    </div>
  );
}
