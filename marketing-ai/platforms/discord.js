const API = "https://discord.com/api/v10";

export function hasDiscordConfig() {
  return Boolean(process.env.DISCORD_BOT_TOKEN?.trim());
}

function botHeaders(token) {
  return {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  };
}

async function discordFetch(path, token, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...botHeaders(token), ...options.headers },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data.message || `Discord API ${res.status}: ${text.slice(0, 200)}`);
  }
  return data;
}

async function resolveChannelId(token) {
  const direct = process.env.DISCORD_CHANNEL_ID?.trim();
  if (direct) return direct;

  const channelName = (process.env.DISCORD_MARKETING_CHANNEL || "marketing").trim().toLowerCase();
  const guildId = process.env.DISCORD_GUILD_ID?.trim();

  const guilds = guildId ? [{ id: guildId }] : await discordFetch("/users/@me/guilds", token);

  for (const guild of guilds) {
    const channels = await discordFetch(`/guilds/${guild.id}/channels`, token);
    const match = channels.find(
      (ch) => ch.type === 0 && String(ch.name).toLowerCase() === channelName,
    );
    if (match) return match.id;
  }

  throw new Error(
    "Could not find Discord channel. Set DISCORD_CHANNEL_ID in .env or DISCORD_GUILD_ID + DISCORD_MARKETING_CHANNEL.",
  );
}

export async function postDiscord(message, { videoPath = null, quiet = false } = {}) {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) throw new Error("DISCORD_BOT_TOKEN not set");

  const channelId = await resolveChannelId(token);
  const content = String(message).slice(0, 1990);

  if (videoPath) {
    const { readFile } = await import("node:fs/promises");
    const { basename } = await import("node:path");
    const { fileExists } = await import("../videoPipeline.js");
    if (!(await fileExists(videoPath))) {
      throw new Error(`Discord video missing: ${videoPath}`);
    }
    const videoBytes = await readFile(videoPath);
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ content }));
    form.append("files[0]", new Blob([videoBytes], { type: "video/mp4" }), basename(videoPath));

    const res = await fetch(`${API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${token}` },
      body: form,
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      throw new Error(data.message || `Discord API ${res.status}: ${text.slice(0, 200)}`);
    }
    if (!quiet) console.log("✓ Posted video to Discord");
    return {
      messageId: data.id,
      channelId,
      withVideo: true,
      url: `https://discord.com/channels/@me/${channelId}/${data.id}`,
    };
  }

  const data = await discordFetch(`/channels/${channelId}/messages`, token, {
    method: "POST",
    body: JSON.stringify({ content }),
  });

  if (!quiet) console.log("✓ Posted to Discord");
  return { messageId: data.id, channelId, url: `https://discord.com/channels/@me/${channelId}/${data.id}` };
}

/** CLI helper: list channels for setup. */
export async function listDiscordChannels() {
  const token = process.env.DISCORD_BOT_TOKEN?.trim();
  if (!token) throw new Error("DISCORD_BOT_TOKEN not set");

  const guilds = await discordFetch("/users/@me/guilds", token);
  for (const guild of guilds) {
    console.log(`\n${guild.name} (${guild.id})`);
    const channels = await discordFetch(`/guilds/${guild.id}/channels`, token);
    for (const ch of channels.filter((c) => c.type === 0)) {
      console.log(`  #${ch.name} → ${ch.id}`);
    }
  }
}
