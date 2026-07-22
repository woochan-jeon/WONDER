import "server-only";
import { fetch as undiciFetch } from "undici";
import { prisma } from "@/lib/prisma";

// Read channel lists (public + private the bot's been added to) and post messages.
// `chat:write.public` lets the bot post to public channels it hasn't joined.
const SCOPES = ["channels:read", "groups:read", "chat:write", "chat:write.public"];

export function isSlackConfigured() {
  return Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET && process.env.SLACK_REDIRECT_URI);
}

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to your .env file.`);
  return value;
}

export function getSlackAuthUrl() {
  const params = new URLSearchParams({
    client_id: getEnv("SLACK_CLIENT_ID"),
    scope: SCOPES.join(","),
    redirect_uri: getEnv("SLACK_REDIRECT_URI"),
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function saveSlackConnectionFromCode(code: string) {
  const res = await undiciFetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getEnv("SLACK_CLIENT_ID"),
      client_secret: getEnv("SLACK_CLIENT_SECRET"),
      code,
      redirect_uri: getEnv("SLACK_REDIRECT_URI"),
    }),
  });

  const data = (await res.json()) as {
    ok: boolean;
    error?: string;
    access_token?: string;
    bot_user_id?: string;
    team?: { id: string; name: string };
  };

  if (!data.ok || !data.access_token || !data.bot_user_id || !data.team) {
    throw new Error(`Slack OAuth exchange failed: ${data.error ?? "unknown error"}`);
  }

  // Only one team Slack connection is kept at a time.
  await prisma.slackConnection.deleteMany({});
  await prisma.slackConnection.create({
    data: {
      teamName: data.team.name,
      teamId: data.team.id,
      botUserId: data.bot_user_id,
      accessToken: data.access_token,
    },
  });
}

export async function getSlackConnectionStatus() {
  const connection = await prisma.slackConnection.findFirst();
  return connection
    ? { connected: true as const, teamName: connection.teamName }
    : { connected: false as const };
}

export async function disconnectSlack() {
  await prisma.slackConnection.deleteMany({});
}

async function getSlackToken() {
  const connection = await prisma.slackConnection.findFirst();
  return connection?.accessToken ?? null;
}

export type SlackChannel = { id: string; name: string };

export async function listSlackChannels(): Promise<SlackChannel[]> {
  const token = await getSlackToken();
  if (!token) return [];

  const channels: SlackChannel[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({
      types: "public_channel,private_channel",
      exclude_archived: "true",
      limit: "200",
    });
    if (cursor) params.set("cursor", cursor);

    const res = await undiciFetch(`https://slack.com/api/conversations.list?${params.toString()}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      channels?: { id: string; name: string; is_member: boolean }[];
      response_metadata?: { next_cursor?: string };
    };
    if (!data.ok) throw new Error(`Slack conversations.list failed: ${data.error ?? "unknown error"}`);

    for (const c of data.channels ?? []) {
      channels.push({ id: c.id, name: c.name });
    }
    cursor = data.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return channels.sort((a, b) => a.name.localeCompare(b.name));
}

export async function sendSlackMessage(channelId: string, text: string) {
  const token = await getSlackToken();
  if (!token) throw new Error("연결된 슬랙 워크스페이스가 없습니다");

  const res = await undiciFetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ channel: channelId, text }),
  });
  const data = (await res.json()) as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(`Slack chat.postMessage failed: ${data.error ?? "unknown error"}`);
}
