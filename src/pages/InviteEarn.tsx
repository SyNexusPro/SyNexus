import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { INVITE_REQUIRED_COUNT, INVITE_REWARD_DAYS } from "../config/inviteEarn";
import { useOperatorAuth } from "../hooks/useOperatorAuth";
import { useOpenTitanGate } from "../hooks/useOpenTitanGate";
import {
  applyInviteRewardLocally,
  attachPendingInvite,
  confirmCardVerification,
  fetchInviteStatus,
  inviteShareUrl,
  peekInviteCode,
  saveInviteCode,
  startCardVerification,
  submitInviteIdentity,
  type InviteStatus,
} from "../lib/inviteEarn";

const COUNTRIES = [
  ["US", "United States"],
  ["CA", "Canada"],
  ["GB", "United Kingdom"],
  ["AU", "Australia"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["NG", "Nigeria"],
  ["IN", "India"],
  ["BR", "Brazil"],
  ["MX", "Mexico"],
  ["JP", "Japan"],
  ["SG", "Singapore"],
] as const;

export function InviteEarn() {
  const { code = "" } = useParams<{ code?: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const openLogin = useOpenTitanGate();
  const { linked, ready } = useOperatorAuth();
  const onboard = params.get("onboard") === "1";
  const cardReturn = params.get("card") === "success";

  const [status, setStatus] = useState<InviteStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [legalName, setLegalName] = useState("");
  const [dob, setDob] = useState("");
  const [country, setCountry] = useState("US");
  const [idType, setIdType] = useState("drivers_license");
  const [idLast4, setIdLast4] = useState("");
  const [attestation, setAttestation] = useState(false);

  const landingCode = (code || peekInviteCode()).trim().toUpperCase();

  useEffect(() => {
    if (code) saveInviteCode(code);
  }, [code]);

  async function refresh() {
    const next = await fetchInviteStatus();
    setStatus(next);
    setLoaded(true);
    if (next) applyInviteRewardLocally(next);
    return next;
  }

  useEffect(() => {
    if (!ready) return;
    if (!linked) return;
    void (async () => {
      await attachPendingInvite();
      const next = await refresh();
      if (cardReturn) {
        setBusy(true);
        const confirm = await confirmCardVerification();
        setMessage(confirm.message);
        await refresh();
        setBusy(false);
        navigate("/invite", { replace: true });
      }
      if (onboard && next?.onboardComplete) {
        navigate("/pulse?welcome=1", { replace: true });
      }
    })();
  }, [ready, linked, cardReturn, onboard, navigate]);

  const shareUrl = useMemo(() => {
    if (status?.referralCode) return inviteShareUrl(status.referralCode);
    return "";
  }, [status?.referralCode]);

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setMessage("Copy failed — select the link and copy it yourself.");
    }
  }

  async function handleIdentity() {
    setBusy(true);
    setMessage(null);
    const result = await submitInviteIdentity({
      legalName,
      dob,
      country,
      idType,
      idLast4,
      attestation,
    });
    setMessage(result.message);
    await refresh();
    setBusy(false);
  }

  async function handleCard() {
    setBusy(true);
    setMessage(null);
    const result = await startCardVerification();
    if (!result.ok) {
      setMessage(result.error);
      setBusy(false);
      return;
    }
    window.location.href = result.url;
  }

  if (!ready) {
    return (
      <div className="page invite-page">
        <p className="invite-page__lede">Loading…</p>
      </div>
    );
  }

  if (!linked) {
    return (
      <div className="page invite-page">
        <p className="invite-page__eyebrow">Invite and Earn</p>
        <h1 className="invite-page__title">Invite 3 people. Unlock 30 days of Pro Titan.</h1>
        <p className="invite-page__lede">
          {landingCode
            ? `Invite ${landingCode} is saved on this device. Create your account with a valid debit or credit card and identity check — one person, one account.`
            : "Sign up with a valid debit or credit card. We verify identity so fake accounts do not count."}
        </p>
        <button type="button" className="invite-page__cta" onClick={() => openLogin()}>
          Sign up to continue
        </button>
        <p className="invite-page__footnote">
          Limit one 30-day Pro Titan reward per customer. Each invited person can only count once.
        </p>
      </div>
    );
  }

  const remaining = Math.max(0, (status?.requiredCount ?? INVITE_REQUIRED_COUNT) - (status?.qualifiedCount ?? 0));

  if (linked && !loaded) {
    return (
      <div className="page invite-page">
        <p className="invite-page__lede">Loading your invite status…</p>
      </div>
    );
  }

  if (linked && !status) {
    return (
      <div className="page invite-page">
        <p className="invite-page__eyebrow">Invite and Earn</p>
        <h1 className="invite-page__title">Invite tracking is not live on this database yet</h1>
        <p className="invite-page__lede">
          Run <code>supabase/invite_earn.sql</code> in the Supabase SQL editor, then refresh. Sign-in is required.
        </p>
      </div>
    );
  }

  return (
    <div className="page invite-page">
      <p className="invite-page__eyebrow">Invite and Earn</p>
      <h1 className="invite-page__title">Invite 3 people, unlock 30 days of Pro Titan</h1>
      <p className="invite-page__lede">
        Your friends must sign up with a real debit or credit card and pass identity check. When three qualify, you
        get {INVITE_REWARD_DAYS} days of Pro Titan AI — once per customer.
      </p>

      {message ? (
        <p className="invite-page__message" role="status">
          {message}
        </p>
      ) : null}

      <section className="invite-page__card">
        <p className="invite-page__progress">
          {status?.qualifiedCount ?? 0} / {status?.requiredCount ?? INVITE_REQUIRED_COUNT} qualified invites
          {status?.pendingCount ? ` · ${status.pendingCount} pending card/ID` : ""}
        </p>
        <div className="invite-page__meter" aria-hidden>
          <span
            style={{
              width: `${Math.min(100, ((status?.qualifiedCount ?? 0) / INVITE_REQUIRED_COUNT) * 100)}%`,
            }}
          />
        </div>
        {status?.rewardActive ? (
          <p className="invite-page__reward">Pro Titan is unlocked on this account through your invite reward.</p>
        ) : status?.rewardClaimed ? (
          <p className="invite-page__reward">Your one invite reward has already been used on this account.</p>
        ) : (
          <p className="invite-page__reward">
            {remaining === 0
              ? "Reward processing — refresh in a moment."
              : `${remaining} more qualified signup${remaining === 1 ? "" : "s"} to unlock 30 days free.`}
          </p>
        )}
      </section>

      <section className="invite-page__card">
        <h2>Your invite link</h2>
        <p className="invite-page__code">{status?.referralCode || "…"}</p>
        <code className="invite-page__url">{shareUrl || "Generating link…"}</code>
        <button type="button" className="invite-page__cta" disabled={!shareUrl} onClick={() => void handleCopy()}>
          {copied ? "Copied" : "Copy invite link"}
        </button>
      </section>

      {!status?.identityVerified ? (
        <section className="invite-page__card">
          <h2>Identity check</h2>
          <p>
            Confirm you are the person on the ID. We store a fingerprint, not the full ID number — last 4 digits only.
          </p>
          <label className="invite-page__field">
            <span>Legal name</span>
            <input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="First and last name" />
          </label>
          <label className="invite-page__field">
            <span>Date of birth</span>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </label>
          <label className="invite-page__field">
            <span>Country</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="invite-page__field">
            <span>Government ID type</span>
            <select value={idType} onChange={(e) => setIdType(e.target.value)}>
              <option value="drivers_license">Driver’s license</option>
              <option value="passport">Passport</option>
              <option value="national_id">National ID</option>
            </select>
          </label>
          <label className="invite-page__field">
            <span>Last 4 digits of ID number</span>
            <input
              inputMode="numeric"
              maxLength={4}
              value={idLast4}
              onChange={(e) => setIdLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="1234"
            />
          </label>
          <label className="invite-page__check">
            <input type="checkbox" checked={attestation} onChange={(e) => setAttestation(e.target.checked)} />
            <span>I confirm I am this person, and the card I add is mine. One account per person.</span>
          </label>
          <button type="button" className="invite-page__cta" disabled={busy} onClick={() => void handleIdentity()}>
            {busy ? "Checking…" : "Verify identity"}
          </button>
        </section>
      ) : (
        <section className="invite-page__card">
          <h2>Identity</h2>
          <p>Verified. One person, one SyNexus account.</p>
        </section>
      )}

      <section className="invite-page__card">
        <h2>Debit or credit card</h2>
        {status?.cardVerified ? (
          <p>Card on file is verified. This account can count toward an invite.</p>
        ) : (
          <>
            <p>
              Every signup needs a valid debit or credit card. Square charges a $1 verification so we know the card
              is real. The same card cannot be reused on another account.
            </p>
            <button
              type="button"
              className="invite-page__cta"
              disabled={busy || !status?.identityVerified}
              onClick={() => void handleCard()}
            >
              {busy ? "Opening Square…" : "Add a valid card"}
            </button>
            {cardReturn ? (
              <button
                type="button"
                className="invite-page__cta invite-page__cta--secondary"
                disabled={busy}
                onClick={() => void confirmCardVerification().then((r) => {
                  setMessage(r.message);
                  return refresh();
                })}
              >
                Confirm card
              </button>
            ) : null}
            {!status?.identityVerified ? (
              <p className="invite-page__footnote">Verify identity first — then add the card in your name.</p>
            ) : null}
          </>
        )}
      </section>

      <p className="invite-page__footnote">
        <Link to="/pulse">Back to Pulse</Link>
      </p>
    </div>
  );
}
