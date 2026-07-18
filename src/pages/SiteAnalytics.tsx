import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { OWNER_GRANT_KEY } from "../lib/ownerAccess";
import { fetchSiteAnalyticsSummary, type SiteAnalyticsSummary } from "../lib/siteAnalytics";

function readOwnerGrant(): string | null {
  try {
    const raw = localStorage.getItem(OWNER_GRANT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { grant?: string; expiresAt?: number };
    if (!parsed.grant || !parsed.expiresAt || parsed.expiresAt <= Date.now()) return null;
    return parsed.grant;
  } catch {
    return null;
  }
}

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <article className="analytics-stat">
      <p className="analytics-stat__label">{label}</p>
      <p className="analytics-stat__value">{value}</p>
      {hint ? <p className="analytics-stat__hint">{hint}</p> : null}
    </article>
  );
}

export function SiteAnalytics() {
  const [days, setDays] = useState(7);
  const [grant] = useState(readOwnerGrant);
  const [data, setData] = useState<SiteAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(Boolean(grant));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!grant) return;
    setLoading(true);
    setError(null);
    try {
      const summary = await fetchSiteAnalyticsSummary(grant, days);
      setData(summary);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [grant, days]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!grant) {
    return (
      <div className="page analytics-page">
        <header className="analytics-page__head marketing-panel">
          <p className="analytics-page__eyebrow">Owner only</p>
          <h1>Site analytics</h1>
          <p>
            Sign in with god mode at <Link to="/god">/god</Link> to view live traffic, sign-ins, and sign-outs.
          </p>
        </header>
      </div>
    );
  }

  return (
    <div className="page analytics-page">
      <header className="analytics-page__head marketing-panel">
        <p className="analytics-page__eyebrow">Synexus telemetry</p>
        <h1>Site analytics</h1>
        <p>Real visitors, page views, and auth events from your Supabase analytics table.</p>
        <div className="analytics-page__controls">
          {[7, 30, 90].map((option) => (
            <button
              key={option}
              type="button"
              className={`analytics-page__range${days === option ? " analytics-page__range--active" : ""}`}
              onClick={() => setDays(option)}
            >
              {option}d
            </button>
          ))}
          <button type="button" className="analytics-page__refresh" disabled={loading} onClick={() => void load()}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {error ? (
        <p className="analytics-page__error" role="alert">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <section className="analytics-grid">
            <StatCard label="Page views" value={data.totals.pageViews.toLocaleString()} />
            <StatCard
              label="Unique visitors"
              value={data.totals.uniqueVisitors.toLocaleString()}
              hint="By anonymous visitor id in browser"
            />
            <StatCard label="Sign ins" value={data.totals.signIns.toLocaleString()} />
            <StatCard label="Sign ups" value={data.totals.signUps.toLocaleString()} />
            <StatCard label="Sign outs" value={data.totals.signOuts.toLocaleString()} />
            <StatCard label="Magic links sent" value={data.totals.magicLinks.toLocaleString()} />
            <StatCard label="Token views" value={data.totals.tokenViews.toLocaleString()} />
            <StatCard label="Biometric sign ins" value={data.totals.biometricSignIns.toLocaleString()} />
          </section>

          <section className="analytics-panel marketing-panel">
            <h2>Daily activity</h2>
            {data.daily.length ? (
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Views</th>
                      <th>Visitors</th>
                      <th>Sign ins</th>
                      <th>Sign ups</th>
                      <th>Sign outs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.map((row) => (
                      <tr key={row.date}>
                        <td>{row.date}</td>
                        <td>{row.pageViews}</td>
                        <td>{row.uniqueVisitors}</td>
                        <td>{row.signIns}</td>
                        <td>{row.signUps}</td>
                        <td>{row.signOuts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="analytics-page__empty">No events in this range yet.</p>
            )}
          </section>

          <section className="analytics-panel marketing-panel">
            <h2>Top pages</h2>
            {data.topPages.length ? (
              <ul className="analytics-top-pages">
                {data.topPages.map((row) => (
                  <li key={row.path}>
                    <span className="analytics-top-pages__path">{row.path}</span>
                    <span className="analytics-top-pages__meta">
                      {row.views} views · {row.uniqueVisitors} visitors
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="analytics-page__empty">No page views recorded yet.</p>
            )}
          </section>

          <section className="analytics-panel marketing-panel">
            <h2>Recent events</h2>
            {data.recentEvents.length ? (
              <ul className="analytics-recent">
                {data.recentEvents.map((row, index) => (
                  <li key={`${row.createdAt}-${index}`}>
                    <span className="analytics-recent__type">{row.eventType}</span>
                    <span className="analytics-recent__path">{row.path}</span>
                    <time className="analytics-recent__time">
                      {new Date(row.createdAt).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="analytics-page__empty">Waiting for first events…</p>
            )}
          </section>

          <p className="analytics-page__foot">
            Updated {new Date(data.updatedAt).toLocaleString()} ·{" "}
            <Link to="/marketing-command">Marketing Command</Link>
            {" · "}
            <Link to="/pulse">Pulse</Link>
          </p>
        </>
      ) : loading ? (
        <p className="analytics-page__empty">Loading analytics…</p>
      ) : null}
    </div>
  );
}
