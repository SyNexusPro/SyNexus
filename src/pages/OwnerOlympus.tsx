import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { getAccessToken } from "../lib/authSession";
import { hasStoredOwnerGrant, OWNER_ACCESS_CHANGED } from "../lib/ownerAccess";
import { supabase } from "../lib/supabaseClient";

type Role = { id: string; role: string; agent: string | null; status: string; gate: string };
type Division = { name: string; roles: Role[] };
type Task = { id: string; title: string; status: string; division: string; requiresApproval: boolean };
type Snapshot = {
  commander: string;
  seats: number;
  ready: boolean;
  halted: boolean;
  available: boolean;
  expensesUsd: number | null;
  divisions: Division[];
  tasks: Task[];
};

export function OwnerOlympus() {
  const [owner, setOwner] = useState(() => hasStoredOwnerGrant());
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [task, setTask] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;
    const response = await fetch("/api/owner/olympus", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) {
      setMessage("Project Olympus is available only to the signed-in owner account.");
      return;
    }
    setSnapshot((await response.json()) as Snapshot);
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
  if (signedIn === false) return <Navigate to="/god" replace />;

  async function post(body: Record<string, unknown>) {
    const token = await getAccessToken();
    if (!token) return;
    const response = await fetch("/api/owner/olympus", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as { reason?: string; error?: string } | null;
    setMessage(payload?.reason || payload?.error || "");
    await load();
  }

  const expenses = snapshot?.available === false ? "Data unavailable" : snapshot?.expensesUsd === null ? "Data unavailable" : `$${snapshot?.expensesUsd ?? 0}`;

  return (
    <div className="page analytics-page">
      <header className="analytics-page__head marketing-panel">
        <p className="analytics-page__eyebrow">Owner only</p>
        <h1>Project Olympus</h1>
        <p>
          {snapshot?.commander ?? "Hera"} commands {snapshot?.seats ?? 50} roles. They stay idle until a task arrives. Nothing here deploys or moves money.
        </p>
        <p>
          <Link to="/owner/hera">Talk to Hera</Link>
          {" · "}
          <Link to="/hera-developer">Hera Developer</Link>
        </p>
        <p>Organization ready: {snapshot?.ready ? "yes" : "no"}. Status: {snapshot?.halted ? "shut down" : "idle until assigned"}.</p>
        <p>Operating expenses this month: {expenses}</p>
        <div className="analytics-page__controls">
          <button type="button" className="analytics-page__range" onClick={() => void post({ action: snapshot?.halted ? "resume" : "shutdown" })}>
            {snapshot?.halted ? "Resume" : "Emergency shutdown"}
          </button>
        </div>
      </header>
      <form
        className="marketing-panel"
        onSubmit={(event) => {
          event.preventDefault();
          const next = task.trim();
          if (!next) return;
          setTask("");
          void post({ action: "enqueue", task: next });
        }}
      >
        <label>
          Ask Hera to queue work
          <input value={task} onChange={(event) => setTask(event.target.value)} maxLength={300} />
        </label>
        <button type="submit" className="analytics-page__range">Queue</button>
      </form>
      {message ? <p className="marketing-panel">{message}</p> : null}
      {snapshot?.tasks?.length ? (
        <section className="marketing-panel">
          <h2>Assignments</h2>
          {snapshot.tasks.map((item) => (
            <p key={item.id}>
              {item.division}: {item.title} · {item.status}
              {item.requiresApproval && item.status === "queued" ? (
                <>
                  {" "}
                  <button type="button" className="analytics-page__range" onClick={() => void post({ action: "decide", id: item.id, approve: true })}>
                    Approve
                  </button>
                  <button type="button" className="analytics-page__range" onClick={() => void post({ action: "decide", id: item.id, approve: false })}>
                    Reject
                  </button>
                </>
              ) : null}
            </p>
          ))}
        </section>
      ) : (
        <p className="marketing-panel">No assignments yet.</p>
      )}
      {snapshot?.divisions.map((division) => (
        <section key={division.name} className="marketing-panel">
          <h2>{division.name}</h2>
          {division.roles.map((role) => (
            <p key={role.id}>
              {role.role} · {role.agent ?? "Queued desk"} · {role.status}
              {role.gate !== "none" ? ` · needs your approval before ${role.gate}` : ""}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
