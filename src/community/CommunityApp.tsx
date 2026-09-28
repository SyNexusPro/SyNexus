import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CommunityHero } from "./CommunityHero";
import {
  acceptGuidelines,
  createPost,
  deletePost,
  fetchFeed,
  fetchLiveQuotes,
  fetchMemberCount,
  fetchRooms,
  hasAcceptedGuidelines,
  setBookmarked,
  setLiked,
  setRoomMembership,
  timeAgo,
  type CommunityPost,
  type CommunityRoom,
  type FeedFilter,
  type LiveQuote,
} from "./services/communityFeed";
import { supabase } from "../lib/supabaseClient";

type Section =
  | "home"
  | "explore"
  | "communities"
  | "messages"
  | "bookmarks"
  | "markets"
  | "learn"
  | "profile";

const NAV: { id: Section; label: string; icon: ReactNode }[] = [
  { id: "home", label: "Home", icon: <path d="M3 11l9-7 9 7v9h-6v-6H9v6H3v-9z" /> },
  { id: "explore", label: "Explore", icon: <path d="M11 4a7 7 0 100 14 7 7 0 000-14zm9 16l-4-4" /> },
  { id: "communities", label: "Communities", icon: <path d="M9 11a3 3 0 100-6 3 3 0 000 6zm7 0a2.5 2.5 0 100-5M3 19c0-3 3-5 6-5s6 2 6 5m1-5c2.5 0 5 1.5 5 4.5" /> },
  { id: "messages", label: "Messages", icon: <path d="M4 5h16v11H9l-5 4V5z" /> },
  { id: "bookmarks", label: "Bookmarks", icon: <path d="M6 3h12v18l-6-4-6 4V3z" /> },
  { id: "markets", label: "Market Insights", icon: <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" /> },
  { id: "learn", label: "Learning Hub", icon: <path d="M2 9l10-5 10 5-10 5L2 9zm4 2.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" /> },
  { id: "profile", label: "Profile", icon: <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 9c0-4 3-6 7-6s7 2 7 6" /> },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

function formatPrice(value: number): string {
  if (value >= 1000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toPrecision(3)}`;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(n);
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) return <img className="cx-avatar" src={src} alt="" loading="lazy" />;
  return (
    <span className="cx-avatar cx-avatar--initial" aria-hidden>
      {name.trim().charAt(0).toUpperCase() || "S"}
    </span>
  );
}

function LiveMarkets({ quotes, error }: { quotes: LiveQuote[]; error: string | null }) {
  return (
    <section className="cx-panel">
      <h2 className="cx-panel__title">
        <span className="cx-live-dot" aria-hidden /> Live Markets
      </h2>
      {quotes.length ? (
        <ul className="cx-markets">
          {quotes.map((q) => (
            <li key={q.symbol}>
              <span className="cx-markets__sym">{q.symbol}</span>
              <span className="cx-markets__price">{formatPrice(q.price)}</span>
              <span className={`cx-markets__chg${(q.changePct ?? 0) < 0 ? " is-down" : ""}`}>
                {q.changePct == null ? "—" : `${q.changePct > 0 ? "+" : ""}${q.changePct.toFixed(1)}%`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cx-muted">{error ?? "Loading prices…"}</p>
      )}
    </section>
  );
}

function PostCard({
  post,
  mine,
  onToggleLike,
  onToggleBookmark,
  onDelete,
}: {
  post: CommunityPost;
  mine: boolean;
  onToggleLike: () => void;
  onToggleBookmark: () => void;
  onDelete: () => void;
}) {
  const hasLink = /https?:\/\//i.test(post.body);
  return (
    <article className="cx-post">
      <header className="cx-post__head">
        <Avatar name={post.authorName} src={post.authorAvatar} />
        <div className="cx-post__who">
          <strong>{post.authorName}</strong>
          <span className="cx-verified" aria-label="Verified member">✓</span>
          <span className="cx-muted">
            {post.authorHandle ? `@${post.authorHandle} · ` : ""}
            {timeAgo(post.createdAt)}
          </span>
        </div>
        {mine ? (
          <button type="button" className="cx-post__more" onClick={onDelete} aria-label="Delete post">
            ✕
          </button>
        ) : null}
      </header>
      <p className="cx-post__body">{post.body}</p>
      {post.tags.length ? (
        <div className="cx-post__tags">
          {post.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
      ) : null}
      {hasLink ? <p className="cx-post__scan">⚠ Links are not scanned yet. Never connect your wallet to unknown sites.</p> : null}
      <footer className="cx-post__actions">
        <button type="button" className={post.likedByMe ? "is-on" : undefined} onClick={onToggleLike} aria-pressed={post.likedByMe}>
          <Icon><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" /></Icon>
          {post.likeCount}
        </button>
        <button type="button" className={post.bookmarkedByMe ? "is-on" : undefined} onClick={onToggleBookmark} aria-pressed={post.bookmarkedByMe}>
          <Icon><path d="M6 3h12v18l-6-4-6 4V3z" /></Icon>
          {post.bookmarkedByMe ? "Saved" : "Save"}
        </button>
      </footer>
    </article>
  );
}

export function CommunityApp({ owner }: { owner: boolean }) {
  const [section, setSection] = useState<Section>("home");
  const [roomFilter, setRoomFilter] = useState<CommunityRoom | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<CommunityRoom[]>([]);
  const [quotes, setQuotes] = useState<LiveQuote[]>([]);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [guidelinesOk, setGuidelinesOk] = useState<boolean | null>(null);
  const [draft, setDraft] = useState("");
  const [draftRoom, setDraftRoom] = useState<string>("");
  const [posting, setPosting] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  const filter: FeedFilter | null = useMemo(() => {
    if (roomFilter) return { kind: "room", communityId: roomFilter.id };
    if (section === "home") return { kind: "latest" };
    if (section === "explore") return { kind: "top" };
    if (section === "bookmarks") return { kind: "bookmarks" };
    if (section === "profile") return { kind: "mine" };
    return null;
  }, [section, roomFilter]);

  const loadFeed = useCallback(async () => {
    if (!filter) return;
    setFeedLoading(true);
    setFeedError(null);
    try {
      setPosts(await fetchFeed(filter));
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Could not load the feed.");
      setPosts([]);
    } finally {
      setFeedLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    void supabase?.auth.getSession().then(({ data }) => setMyId(data.session?.user.id ?? null));
    void hasAcceptedGuidelines().then(setGuidelinesOk, () => setGuidelinesOk(false));
    void fetchRooms().then(setRooms, () => setRooms([]));
    void fetchMemberCount().then(setMemberCount);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = () =>
      fetchLiveQuotes(controller.signal).then(
        (q) => {
          setQuotes(q);
          setQuotesError(null);
        },
        (err: unknown) => {
          if (!controller.signal.aborted) setQuotesError(err instanceof Error ? err.message : "Live markets unavailable.");
        },
      );
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  const go = (next: Section) => {
    setSection(next);
    setRoomFilter(null);
  };

  const updatePost = (id: string, patch: Partial<CommunityPost>) =>
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const toggleLike = async (post: CommunityPost) => {
    const next = !post.likedByMe;
    updatePost(post.id, { likedByMe: next, likeCount: Math.max(0, post.likeCount + (next ? 1 : -1)) });
    try {
      await setLiked(post.id, next);
    } catch {
      updatePost(post.id, { likedByMe: post.likedByMe, likeCount: post.likeCount });
    }
  };

  const toggleBookmark = async (post: CommunityPost) => {
    const next = !post.bookmarkedByMe;
    updatePost(post.id, { bookmarkedByMe: next });
    try {
      await setBookmarked(post.id, next);
      if (!next && section === "bookmarks") setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch {
      updatePost(post.id, { bookmarkedByMe: post.bookmarkedByMe });
    }
  };

  const removePost = async (post: CommunityPost) => {
    if (!window.confirm("Delete this post?")) return;
    try {
      await deletePost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Could not delete the post.");
    }
  };

  const submitPost = async () => {
    setPosting(true);
    setComposerError(null);
    try {
      await createPost(draft, draftRoom || roomFilter?.id || null);
      setDraft("");
      await loadFeed();
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : "Could not publish your post.");
    } finally {
      setPosting(false);
    }
  };

  const agree = async () => {
    setComposerError(null);
    try {
      await acceptGuidelines();
      setGuidelinesOk(true);
    } catch (err) {
      setComposerError(err instanceof Error ? err.message : "Could not save your agreement.");
    }
  };

  const toggleRoom = async (room: CommunityRoom) => {
    const next = !room.joined;
    setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, joined: next } : r)));
    try {
      await setRoomMembership(room.id, next);
    } catch {
      setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, joined: room.joined } : r)));
    }
  };

  const composer = (
    <section className="cx-composer">
      {guidelinesOk === false ? (
        <div className="cx-guidelines">
          <p>
            Before posting, agree to the community guidelines: be respectful, no scams or shilling, never ask
            for seed phrases or private keys, and disclose if you hold what you promote.
          </p>
          <button type="button" className="cx-btn" onClick={() => void agree()}>
            I agree — let me post
          </button>
        </div>
      ) : (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Share an idea, a chart take, or news… use #tags"
            maxLength={2000}
            rows={3}
            aria-label="Write a post"
          />
          <div className="cx-composer__row">
            <select value={draftRoom} onChange={(e) => setDraftRoom(e.target.value)} aria-label="Post to community">
              <option value="">{roomFilter ? roomFilter.name : "General feed"}</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <span className="cx-muted">{draft.length}/2000</span>
            <button type="button" className="cx-btn" disabled={posting || !draft.trim()} onClick={() => void submitPost()}>
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </>
      )}
      {composerError ? <p className="cx-error">{composerError}</p> : null}
    </section>
  );

  const feed = (
    <div className="cx-feed" aria-busy={feedLoading}>
      {feedLoading ? (
        <>
          <div className="community__skeleton" />
          <div className="community__skeleton" />
        </>
      ) : feedError ? (
        <p className="cx-error">{feedError}</p>
      ) : posts.length ? (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            mine={post.authorId === myId}
            onToggleLike={() => void toggleLike(post)}
            onToggleBookmark={() => void toggleBookmark(post)}
            onDelete={() => void removePost(post)}
          />
        ))
      ) : (
        <div className="cx-empty">
          <span className="community__sentinel" aria-hidden>◈</span>
          <p>
            {section === "bookmarks"
              ? "Nothing saved yet. Tap Save on any post."
              : section === "profile"
                ? "You haven't posted yet."
                : "No posts yet — be the first to start the conversation."}
          </p>
        </div>
      )}
    </div>
  );

  let main: ReactNode;
  if (section === "communities" && !roomFilter) {
    main = (
      <div className="cx-rooms">
        {rooms.length ? (
          rooms.map((room) => (
            <article key={room.id} className="cx-room">
              <span className="cx-room__icon" aria-hidden>{room.icon ?? "◈"}</span>
              <div className="cx-room__text">
                <button type="button" className="cx-room__name" onClick={() => setRoomFilter(room)}>
                  {room.name}
                </button>
                <p className="cx-muted">{room.description}</p>
              </div>
              <button type="button" className={`cx-btn${room.joined ? " cx-btn--ghost" : ""}`} onClick={() => void toggleRoom(room)}>
                {room.joined ? "Joined" : "Join"}
              </button>
            </article>
          ))
        ) : (
          <p className="cx-muted">Communities are loading or not set up yet.</p>
        )}
      </div>
    );
  } else if (section === "messages") {
    main = (
      <div className="cx-empty">
        <span className="community__sentinel" aria-hidden>✉</span>
        <p>Private messages are coming soon, with Sentinel scam screening built in.</p>
      </div>
    );
  } else if (section === "markets") {
    main = (
      <>
        <LiveMarkets quotes={quotes} error={quotesError} />
        <Link className="cx-btn cx-btn--block" to="/pulse">Open full market intelligence</Link>
      </>
    );
  } else if (section === "learn") {
    main = (
      <div className="cx-rooms">
        <Link className="cx-room cx-room--link" to="/blog">
          <span className="cx-room__icon" aria-hidden>✦</span>
          <div className="cx-room__text">
            <strong>SyNexus Journal</strong>
            <p className="cx-muted">Wallet safety, scam spotting and market basics.</p>
          </div>
        </Link>
        <Link className="cx-room cx-room--link" to="/faq">
          <span className="cx-room__icon" aria-hidden>?</span>
          <div className="cx-room__text">
            <strong>FAQ</strong>
            <p className="cx-muted">How SyNexus, Sentinel and swaps work.</p>
          </div>
        </Link>
        <Link className="cx-room cx-room--link" to="/trust">
          <span className="cx-room__icon" aria-hidden>🛡</span>
          <div className="cx-room__text">
            <strong>Trust & Security</strong>
            <p className="cx-muted">How we protect members and their accounts.</p>
          </div>
        </Link>
      </div>
    );
  } else {
    main = (
      <>
        {roomFilter ? (
          <div className="cx-room-bar">
            <button type="button" className="cx-btn cx-btn--ghost" onClick={() => setRoomFilter(null)}>‹ All communities</button>
            <strong>{roomFilter.icon} {roomFilter.name}</strong>
          </div>
        ) : null}
        {section !== "bookmarks" ? composer : null}
        {feed}
      </>
    );
  }

  const title = roomFilter ? roomFilter.name : NAV.find((n) => n.id === section)?.label ?? "Home";

  return (
    <main className="community cx">
      <CommunityHero compact />

      <div className="cx-shell">
        <nav className="cx-nav" aria-label="Community">
          <div className="cx-nav__brand">
            <span className="cx-nav__x" aria-hidden>✕</span> SyNexus <em>Pro</em>
            {owner ? <span className="cx-badge">Owner</span> : null}
          </div>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? "is-active" : undefined}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => go(item.id)}
            >
              <Icon>{item.icon}</Icon>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="cx-main">
          <h2 className="cx-main__title">{title}</h2>
          {main}
        </div>

        <aside className="cx-rail">
          {section !== "markets" ? <LiveMarkets quotes={quotes} error={quotesError} /> : null}
          <section className="cx-panel">
            <h2 className="cx-panel__title">Global Community</h2>
            <p className="cx-members">
              <strong>{memberCount != null ? `${formatCount(memberCount)}+` : "—"}</strong>
              <span>Verified members</span>
            </p>
          </section>
          <section className="cx-panel cx-shield">
            <span className="cx-shield__icon" aria-hidden>
              <Icon><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3zm-3 9l2 2 4-4" /></Icon>
            </span>
            <div>
              <strong>Protected by Sentinel</strong>
              <p className="cx-muted">Smart anti-scam security. Wallet-secret requests are blocked.</p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
