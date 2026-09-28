import { supabase } from "../../lib/supabaseClient";

export type CommunityPost = {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string | null;
  authorAvatar: string | null;
  body: string;
  tags: string[];
  communityId: string | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
};

export type CommunityRoom = {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string | null;
  joined: boolean;
};

export type LiveQuote = {
  symbol: string;
  name: string;
  price: number;
  changePct: number | null;
};

type PostRow = {
  id: string;
  author_id: string;
  author_name: string;
  author_handle: string | null;
  author_avatar: string | null;
  body: string;
  tags: string[] | null;
  community_id: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
};

const POST_COLUMNS =
  "id, author_id, author_name, author_handle, author_avatar, body, tags, community_id, like_count, comment_count, created_at";

export const COMMUNITY_GUIDELINES_VERSION = 1;

function client() {
  if (!supabase) throw new Error("Community is unavailable right now.");
  return supabase;
}

async function currentUserId(): Promise<string> {
  const { data } = await client().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Sign in to continue.");
  return id;
}

function friendlyError(message: string | undefined, fallback: string): Error {
  const text = message ?? "";
  if (/relation .* does not exist|schema cache/i.test(text)) {
    return new Error("The community feed is still being set up.");
  }
  if (/row-level security|violates row-level/i.test(text)) {
    return new Error("Accept the community guidelines before posting.");
  }
  if (/wallet secrets|Slow down/i.test(text)) return new Error(text.replace(/^.*?:\s*/, ""));
  return new Error(text || fallback);
}

async function decorate(rows: PostRow[]): Promise<CommunityPost[]> {
  if (!rows.length) return [];
  const userId = await currentUserId();
  const ids = rows.map((r) => r.id);
  const [likes, marks] = await Promise.all([
    client().from("community_post_likes").select("post_id").eq("user_id", userId).in("post_id", ids),
    client().from("community_bookmarks").select("post_id").eq("user_id", userId).in("post_id", ids),
  ]);
  const liked = new Set((likes.data ?? []).map((r: { post_id: string }) => r.post_id));
  const marked = new Set((marks.data ?? []).map((r: { post_id: string }) => r.post_id));
  return rows.map((r) => ({
    id: r.id,
    authorId: r.author_id,
    authorName: r.author_name,
    authorHandle: r.author_handle,
    authorAvatar: r.author_avatar,
    body: r.body,
    tags: r.tags ?? [],
    communityId: r.community_id,
    likeCount: r.like_count,
    commentCount: r.comment_count,
    createdAt: r.created_at,
    likedByMe: liked.has(r.id),
    bookmarkedByMe: marked.has(r.id),
  }));
}

export type FeedFilter =
  | { kind: "latest" }
  | { kind: "top" }
  | { kind: "room"; communityId: string }
  | { kind: "mine" }
  | { kind: "bookmarks" };

export async function fetchFeed(filter: FeedFilter, limit = 30): Promise<CommunityPost[]> {
  if (filter.kind === "bookmarks") {
    const userId = await currentUserId();
    const { data, error } = await client()
      .from("community_bookmarks")
      .select(`created_at, community_posts(${POST_COLUMNS})`)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw friendlyError(error.message, "Could not load bookmarks.");
    const rows = (data ?? [])
      .map((r) => (r as unknown as { community_posts: PostRow | null }).community_posts)
      .filter((r): r is PostRow => Boolean(r));
    return decorate(rows);
  }

  let query = client().from("community_posts").select(POST_COLUMNS).eq("status", "published");
  if (filter.kind === "room") query = query.eq("community_id", filter.communityId);
  if (filter.kind === "mine") query = query.eq("author_id", await currentUserId());
  query =
    filter.kind === "top"
      ? query.order("like_count", { ascending: false }).order("created_at", { ascending: false })
      : query.order("created_at", { ascending: false });
  const { data, error } = await query.limit(limit);
  if (error) throw friendlyError(error.message, "Could not load the feed.");
  return decorate((data ?? []) as PostRow[]);
}

