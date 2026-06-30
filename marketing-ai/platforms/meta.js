import { readFile, writeFile, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { fileExists } from "../videoPipeline.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const GRAPH_VIDEO = "https://graph-video.facebook.com/v21.0";

export function hasMetaConfig() {
  return Boolean(
    process.env.META_PAGE_ACCESS_TOKEN?.trim() && process.env.META_PAGE_ID?.trim(),
  );
}

export function hasInstagramConfig() {
  return Boolean(hasMetaConfig() && process.env.META_IG_USER_ID?.trim());
}

function pageToken() {
  return process.env.META_PAGE_ACCESS_TOKEN?.trim() || "";
}

function pageId() {
  return process.env.META_PAGE_ID?.trim() || "";
}

function igUserId() {
  return process.env.META_IG_USER_ID?.trim() || "";
}

async function graphGet(path, token = pageToken()) {
  const url = `${GRAPH}${path}${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Meta API ${res.status}`);
  }
  return data;
}

async function graphPost(path, params, token = pageToken()) {
  const body = new URLSearchParams({ access_token: token, ...params });
  const res = await fetch(`${GRAPH}${path}`, { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Meta API ${res.status}`);
  }
  return data;
}

export async function exportMetaBundle({ dayDir, videoPath, caption, slot = 0, quiet = false }) {
  if (!(await fileExists(videoPath))) {
    throw new Error(`Video missing: ${videoPath}`);
  }

  const suffix = slot === 0 ? "" : `-slot${slot + 1}`;
  const fbVideo = join(dayDir, `synexus-facebook${suffix}.mp4`);
  const igVideo = join(dayDir, `synexus-instagram-reel${suffix}.mp4`);
  const fbCaption = join(dayDir, `facebook-caption${suffix}.txt`);
  const igCaption = join(dayDir, `instagram-caption${suffix}.txt`);

  await copyFile(videoPath, fbVideo);
  await copyFile(videoPath, igVideo);
  await writeFile(fbCaption, `${caption}\n`, "utf8");
  await writeFile(igCaption, `${caption}\n`, "utf8");

  if (!quiet) {
    console.log(`✓ Meta export ready (slot ${slot + 1})`);
    console.log(`  Facebook:  ${fbVideo}`);
    console.log(`  Instagram: ${igVideo}`);
  }

  return { fbVideo, igVideo, fbCaption, igCaption, slot, mode: "export" };
}

export async function postFacebookVideo({ videoPath, caption, quiet = false }) {
  if (!hasMetaConfig()) {
    throw new Error("Set META_PAGE_ID + META_PAGE_ACCESS_TOKEN — run npm run meta:auth");
  }

  const buf = await readFile(videoPath);
  const form = new FormData();
  form.append("access_token", pageToken());
  form.append("description", caption.slice(0, 63206));
  form.append("title", "Synexus — Should I buy this?");
  form.append("source", new Blob([buf], { type: "video/mp4" }), "synexus-daily.mp4");

  const res = await fetch(`${GRAPH_VIDEO}/${pageId()}/videos`, {
    method: "POST",
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Facebook upload failed (${res.status})`);
  }

  const videoId = data.id;
  const url = videoId ? `https://www.facebook.com/watch/?v=${videoId}` : null;
  if (!quiet) console.log(`✓ Posted to Facebook Page${url ? `: ${url}` : ""}`);
  return { videoId, url, platform: "facebook", mode: "api" };
}

export async function postInstagramReel({ videoPath, caption, quiet = false }) {
  if (!hasInstagramConfig()) {
    throw new Error("Set META_IG_USER_ID — link IG Business to Page, then npm run meta:auth");
  }

  const token = pageToken();
  const ig = igUserId();
  const buf = await readFile(videoPath);
  const fileSize = buf.byteLength;

  const container = await graphPost(`/${ig}/media`, {
    media_type: "REELS",
    upload_type: "resumable",
    caption: caption.slice(0, 2200),
  });

  const containerId = container.id;
  if (!containerId) throw new Error("Instagram container creation failed");

  const uploadRes = await fetch(`https://rupload.facebook.com/ig-api-upload/v21.0/${containerId}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token}`,
      offset: "0",
      file_size: String(fileSize),
      "Content-Type": "application/octet-stream",
    },
    body: buf,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => "");
    throw new Error(`Instagram video upload failed: ${errText.slice(0, 200)}`);
  }

  for (let i = 0; i < 30; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    const status = await graphGet(`/${containerId}?fields=status_code`);
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR") throw new Error("Instagram processing error");
  }

  const published = await graphPost(`/${ig}/media_publish`, { creation_id: containerId });
  if (!quiet) console.log(`✓ Posted Instagram Reel (id ${published.id})`);
  return { mediaId: published.id, platform: "instagram", mode: "api" };
}

