import { useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { useSynWallet } from "../context/SynWalletContext";
import { SYN_WALLET_PRODUCT_NAME, SYN_WALLET_TAGLINE } from "../config/synWallet";
import { shortenAddress } from "../lib/synWallet/crypto";
import {
  fetchRecentSignatures,
  fetchSolBalance,
  fetchTokenBalances,
  jupiterSwapUrl,
  sendSolTransfer,
  type SynTokenBalance,
} from "../lib/synWallet/chain";

type SetupMode = "choose" | "create-pin" | "backup" | "import";

function SetupFlow() {
  const { createWallet, importWallet } = useSynWallet();
  const navigate = useNavigate();
  const [mode, setMode] = useState<SetupMode>("choose");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [importPhrase, setImportPhrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [acked, setAcked] = useState(false);

  async function onCreate() {
    setError(null);
    if (pin.length < 6) {
      setError("Use a PIN with at least 6 digits.");
      return;
    }
    if (pin !== pin2) {
      setError("PINs do not match.");
      return;
    }
    setBusy(true);
    try {
      const { mnemonic: words } = await createWallet(pin);
      setMnemonic(words);
      setMode("backup");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create wallet.");
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    setError(null);
    if (pin.length < 6) {
      setError("Use a PIN with at least 6 digits.");
      return;
    }
    if (pin !== pin2) {
      setError("PINs do not match.");
      return;
    }
    setBusy(true);
    try {
      await importWallet(importPhrase, pin);
      navigate("/wallet", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import wallet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="syn-wallet syn-wallet--setup">
      <header className="syn-wallet__hero">
        <p className="syn-wallet__eyebrow">{SYN_WALLET_PRODUCT_NAME}</p>
        <h1 className="syn-wallet__title">Your keys. Your chain.</h1>
        <p className="syn-wallet__lede">
          Phantom clarity · Coinbase security habits · Robinhood-simple portfolio — self-custodial Solana.
        </p>
      </header>

      {mode === "choose" ? (
        <div className="syn-wallet__stack">
          <button type="button" className="syn-wallet__cta" onClick={() => setMode("create-pin")}>
            Create new wallet
          </button>
          <button type="button" className="syn-wallet__cta syn-wallet__cta--ghost" onClick={() => setMode("import")}>
            Import recovery phrase
          </button>
          <p className="syn-wallet__fine">
            SyNexus never holds your seed. Prefer the mobile app — keys encrypt into device secure storage.
          </p>
        </div>
      ) : null}

      {mode === "create-pin" || mode === "import" ? (
        <div className="syn-wallet__stack">
          {mode === "import" ? (
            <label className="syn-wallet__field">
              <span>12 or 24-word recovery phrase</span>
              <textarea
                value={importPhrase}
                onChange={(e) => setImportPhrase(e.target.value)}
                rows={4}
                autoComplete="off"
                spellCheck={false}
                placeholder="word1 word2 word3 …"
              />
            </label>
          ) : null}
          <label className="syn-wallet__field">
            <span>Create PIN (unlock)</span>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
              autoComplete="new-password"
            />
          </label>
          <label className="syn-wallet__field">
            <span>Confirm PIN</span>
            <input
              type="password"
              inputMode="numeric"
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 12))}
              autoComplete="new-password"
            />
          </label>
          {error ? <p className="syn-wallet__error">{error}</p> : null}
          <button
            type="button"
            className="syn-wallet__cta"
            disabled={busy}
            onClick={() => void (mode === "import" ? onImport() : onCreate())}
          >
            {busy ? "Working…" : mode === "import" ? "Import wallet" : "Continue"}
          </button>
          <button type="button" className="syn-wallet__linkish" onClick={() => setMode("choose")}>
            Back
          </button>
        </div>
      ) : null}

      {mode === "backup" ? (
        <div className="syn-wallet__stack">
          <p className="syn-wallet__warn">
            Write these words down offline. Anyone with this phrase owns your funds. SyNexus cannot recover it.
          </p>
          <ol className="syn-wallet__seed">
            {mnemonic.split(" ").map((word, i) => (
              <li key={`${word}-${i}`}>
                <span>{i + 1}</span>
                {word}
              </li>
            ))}
          </ol>
          <label className="syn-wallet__check">
            <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} />
            I saved my recovery phrase somewhere safe.
          </label>
          <button
            type="button"
            className="syn-wallet__cta"
            disabled={!acked}
            onClick={() => navigate("/wallet", { replace: true })}
          >
            Enter {SYN_WALLET_PRODUCT_NAME}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function UnlockGate({ children }: { children: React.ReactNode }) {
  const { ready, hasVault, unlocked, unlock } = useSynWallet();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ready) {
    return (
      <div className="syn-wallet syn-wallet--center">
        <p className="syn-wallet__muted">Opening {SYN_WALLET_PRODUCT_NAME}…</p>
      </div>
    );
  }
  if (!hasVault) return <Navigate to="/wallet/setup" replace />;
  if (unlocked) return <>{children}</>;

  return (
    <div className="syn-wallet syn-wallet--unlock">
      <header className="syn-wallet__hero">
        <p className="syn-wallet__eyebrow">{SYN_WALLET_PRODUCT_NAME}</p>
        <h1 className="syn-wallet__title">Welcome back</h1>
        <p className="syn-wallet__lede">{SYN_WALLET_TAGLINE}</p>
      </header>
      <form
        className="syn-wallet__stack"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          void unlock(pin)
            .catch((err) => setError(err instanceof Error ? err.message : "Unlock failed."))
            .finally(() => setBusy(false));
        }}
      >
        <label className="syn-wallet__field">
          <span>PIN</span>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 12))}
            autoComplete="current-password"
            autoFocus
          />
        </label>
        {error ? <p className="syn-wallet__error">{error}</p> : null}
        <button type="submit" className="syn-wallet__cta" disabled={busy || pin.length < 6}>
          {busy ? "Unlocking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}

function WalletHome() {
  const { publicKey, lock } = useSynWallet();
  const [sol, setSol] = useState<number | null>(null);
  const [tokens, setTokens] = useState<SynTokenBalance[]>([]);
  const [activity, setActivity] = useState<{ signature: string; err: unknown }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [bal, toks, sigs] = await Promise.all([
          fetchSolBalance(publicKey),
          fetchTokenBalances(publicKey).catch(() => [] as SynTokenBalance[]),
          fetchRecentSignatures(publicKey, 8).catch(() => []),
        ]);
        if (cancelled) return;
        setSol(bal.sol);
        setTokens(toks.slice(0, 20));
        setActivity(sigs.map((s) => ({ signature: s.signature, err: s.err })));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load balances.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  async function openSwap() {
    const url = jupiterSwapUrl();
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="syn-wallet">
      <header className="syn-wallet__top">
        <div>
          <p className="syn-wallet__eyebrow">{SYN_WALLET_PRODUCT_NAME}</p>
          <p className="syn-wallet__addr" title={publicKey ?? undefined}>
            {publicKey ? shortenAddress(publicKey, 5) : "—"}
          </p>
        </div>
        <div className="syn-wallet__top-actions">
          <Link to="/wallet/settings" className="syn-wallet__icon-btn" aria-label="Settings">
            ⚙
          </Link>
          <button type="button" className="syn-wallet__icon-btn" onClick={lock} aria-label="Lock">
            🔒
          </button>
        </div>
      </header>

      <section className="syn-wallet__portfolio" aria-live="polite">
        <p className="syn-wallet__portfolio-label">Total SOL</p>
        <p className="syn-wallet__portfolio-value">
          {loading ? "…" : sol == null ? "—" : sol.toLocaleString(undefined, { maximumFractionDigits: 6 })}
          <span> SOL</span>
        </p>
        {error ? <p className="syn-wallet__error">{error}</p> : null}
      </section>

      <nav className="syn-wallet__actions" aria-label="Wallet actions">
        <Link className="syn-wallet__action" to="/wallet/receive">
          <span aria-hidden>↓</span>
          Receive
        </Link>
        <Link className="syn-wallet__action" to="/wallet/send">
          <span aria-hidden>↑</span>
          Send
        </Link>
        <button type="button" className="syn-wallet__action" onClick={() => void openSwap()}>
          <span aria-hidden>⇄</span>
          Swap
        </button>
        <Link className="syn-wallet__action" to="/?scan=">
          <span aria-hidden>◎</span>
          Scan
        </Link>
      </nav>

      <section className="syn-wallet__section">
        <div className="syn-wallet__section-head">
          <h2>Assets</h2>
          <span className="syn-wallet__muted">Robinhood-simple · Phantom-deep</span>
        </div>
        <ul className="syn-wallet__assets">
          <li className="syn-wallet__asset">
            <div>
              <p className="syn-wallet__asset-name">Solana</p>
              <p className="syn-wallet__muted">SOL</p>
            </div>
            <p className="syn-wallet__asset-bal">
              {sol == null ? "—" : sol.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </p>
          </li>
          {tokens.map((t) => (
            <li key={t.mint} className="syn-wallet__asset">
              <div>
                <p className="syn-wallet__asset-name">{shortenAddress(t.mint, 4)}</p>
                <p className="syn-wallet__muted">SPL</p>
              </div>
              <p className="syn-wallet__asset-bal">
                {(t.uiAmount ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </p>
            </li>
          ))}
          {!loading && tokens.length === 0 ? (
            <li className="syn-wallet__empty">No SPL tokens yet — receive or swap to get started.</li>
          ) : null}
        </ul>
      </section>

      <section className="syn-wallet__section">
        <div className="syn-wallet__section-head">
          <h2>Activity</h2>
        </div>
        <ul className="syn-wallet__activity">
          {activity.map((row) => (
            <li key={row.signature}>
              <a
                href={`https://solscan.io/tx/${row.signature}`}
                target="_blank"
                rel="noreferrer"
              >
                {shortenAddress(row.signature, 6)}
              </a>
              <span className={row.err ? "syn-wallet__badge syn-wallet__badge--bad" : "syn-wallet__badge"}>
                {row.err ? "Failed" : "Confirmed"}
              </span>
            </li>
          ))}
          {!loading && activity.length === 0 ? (
            <li className="syn-wallet__empty">No recent transactions.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

function ReceiveView() {
  const { publicKey } = useSynWallet();
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="syn-wallet">
      <Link to="/wallet" className="syn-wallet__back">
        ← Back
      </Link>
      <header className="syn-wallet__hero">
        <h1 className="syn-wallet__title">Receive</h1>
        <p className="syn-wallet__lede">Share your Solana address. Only send SOL / SPL on Solana mainnet.</p>
      </header>
      <div className="syn-wallet__receive-box">
        <p className="syn-wallet__receive-addr">{publicKey}</p>
        <button type="button" className="syn-wallet__cta" onClick={() => void copy()}>
          {copied ? "Copied" : "Copy address"}
        </button>
      </div>
    </div>
  );
}

function SendView() {
  const { keypair } = useSynWallet();
  const navigate = useNavigate();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);

  async function onSend() {
    if (!keypair) return;
    setBusy(true);
    setError(null);
    setSig(null);
    try {
      const signature = await sendSolTransfer(keypair, to, Number(amount));
      setSig(signature);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="syn-wallet">
      <Link to="/wallet" className="syn-wallet__back">
        ← Back
      </Link>
      <header className="syn-wallet__hero">
        <h1 className="syn-wallet__title">Send SOL</h1>
        <p className="syn-wallet__lede">Coinbase-style review: double-check the address before you sign.</p>
      </header>
      <div className="syn-wallet__stack">
        <label className="syn-wallet__field">
          <span>To address</span>
          <input value={to} onChange={(e) => setTo(e.target.value)} spellCheck={false} autoComplete="off" />
        </label>
        <label className="syn-wallet__field">
          <span>Amount (SOL)</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
          />
        </label>
        {error ? <p className="syn-wallet__error">{error}</p> : null}
        {sig ? (
          <p className="syn-wallet__ok">
            Sent.{" "}
            <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer">
              View on Solscan
            </a>
          </p>
        ) : null}
        <button type="button" className="syn-wallet__cta" disabled={busy} onClick={() => void onSend()}>
          {busy ? "Sending…" : "Send"}
        </button>
        {sig ? (
          <button type="button" className="syn-wallet__linkish" onClick={() => navigate("/wallet")}>
            Done
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SettingsView() {
  const { publicKey, lock, wipe } = useSynWallet();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState("");

  return (
    <div className="syn-wallet">
      <Link to="/wallet" className="syn-wallet__back">
        ← Back
      </Link>
      <header className="syn-wallet__hero">
        <h1 className="syn-wallet__title">Security</h1>
        <p className="syn-wallet__lede">Coinbase Wallet habits: lock often, never share your phrase.</p>
      </header>
      <div className="syn-wallet__stack">
        <p className="syn-wallet__muted">Address</p>
        <p className="syn-wallet__receive-addr">{publicKey}</p>
        <button type="button" className="syn-wallet__cta syn-wallet__cta--ghost" onClick={lock}>
          Lock wallet
        </button>
        <label className="syn-wallet__field">
          <span>Type DELETE to wipe this device wallet</span>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
        </label>
        <button
          type="button"
          className="syn-wallet__cta syn-wallet__cta--danger"
          disabled={confirm !== "DELETE"}
          onClick={() => {
            void wipe().then(() => navigate("/wallet/setup", { replace: true }));
          }}
        >
          Wipe local wallet
        </button>
        <p className="syn-wallet__fine">
          Wiping removes encrypted keys from this device only. Your on-chain funds stay if you still have the
          recovery phrase.
        </p>
      </div>
    </div>
  );
}

export function SynWalletPage() {
  return (
    <Routes>
      <Route path="setup" element={<SetupFlow />} />
      <Route
        path="receive"
        element={
          <UnlockGate>
            <ReceiveView />
          </UnlockGate>
        }
      />
      <Route
        path="send"
        element={
          <UnlockGate>
            <SendView />
          </UnlockGate>
        }
      />
      <Route
        path="settings"
        element={
          <UnlockGate>
            <SettingsView />
          </UnlockGate>
        }
      />
      <Route
        index
        element={
          <UnlockGate>
            <WalletHome />
          </UnlockGate>
        }
      />
      <Route path="*" element={<Navigate to="/wallet" replace />} />
    </Routes>
  );
}
