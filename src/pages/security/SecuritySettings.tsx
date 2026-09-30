import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { signOut, updatePassword } from "../../lib/supabaseData";
import { validateSignupPassword } from "../../lib/authCredentials";
import {
  enrollTotpFactor,
  getAssurance,
  hasRecentStepUp,
  listVerifiedTotpFactors,
  MFA_SETUP_PATH,
  type ListedFactor,
  unenrollFactor,
  verifyTotpCode,
} from "../../security/mfa";
import { enrollDevicePasskey, passkeysAvailable } from "../../security/passkeys";
import { isPhoneVerified, maskPhoneNumber } from "../../security/phoneVerification";
import { listOwnSecurityEvents, recordSecurityEvent, type SecurityEventRow } from "../../security/securityEvents";

export function SecuritySettings() {
  const navigate = useNavigate();
  const [aal, setAal] = useState("aal1");
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [factors, setFactors] = useState<ListedFactor[]>([]);
  const [events, setEvents] = useState<SecurityEventRow[]>([]);
  const [password, setPassword] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [backupFactorId, setBackupFactorId] = useState("");
  const [backupQr, setBackupQr] = useState("");
  const [backupSecret, setBackupSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const [assurance, listed, log, userResult] = await Promise.all([
      getAssurance(),
      listVerifiedTotpFactors(),
      listOwnSecurityEvents(),
      supabase?.auth.getUser(),
    ]);
    setAal(assurance.currentLevel);
    setFactors(listed);
    setEvents(log);
    setVerifiedPhone(isPhoneVerified(userResult?.data.user) ? userResult?.data.user?.phone ?? "" : "");
  }

  useEffect(() => {
    void refresh();
  }, []);

  function requireStepUp(): boolean {
    if (hasRecentStepUp() && aal === "aal2") return true;
    navigate(MFA_SETUP_PATH, { state: { from: "/security" } });
    return false;
  }

  async function handleChangePassword() {
    if (busy || !requireStepUp()) return;
    const check = validateSignupPassword(password);
    if (!check.ok) {
      setMessage(check.message ?? "Choose a stronger password.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await updatePassword(password);
      setPassword("");
      void recordSecurityEvent({ eventType: "password_changed", success: true });
      setMessage("Password updated.");
    } catch {
      setMessage("Could not change password.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOutOthers() {
    if (busy || !requireStepUp() || !supabase) return;
    setBusy(true);
    try {
      await supabase.auth.signOut({ scope: "others" });
      void recordSecurityEvent({ eventType: "sessions_revoked", success: true });
      setMessage("Other sessions signed out.");
    } catch {
      setMessage("Could not sign out other sessions.");
    } finally {
      setBusy(false);
    }
  }

  async function startBackup() {
    if (busy || !requireStepUp()) return;
    setBusy(true);
    setMessage(null);
    try {
      const enrolled = await enrollTotpFactor(
        factors.length ? "SyNexus Backup Authenticator" : "SyNexus Authenticator",
      );
      setBackupFactorId(enrolled.factorId);
      setBackupQr(enrolled.qrCode);
      setBackupSecret(enrolled.secret);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not add backup authenticator.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmBackup() {
    if (busy) return;
    setBusy(true);
    try {
      await verifyTotpCode(backupFactorId, backupCode);
      void recordSecurityEvent({ eventType: "mfa_enrolled", success: true });
      setBackupFactorId("");
      setBackupQr("");
      setBackupSecret("");
      setBackupCode("");
      setMessage("Authenticator app enabled.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Backup verification failed.");
    } finally {
      setBusy(false);
    }
  }

  async function removeFactor(id: string) {
    if (busy || !requireStepUp()) return;
    if (!window.confirm("Remove this authenticator app from your account?")) return;
    setBusy(true);
    try {
      await unenrollFactor(id);
      setMessage("Authenticator removed.");
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not remove authenticator.");
    } finally {
      setBusy(false);
    }
  }

  async function addPasskey() {
    if (busy || !requireStepUp()) return;
    setBusy(true);
    try {
      await enrollDevicePasskey();
      setMessage("Passkey registered on this device.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Passkey not available.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page synexus-sec">
      <section className="synexus-sec__card synexus-sec__card--wide" aria-labelledby="sec-settings-title">
        <p className="synexus-sec__eyebrow">Settings · Security</p>
        <h1 id="sec-settings-title">Account security</h1>

        {message ? <p className="synexus-sec__note">{message}</p> : null}

        <h2 className="synexus-sec__h2">Verified phone</h2>
        <p>{verifiedPhone ? `✓ ${maskPhoneNumber(verifiedPhone)}` : "Phone verification required"}</p>

        <h2 className="synexus-sec__h2">Authenticator app (optional)</h2>
        <p>{factors.length ? "✓ Extra sign-in protection enabled" : "Not enabled"}</p>
        <ul className="synexus-sec__list">
          {factors.map((factor) => (
            <li key={factor.id}>
              {factor.friendlyName}
              <button type="button" className="synexus-sec__text-btn" disabled={busy} onClick={() => void removeFactor(factor.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
        <div className="synexus-sec__row">
          <button type="button" className="synexus-sec__btn synexus-sec__btn--ghost" disabled={busy} onClick={() => void startBackup()}>
            {factors.length ? "Add Backup Authenticator" : "Add Authenticator App"}
          </button>
        </div>

        {backupQr ? (
          <div className="synexus-sec__backup">
            <p>Scan with your authenticator app, then enter the code.</p>
            <img className="synexus-sec__qr" src={backupQr} alt="Backup authenticator QR code" />
            <p className="synexus-sec__secret">
              Manual secret: <code>{backupSecret}</code>
            </p>
            <input
              className="synexus-sec__code"
              inputMode="numeric"
              maxLength={6}
              value={backupCode}
              onChange={(event) => setBackupCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
            <button type="button" className="synexus-sec__btn" disabled={busy || backupCode.length !== 6} onClick={() => void confirmBackup()}>
              Verify authenticator
            </button>
          </div>
        ) : null}

        <h2 className="synexus-sec__h2">Passkeys</h2>
        {passkeysAvailable() ? (
          <button type="button" className="synexus-sec__btn synexus-sec__btn--ghost" disabled={busy} onClick={() => void addPasskey()}>
            Add Fingerprint / Face / Device Passkey
          </button>
        ) : (
          <p className="synexus-sec__muted">
            Passkeys are optional and off unless enabled for this build.
          </p>
        )}

        <h2 className="synexus-sec__h2">Active security</h2>
        <p>
          Current session security level: <strong>{aal.toUpperCase()}</strong>
        </p>

        <h2 className="synexus-sec__h2">Change password</h2>
        <input
          className="synexus-sec__input"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="New password"
        />
        <button type="button" className="synexus-sec__btn" disabled={busy || !password} onClick={() => void handleChangePassword()}>
          Change Password
        </button>

        <div className="synexus-sec__row">
          <button type="button" className="synexus-sec__btn synexus-sec__btn--ghost" disabled={busy} onClick={() => void handleSignOutOthers()}>
            Sign Out Other Sessions
          </button>
          <button
            type="button"
            className="synexus-sec__text-btn"
            disabled={busy}
            onClick={() => {
              void signOut();
              navigate("/", { replace: true });
            }}
          >
            Sign out this device
          </button>
        </div>

        <h2 className="synexus-sec__h2">Recent security events</h2>
        <ul className="synexus-sec__list">
          {events.length ? (
            events.map((event) => (
              <li key={event.id}>
                {event.event_type} · {event.device_description ?? "device"} ·{" "}
                {new Date(event.created_at).toLocaleString()}
              </li>
            ))
          ) : (
            <li>No events yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