export async function createPost(body: string, communityId: string | null): Promise<void> {
  const text = body.trim();
  if (!text) throw new Error("Write something first.");
  if (text.length > 2000) throw new Error("Posts are limited to 2,000 characters.");
  const tags = Array.from(new Set((text.match(/#[A-Za-z0-9_]{2,24}/g) ?? []).map((t) => t.slice(1)))).slice(0, 5);
  const { error } = await client()
    .from("community_posts")
    .insert({ body: text, community_id: communityId, tags });
  if (error) throw friendlyError(error.message, "Could not publish your post.");
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await client().from("community_posts").delete().eq("id", postId);
  if (error) throw friendlyError(error.message, "Could not delete the post.");
}

export async function setLiked(postId: string, liked: boolean): Promise<void> {
  const userId = await currentUserId();
  const table = client().from("community_post_likes");
  const { error } = liked
    ? await table.insert({ post_id: postId, user_id: userId })
    : await table.delete().eq("post_id", postId).eq("user_id", userId);
  if (error && !/duplicate key/i.test(error.message)) throw friendlyError(error.message, "Could not update like.");
}

export async function setBookmarked(postId: string, bookmarked: boolean): Promise<void> {
  const userId = await currentUserId();
  const table = client().from("community_bookmarks");
  const { error } = bookmarked
    ? await table.insert({ post_id: postId, user_id: userId })
    : await table.delete().eq("post_id", postId).eq("user_id", userId);
  if (error && !/duplicate key/i.test(error.message)) throw friendlyError(error.message, "Could not update bookmark.");
}

export async function hasAcceptedGuidelines(): Promise<boolean> {
  const userId = await currentUserId();
  const { data } = await client()
    .from("community_profiles")
    .select("guidelines_version, guidelines_accepted_at")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data?.guidelines_accepted_at && data.guidelines_version === COMMUNITY_GUIDELINES_VERSION);
}

export async function acceptGuidelines(): Promise<void> {
  const userId = await currentUserId();
  const { error } = await client().from("community_profiles").upsert({
    user_id: userId,
    guidelines_version: COMMUNITY_GUIDELINES_VERSION,
    guidelines_accepted_at: new Date().toISOString(),
  });
  if (error) throw friendlyError(error.message, "Could not save your agreement.");
}

export async function fetchRooms(): Promise<CommunityRoom[]> {
  const userId = await currentUserId();
  const [rooms, joined] = await Promise.all([
    client()
      .from("communities")
      .select("id, slug, name, description, icon")
      .eq("status", "active")
      .order("sort_order", { ascending: true }),
    client().from("community_members").select("community_id").eq("user_id", userId).eq("status", "active"),
  ]);
  if (rooms.error) throw friendlyError(rooms.error.message, "Could not load communities.");
  const mine = new Set((joined.data ?? []).map((r: { community_id: string }) => r.community_id));
  return (rooms.data ?? []).map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    name: r.name as string,
    description: (r.description as string) ?? "",
    icon: (r.icon as string | null) ?? null,
    joined: mine.has(r.id as string),
  }));
}

export async function setRoomMembership(communityId: string, join: boolean): Promise<void> {
  const userId = await currentUserId();
  const table = client().from("community_members");
  const { error } = join
    ? await table.insert({ community_id: communityId, user_id: userId, role: "member", status: "active" })
    : await table.delete().eq("community_id", communityId).eq("user_id", userId);
  if (error && !/duplicate key/i.test(error.message)) throw friendlyError(error.message, "Could not update membership.");
}

export async function fetchMemberCount(): Promise<number | null> {
  const { data, error } = await client().rpc("community_member_count");
  if (error || typeof data !== "number") return null;
  return data;
}

const MARKET_IDS = ["bitcoin", "ethereum", "solana", "binancecoin", "ripple"];

export async function fetchLiveQuotes(signal?: AbortSignal): Promise<LiveQuote[]> {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${MARKET_IDS.join(",")}&sparkline=false`,
    { signal },
  );
  if (!response.ok) throw new Error("Live markets unavailable.");
  const rows = (await response.json()) as {
    id: string;
    symbol: string;
    name: string;
    current_price: number;
    price_change_percentage_24h: number | null;
  }[];
  return MARKET_IDS.map((id) => rows.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => ({
      symbol: r.symbol.toUpperCase(),
      name: r.name,
      price: r.current_price,
      changePct: r.price_change_percentage_24h,
    }));
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