export async function publishFacebook({ dayDir, videoPath, caption, slot = 0, quiet = false }) {
  const bundle = await exportMetaBundle({ dayDir, videoPath, caption, slot, quiet: true });
  if (hasMetaConfig()) {
    try {
      const result = await postFacebookVideo({ videoPath: bundle.fbVideo, caption, quiet: true });
      if (!quiet) console.log(`✓ Facebook · slot ${slot + 1}`);
      return { ...bundle, ...result, postedAt: new Date().toISOString() };
    } catch (err) {
      if (!quiet) console.warn(`  Facebook API failed — export saved (${err.message})`);
    }
  } else if (!quiet) {
    console.log(`  ↷ Facebook export · slot ${slot + 1} — run npm run meta:auth`);
  }
  return { ...bundle, mode: "export" };
}

export async function publishInstagram({ dayDir, videoPath, caption, slot = 0, quiet = false }) {
  const bundle = await exportMetaBundle({ dayDir, videoPath, caption, slot, quiet: true });
  if (hasInstagramConfig()) {
    try {
      const result = await postInstagramReel({ videoPath: bundle.igVideo, caption, quiet: true });
      if (!quiet) console.log(`✓ Instagram · slot ${slot + 1}`);
      return { ...bundle, ...result, postedAt: new Date().toISOString() };
    } catch (err) {
      if (!quiet) console.warn(`  Instagram API failed — export saved (${err.message})`);
    }
  } else if (!quiet) {
    console.log(`  ↷ Instagram export · slot ${slot + 1} — run npm run meta:auth`);
  }
  return { ...bundle, mode: "export" };
}

async function graphDelete(path, token = pageToken()) {
  const url = `${GRAPH}${path}?access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { method: "DELETE" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Meta DELETE ${res.status}`);
  }
  return data;
}

export async function deleteFacebookVideo(videoId) {
  if (!hasMetaConfig()) throw new Error("Meta not configured");
  return graphDelete(`/${videoId}`);
}

export async function deleteInstagramMedia(mediaId) {
  if (!hasInstagramConfig()) throw new Error("Instagram not configured");
  return graphDelete(`/${mediaId}`);
}

/** List recent FB videos + IG reels since timestamp (ISO). */
export async function listRecentMetaPosts({ sinceIso } = {}) {
  const since = sinceIso ? Math.floor(new Date(sinceIso).getTime() / 1000) : 0;
  const out = { facebook: [], instagram: [] };

  if (hasMetaConfig()) {
    const fb = await graphGet(
      `/${pageId()}/videos?fields=id,created_time,description&limit=25`,
    );
    for (const v of fb.data || []) {
      const t = Math.floor(new Date(v.created_time).getTime() / 1000);
      if (!since || t >= since - 120) {
        out.facebook.push({ id: v.id, created_time: v.created_time, description: v.description });
      }
    }
  }

  if (hasInstagramConfig()) {
    const ig = await graphGet(
      `/${igUserId()}/media?fields=id,timestamp,caption,media_type&limit=25`,
    );
    for (const m of ig.data || []) {
      const t = Math.floor(new Date(m.timestamp).getTime() / 1000);
      if (!since || t >= since - 120) {
        out.instagram.push({
          id: m.id,
          timestamp: m.timestamp,
          caption: m.caption,
          media_type: m.media_type,
        });
      }
    }
  }

  return out;
}

export async function checkMetaApi() {
  if (!hasMetaConfig()) {
    return {
      ok: false,
      configured: false,
      fix: "Create Meta app → npm run meta:auth (Facebook Page + Instagram Business)",
    };
  }

  try {
    const page = await graphGet(`/${pageId()}?fields=name,id`);
    let igNote = "not linked — connect IG Business to Page";
    if (hasInstagramConfig()) {
      const ig = await graphGet(`/${igUserId()}?fields=username,name`);
      igNote = `@${ig.username || ig.name || igUserId()}`;
    }
    return {
      ok: true,
      configured: true,
      page: page.name || page.id,
      instagram: igNote,
      note: "Facebook + Instagram Reels ready",
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      error: err.message,
      fix: "Regenerate token — npm run meta:auth",
    };
  }
}
