import { prisma } from "@zenite-mkt/db";
import { decryptSecret } from "@/lib/crypto-secrets";
import type { AssistantConfig } from "./config";

// Google Agenda: uma conta Google conectada (refresh token) com acesso de edição às agendas dos dois sócios
// (`meeting.calendarIds`, normalmente os e-mails deles). O evento é criado na primeira agenda com os outros
// sócios e o lead como convidados, já com o link do Meet.
const TZ_OFFSET = "-03:00"; // Brasília, sem horário de verão desde 2019.
const API = "https://www.googleapis.com/calendar/v3";

export function assistantAgencyId(): string | undefined {
  return process.env.ASSISTANT_AGENCY_ID ?? process.env.SITE_LEADS_AGENCY_ID;
}

export function calendarRedirectUri() {
  return `${process.env.MAIN_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://portal.hubzenite.com.br"}/api/admin/assistant-calendar-oauth/callback`;
}

/** Mesmo cliente OAuth do Google usado no Search Console. */
export function googleClient() {
  const id = process.env.GOOGLE_CALENDAR_CLIENT_ID ?? process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Cliente OAuth do Google não configurado.");
  return { id, secret };
}

async function accessToken(): Promise<string> {
  const { id, secret } = googleClient();
  const agencyId = assistantAgencyId();
  const settings = agencyId ? await prisma.assistantSettings.findUnique({ where: { agencyId }, select: { googleRefreshTokenEnc: true } }) : null;
  const refresh = settings?.googleRefreshTokenEnc ? decryptSecret(settings.googleRefreshTokenEnc) : process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  if (!refresh) throw new Error("Google Agenda não conectado no painel.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(`Token do Google falhou: ${response.status}`);
  return data.access_token;
}

/** Data/hora de Brasília (YYYY-MM-DD + HH:MM) para Date. */
function brt(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${TZ_OFFSET}`);
}

function brtDateString(d: Date): string {
  return new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** Horários candidatos pelas regras do painel (sem olhar a agenda ainda). */
function candidateSlots(config: AssistantConfig, from: Date, days: number): { start: Date; period: "manha" | "tarde" }[] {
  const { meeting: m } = config;
  const step = m.durationMinutes * 60_000;
  const out: { start: Date; period: "manha" | "tarde" }[] = [];
  for (let i = 0; i < days; i++) {
    const day = brtDateString(new Date(from.getTime() + i * 86_400_000));
    const weekday = brt(day, "12:00").getUTCDay();
    if (!m.weekdays.includes(weekday)) continue;
    const windows: [typeof m.morning, "manha" | "tarde"][] = [[m.morning, "manha"]];
    if (!(weekday === 6 && m.saturdayMorningOnly)) windows.push([m.afternoon, "tarde"]);
    for (const [window, period] of windows) {
      const end = brt(day, window.end).getTime();
      for (let t = brt(day, window.start).getTime(); t + step <= end; t += step) {
        if (t > from.getTime() + 15 * 60_000) out.push({ start: new Date(t), period });
      }
    }
  }
  return out;
}

export async function findFreeSlots(config: AssistantConfig, now: Date, days = 7): Promise<{ start: Date; period: "manha" | "tarde" }[]> {
  const candidates = candidateSlots(config, now, days);
  if (!candidates.length) return [];
  const token = await accessToken();
  const response = await fetch(`${API}/freeBusy`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin: candidates[0]!.start.toISOString(),
      timeMax: new Date(candidates[candidates.length - 1]!.start.getTime() + config.meeting.durationMinutes * 60_000).toISOString(),
      items: config.meeting.calendarIds.map((id) => ({ id })),
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`freeBusy falhou: ${response.status}`);
  const busy: { start: number; end: number }[] = Object.values(data.calendars ?? {}).flatMap((c) =>
    ((c as { busy?: { start: string; end: string }[] }).busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) })),
  );
  const duration = config.meeting.durationMinutes * 60_000;
  return candidates.filter((slot) => {
    const start = slot.start.getTime();
    return !busy.some((b) => start < b.end && start + duration > b.start);
  });
}

export async function createMeeting(config: AssistantConfig, input: { start: Date; title: string; description: string; leadEmail: string | null }) {
  const organizer = config.meeting.targetCalendarId || config.meeting.calendarIds[0];
  if (!organizer) throw new Error("Nenhuma agenda configurada no painel.");
  const others = config.meeting.attendeeEmails;
  const token = await accessToken();
  const end = new Date(input.start.getTime() + config.meeting.durationMinutes * 60_000);
  const response = await fetch(`${API}/calendars/${encodeURIComponent(organizer)}/events?conferenceDataVersion=1&sendUpdates=all`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: input.title,
      description: input.description,
      start: { dateTime: input.start.toISOString(), timeZone: "America/Sao_Paulo" },
      end: { dateTime: end.toISOString(), timeZone: "America/Sao_Paulo" },
      attendees: [...others, ...(input.leadEmail ? [input.leadEmail] : [])].map((email) => ({ email })),
      conferenceData: { createRequest: { requestId: `milena-${input.start.getTime()}-${Math.random().toString(36).slice(2, 8)}`, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    }),
  });
  const event = await response.json();
  if (!response.ok) throw new Error(`Criar evento falhou: ${response.status}`);
  const meetUrl: string | null = event.hangoutLink ?? event.conferenceData?.entryPoints?.find((e: { entryPointType: string }) => e.entryPointType === "video")?.uri ?? null;
  return { eventId: event.id as string, calendarId: organizer, meetUrl, end };
}

export async function cancelMeeting(calendarId: string, eventId: string) {
  const token = await accessToken();
  await fetch(`${API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function formatSlot(d: Date): string {
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Agendas que a conta conectada enxerga (as próprias e as compartilhadas), para escolher no painel. */
export async function listCalendars(): Promise<{ id: string; name: string; canWrite: boolean }[]> {
  const token = await accessToken();
  const response = await fetch(`${API}/users/me/calendarList?maxResults=250`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(`calendarList falhou: ${response.status}`);
  return (data.items ?? []).map((c: { id: string; summary: string; summaryOverride?: string; accessRole: string }) => ({
    id: c.id,
    name: c.summaryOverride ?? c.summary,
    canWrite: c.accessRole === "owner" || c.accessRole === "writer",
  }));
}
