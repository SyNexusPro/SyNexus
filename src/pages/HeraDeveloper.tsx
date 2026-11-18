import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  decideDeveloperProposal,
  fetchDeveloperProposals,
  type DeveloperProposal,
} from "../lib/heraDeveloper";
import { decideHeraSharedLesson, fetchHeraMind } from "../lib/heraMind";
import { getAccessToken } from "../lib/authSession";
import { hasStoredOwnerGrant, OWNER_ACCESS_CHANGED } from "../lib/ownerAccess";
import { isOwnerScreen } from "../lib/ownerScreen";
import { supabase } from "../lib/supabaseClient";

export function HeraDeveloper() {
  const [owner, setOwner] = useState(() => hasStoredOwnerGrant());
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [proposals, setProposals] = useState<DeveloperProposal[] | null>(null);
  const [lessons, setLessons] = useState<{ id: string; lesson: string }[]>([]);
  const [olympus, setOlympus] = useState<string>("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const next = await fetchDeveloperProposals();
    setProposals(next);
    if (next === null) setMessage("These proposals are available only to the signed-in owner account.");
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
      if (session) {
        await load();
        const mind = await fetchHeraMind();
        if (alive) setLessons(mind?.proposals ?? []);
        const token = await getAccessToken();
        const roster = token
          ? await fetch("/api/owner/olympus", { headers: { Authorization: `Bearer ${token}` } })
          : null;
        const body = roster?.ok ? ((await roster.json()) as { seats?: number; agents?: string[] }) : null;
        if (alive && body?.seats) setOlympus(`${body.seats} duties across ${body.agents?.length ?? 0} existing agents.`);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load, owner]);

  if (!owner) return <Navigate to="/" replace />;

  async function decide(proposal: DeveloperProposal, action: "approve" | "reject" | "request_changes") {
    setBusyId(proposal.id);
    setMessage(null);
    const result = await decideDeveloperProposal(proposal, action, note);
    setMessage(result.message);
    setBusyId(null);
    if (result.ok) await load();
  }

  if (signedIn === false) return <Navigate to={isOwnerScreen() ? "/god" : "/"} replace />;

  return (
    <div className="page analytics-page">
      <header className="analytics-page__head marketing-panel">
        <p className="analytics-page__eyebrow">Private owner desk</p>
        <h1>Hera Developer</h1>
        <p>
          Hera can prepare a change and ask you to approve it. Approve, reject, and request changes are recorded on the
          server. None of them merge or deploy.
        </p>
        <p>Ask Hera for the developer report when you want her to read a proposal aloud.</p>
      </header>
      {message ? <p className="marketing-panel">{message}</p> : null}
      {proposals === null ? <p className="marketing-panel">Checking the owner session…</p> : null}
      {proposals?.length === 0 ? <p className="marketing-panel">No proposals yet.</p> : null}
      {proposals?.map((proposal) => (
        <article key={proposal.id} className="marketing-panel">
          <p className="analytics-page__eyebrow">{proposal.status}</p>
          <h2>{proposal.title}</h2>
          <p>{proposal.discovery}</p>
          <p>{proposal.changeSummary}</p>
          <p>{proposal.why}</p>
          <p>Tests passed: {proposal.testsPassed || "None recorded."}</p>
          <p>Tests failed: {proposal.testsFailed || "None recorded."}</p>
          <p>Benefits: {proposal.benefits}</p>
          <p>Risks: {proposal.risks}</p>
          <p>
            Ready for your decision: {proposal.ready ? "yes" : "no"}. Approving this revision does not merge or deploy it.
          </p>
          <p>Revision: {proposal.testedSha}</p>
          {proposal.branchName ? <p>Branch: {proposal.branchName}</p> : null}
          {proposal.sensitive ? <p>This proposal touches a protected system. Approval still does not deploy it.</p> : null}
          <p>Rollback: {proposal.rollback}</p>
          {proposal.status === "proposed" ? (
            <>
              <label>
                Note
                <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
              </label>
              <div className="analytics-page__controls">
                <button type="button" className="analytics-page__range" disabled={busyId === proposal.id} onClick={() => void decide(proposal, "approve")}>
                  Approve
                </button>
                <button type="button" className="analytics-page__range" disabled={busyId === proposal.id} onClick={() => void decide(proposal, "reject")}>
                  Reject
                </button>
                <button type="button" className="analytics-page__range" disabled={busyId === proposal.id} onClick={() => void decide(proposal, "request_changes")}>
                  Request changes
                </button>
              </div>
            </>
          ) : null}
        </article>
      ))}
      <section className="marketing-panel">
        <h2>Olympus</h2>
        <p>Hera commands the existing agents. {olympus || "Checking the roster…"} <Link to="/owner/olympus">Open Olympus</Link></p>
      </section>
      <section className="marketing-panel">
        <h2>Shared learning</h2>
        <p>These are general lessons waiting for your approval. Approving one teaches every person. It does not change Hera’s model or deploy code.</p>
        {lessons.length === 0 ? <p>No shared lessons are waiting.</p> : null}
        {lessons.map((lesson) => (
          <p key={lesson.id}>
            {lesson.lesson}{" "}
            <button
              type="button"
              className="analytics-page__range"
              onClick={() => void decideHeraSharedLesson(lesson.id, true).then(() => setLessons((current) => current.filter((item) => item.id !== lesson.id)))}
            >
              Approve
            </button>
          </p>
        ))}
      </section>
    </div>
  );
}
