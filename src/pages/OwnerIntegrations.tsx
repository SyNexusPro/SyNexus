import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getAccessToken } from "../lib/authSession";
import { hasStoredOwnerGrant, OWNER_ACCESS_CHANGED } from "../lib/ownerAccess";
import { isOwnerScreen } from "../lib/ownerScreen";
import { supabase } from "../lib/supabaseClient";

type Row = { service: string; variable: string; configured: boolean; required: boolean };

export function OwnerIntegrations() {
  const [owner, setOwner] = useState(() => hasStoredOwnerGrant());
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const response = await fetch("/api/owner/integrations", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      setMessage("Integration status is available only to the signed-in owner account.");
      return;
    }
    const body = (await response.json()) as { integrations?: Row[] };
    setRows(body.integrations ?? []);
  }, []);

  useEffect(() => {
    const sync = () => setOwner(hasStoredOwnerGrant());
    window.addEventListener(OWNER_ACCESS_CHANGED, sync);
    return () => window.removeEventListener(OWNER_ACCESS_CHANGED, sync);
  }, []);

  useEffect(() => {
    if (!owner) return;
    let alive = true;
    void (async () => {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (!alive) return;
      setSignedIn(Boolean(session));
      if (session) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load, owner]);

  if (!owner) return <Navigate to="/" replace />;
  if (signedIn === false) return <Navigate to={isOwnerScreen() ? "/god" : "/"} replace />;

  return (
    <section className="page page--command">
      <h1>Integration status</h1>
      <p>Names only. Secret values stay on the server.</p>
      {message ? <p>{message}</p> : null}
      {rows ? (
        <ul>
          {rows.map((row) => (
            <li key={row.variable}>
              {row.service}: {row.configured ? "configured" : "missing"} ({row.variable}
              {row.required ? ", required" : ", optional"})
            </li>
          ))}
        </ul>
      ) : (
        <p>Checking the server environment.</p>
      )}
      <p>
        <Link to="/owner/olympus">Olympus</Link>
      </p>
    </section>
  );
}
