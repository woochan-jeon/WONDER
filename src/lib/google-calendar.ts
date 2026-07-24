import "server-only";
import { google } from "googleapis";
import { fetch as undiciFetch } from "undici";
import { prisma } from "@/lib/prisma";

// Full calendar access (not just readonly) so the team can pick which of the
// connected account's calendars to use, and create events from this app.
// Also includes read-only Drive access so the team can browse the connected
// account's Drive from the # 드라이브 channel, and full Sheets access so the
// # 회계장부 channel can read and append rows to the team's ledger spreadsheets.
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/userinfo.email",
];

const TIME_ZONE = "Asia/Seoul";

export function isGoogleOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI,
  );
}

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Add it to your .env file.`);
  return value;
}

export function getOAuth2Client() {
  return new google.auth.OAuth2({
    clientId: getEnv("GOOGLE_CLIENT_ID"),
    clientSecret: getEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: getEnv("GOOGLE_REDIRECT_URI"),
    // Next.js's dev server patches the global `fetch` in a way that trips up
    // gaxios (googleapis' HTTP client) with "ArrayBuffer is not detachable and
    // could not be cloned" errors. Use an independent fetch implementation to
    // avoid going through Next's patched global fetch.
    transporterOptions: { fetchImplementation: undiciFetch as unknown as typeof fetch },
  });
}

export function getGoogleAuthUrl() {
  const client = getOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function saveConnectionFromCode(code: string) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error(
      "Google did not return a refresh token. Remove app access at https://myaccount.google.com/permissions and try connecting again.",
    );
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ auth: client, version: "v2" });
  const { data: profile } = await oauth2.userinfo.get();

  // Only one team calendar connection is kept at a time.
  await prisma.calendarConnection.deleteMany({});
  await prisma.calendarConnection.create({
    data: {
      googleEmail: profile.email ?? "unknown",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: new Date(tokens.expiry_date),
    },
  });
}

// Exported so google-drive.ts can reuse the same connection/token refresh
// logic — Calendar and Drive share one Google account connection.
export async function getAuthorizedClient() {
  const connection = await prisma.calendarConnection.findFirst();
  if (!connection) return null;

  const client = getOAuth2Client();
  client.setCredentials({
    access_token: connection.accessToken,
    refresh_token: connection.refreshToken,
    expiry_date: connection.expiryDate.getTime(),
  });

  if (connection.expiryDate.getTime() < Date.now() + 60_000) {
    const { credentials } = await client.refreshAccessToken();
    client.setCredentials(credentials);
    if (credentials.access_token && credentials.expiry_date) {
      await prisma.calendarConnection.update({
        where: { id: connection.id },
        data: {
          accessToken: credentials.access_token,
          expiryDate: new Date(credentials.expiry_date),
        },
      });
    }
  }

  return {
    client,
    calendarIds: parseCalendarIds(connection.calendarIds),
    googleEmail: connection.googleEmail,
  };
}

function parseCalendarIds(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) && parsed.every((v) => typeof v === "string") && parsed.length > 0
      ? parsed
      : ["primary"];
  } catch {
    return ["primary"];
  }
}

export type CalendarEvent = {
  id: string;
  title: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  htmlLink: string | null;
  colorId: string | null;
  calendarId: string;
};

export async function getConnectionStatus() {
  const connection = await prisma.calendarConnection.findFirst();
  return connection
    ? {
        connected: true as const,
        googleEmail: connection.googleEmail,
        calendarIds: parseCalendarIds(connection.calendarIds),
      }
    : { connected: false as const };
}

export type CalendarListItem = { id: string; name: string; primary: boolean };

export async function listCalendars(): Promise<CalendarListItem[]> {
  const authorized = await getAuthorizedClient();
  if (!authorized) return [];

  const calendar = google.calendar({ version: "v3", auth: authorized.client });
  // A connection made before the "full calendar" scope was requested only has
  // read-only access, so this call fails with 403 until the admin reconnects.
  const data = await calendar.calendarList
    .list({ maxResults: 250 })
    .then((res) => res.data)
    .catch(() => ({ items: [] }));

  return (data.items ?? [])
    .filter((item) => item.id)
    .map((item) => ({
      id: item.id!,
      name: item.summaryOverride ?? item.summary ?? item.id!,
      primary: Boolean(item.primary),
    }));
}

/** Hex background color of each selected calendar, keyed by calendar ID — used as the default for events with no per-event color override. */
export async function getCalendarColors(): Promise<Record<string, string>> {
  const authorized = await getAuthorizedClient();
  if (!authorized) return {};

  const calendar = google.calendar({ version: "v3", auth: authorized.client });
  const data = await calendar.calendarList
    .list({ maxResults: 250 })
    .then((res) => res.data)
    .catch(() => ({ items: [] }));

  const colors: Record<string, string> = {};
  for (const item of data.items ?? []) {
    if (item.id && item.backgroundColor && authorized.calendarIds.includes(item.id)) {
      colors[item.id] = item.backgroundColor;
    }
  }
  return colors;
}

export async function setCalendarIds(calendarIds: string[]) {
  const connection = await prisma.calendarConnection.findFirst();
  if (!connection) throw new Error("연결된 캘린더가 없습니다");
  if (calendarIds.length === 0) throw new Error("캘린더를 하나 이상 선택해 주세요");
  await prisma.calendarConnection.update({
    where: { id: connection.id },
    data: { calendarIds: JSON.stringify(calendarIds) },
  });
}

export async function createEvent(input: {
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD
  allDay: boolean;
  startTime?: string; // HH:MM, required unless allDay
  endTime?: string; // HH:MM, required unless allDay
}) {
  const authorized = await getAuthorizedClient();
  if (!authorized) throw new Error("연결된 캘린더가 없습니다");

  const calendar = google.calendar({ version: "v3", auth: authorized.client });

  const requestBody = input.allDay
    ? {
        summary: input.title,
        description: input.description,
        start: { date: input.date },
        end: { date: nextDay(input.date) },
      }
    : {
        summary: input.title,
        description: input.description,
        start: { dateTime: `${input.date}T${input.startTime}:00`, timeZone: TIME_ZONE },
        end: { dateTime: `${input.date}T${input.endTime}:00`, timeZone: TIME_ZONE },
      };

  await calendar.events.insert({
    calendarId: authorized.calendarIds[0],
    requestBody,
  });
}

function nextDay(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function listEventsInRange(timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
  const authorized = await getAuthorizedClient();
  if (!authorized) return [];

  const calendar = google.calendar({ version: "v3", auth: authorized.client });

  const perCalendar = await Promise.all(
    authorized.calendarIds.map((calendarId) =>
      calendar.events
        .list({
          calendarId,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: "startTime",
          maxResults: 250,
        })
        .then((res) =>
          (res.data.items ?? []).map(
            (event): CalendarEvent => ({
              id: event.id ?? crypto.randomUUID(),
              title: event.summary ?? "(제목 없음)",
              start: event.start?.dateTime ?? event.start?.date ?? null,
              end: event.end?.dateTime ?? event.end?.date ?? null,
              allDay: !event.start?.dateTime,
              htmlLink: event.htmlLink ?? null,
              colorId: event.colorId ?? null,
              calendarId,
            }),
          ),
        )
        // A calendar the account no longer has access to shouldn't break the rest.
        .catch(() => [] as CalendarEvent[]),
    ),
  );

  return perCalendar.flat();
}
