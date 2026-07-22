import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { NonCustodialDisclaimer } from "../components/NonCustodialDisclaimer";

type BlogIndexEntry = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
};

type BlogBlock = { type: "h2" | "p"; text: string };

type BlogPost = BlogIndexEntry & {
  author: string;
  blocks: BlogBlock[];
  cta: string;
  trustLine: string;
  tags: string[];
};

export function BlogIndex() {
  const [posts, setPosts] = useState<BlogIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/blog/index.json")
      .then((r) => {
        if (!r.ok) throw new Error("Could not load journal");
        return r.json() as Promise<BlogIndexEntry[]>;
      })
      .then((data) => {
        if (!cancelled) setPosts(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page blog-page">
      <section className="blog-page__hero marketing-panel">
        <p className="blog-page__eyebrow">SyNexus Journal</p>
        <h1 className="blog-page__title">Sentinel intelligence, in writing</h1>
        <p className="blog-page__lede">
          Daily articles on Solana risk reads, exit liquidity, and how SyNexus helps operators decide before they
          sign. Auto-published by the growth engine — trust-first, no hype.
        </p>
      </section>

      {loading && <p className="blog-page__status">Loading articles…</p>}
      {error && <p className="blog-page__status blog-page__status--error">{error}</p>}

      {!loading && !error && posts.length === 0 && (
        <p className="blog-page__status">First article publishing soon. Run the growth engine to seed content.</p>
      )}

      <ul className="blog-page__list">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link className="blog-card marketing-panel" to={`/blog/${post.slug}`}>
              <time className="blog-card__date" dateTime={post.date}>
                {post.date}
              </time>
              <h2 className="blog-card__title">{post.title}</h2>
              <p className="blog-card__excerpt">{post.excerpt}</p>
              <span className="blog-card__read">Read article →</span>
            </Link>
          </li>
        ))}
      </ul>

      <NonCustodialDisclaimer className="blog-page__disclaimer" />
    </div>
  );
}

export function BlogPostView() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/blog/posts/${slug}.json`)
      .then((r) => {
        if (!r.ok) throw new Error("Article not found");
        return r.json() as Promise<BlogPost>;
      })
      .then((data) => {
        if (!cancelled) setPost(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="page blog-page">
        <p className="blog-page__status">Loading…</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="page blog-page">
        <p className="blog-page__status blog-page__status--error">{error ?? "Not found"}</p>
        <Link className="blog-page__back" to="/blog">
          ← Back to journal
        </Link>
      </div>
    );
  }

  return (
    <article className="page blog-page blog-article">
      <header className="blog-article__header marketing-panel">
        <Link className="blog-page__back" to="/blog">
          ← Journal
        </Link>
        <time className="blog-article__date" dateTime={post.date}>
          {post.date}
        </time>
        <h1 className="blog-article__title">{post.title}</h1>
        <p className="blog-article__byline">{post.author}</p>
        <p className="blog-article__excerpt">{post.excerpt}</p>
      </header>

      <div className="blog-article__body marketing-panel">
        {post.blocks.map((block, i) =>
          block.type === "h2" ? (
            <h2 key={i}>{block.text}</h2>
          ) : (
            <p key={i}>{block.text}</p>
          ),
        )}
        <p className="blog-article__cta">
          <Link to="/">Run a free Sentinel scan →</Link>
        </p>
        <p className="blog-article__trust">{post.trustLine}</p>
      </div>
    </article>
  );
}
