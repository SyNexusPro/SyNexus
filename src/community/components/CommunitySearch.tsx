import { useState, type FormEvent } from "react";

/**
 * Search UI only. There is no community search API yet, so a submit never
 * invents members, posts, or topics.
 */
export function CommunitySearch() {
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setNotice("Enter a member, topic, hashtag, community, or crypto to search.");
      return;
    }
    setNotice("Search is coming soon. It will cover members, posts, hashtags, communities, and crypto topics.");
  }

  return (
    <form className="cx-search" role="search" onSubmit={onSubmit}>
      <label className="cx-search__label" htmlFor="cx-community-search">
        Search SyNexus
      </label>
      <div className="cx-search__row">
        <input
          id="cx-community-search"
          type="search"
          value={query}
          placeholder="Search members, topics, or crypto..."
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setNotice(null);
          }}
        />
        <button type="submit">Search</button>
      </div>
      {notice ? (
        <p className="cx-search__soon" role="status">
          {notice}
        </p>
      ) : null}
    </form>
  );
}
