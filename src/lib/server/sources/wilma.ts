import { env } from '$env/dynamic/private';
import type { FamilyEvent, SourceResult } from '$lib/types/event';

/**
 * Wilma integration for helsinki.inschool.fi (reverse-engineered from the web UI).
 *
 * Auth flow:
 *   1. GET  /login            → pre-session cookie + SESSIONID form token
 *   2. POST /login            → Wilma2SID cookie (cached ~50 min in-process)
 *
 * Data flow per child role (/!<slug>/):
 *   - Schedule: GET /!<slug>/overview           → JSON `{ Schedule: [...] }`
 *                                                  with recurring slots + DateArray of occurrences
 *   - Exams:    GET /!<slug>/exams/calendar     → HTML (scraped: each exam is a <table class="table-grey">)
 *
 * Homework & inbox messages don't have JSON endpoints exposed to guardians on
 * this installation — they're either inside gradebook/attendance (not yet wired
 * up) or feature-disabled. Keeping the scaffolding ready to extend.
 */

const SESSION_TTL_MS = 50 * 60 * 1000;
const FINNISH_MONTHS: Record<string, string> = {
	tammi: '01', helmi: '02', maalis: '03', huhti: '04', touko: '05', kesä: '06',
	heinä: '07', elo: '08', syys: '09', loka: '10', marras: '11', joulu: '12'
};

interface Role {
	slug: string;
	name: string;
	isGuardianSelf: boolean; // parent's "huoltaja" role — skip scheduling, used for context
}

interface Session {
	cookie: string;
	baseUrl: string;
	at: number;
	roles: Role[];
}

let session: Session | null = null;

function config() {
	return {
		baseUrl: env.WILMA_BASE_URL?.replace(/\/$/, ''),
		username: env.WILMA_USERNAME,
		password: env.WILMA_PASSWORD
	};
}

async function login(baseUrl: string, username: string, password: string): Promise<string> {
	// Pre-login GET establishes a session identifier Wilma requires.
	const pre = await fetch(`${baseUrl}/login`, { redirect: 'manual' });
	const preHeaders = pre.headers as Headers & { getSetCookie?: () => string[] };
	const preCookies = (preHeaders.getSetCookie?.() ?? [])
		.map((c) => c.split(';')[0])
		.filter(Boolean);
	const html = await pre.text();
	const sessionId = html.match(/name="SESSIONID"\s+value="([^"]+)"/i)?.[1] ?? '';

	const body = new URLSearchParams({
		Login: username,
		Password: password,
		SESSIONID: sessionId,
		CompleteJson: '',
		format: 'json'
	});
	const res = await fetch(`${baseUrl}/login`, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			cookie: preCookies.join('; '),
			referer: `${baseUrl}/login`
		},
		body,
		redirect: 'manual'
	});
	const resHeaders = res.headers as Headers & { getSetCookie?: () => string[] };
	const sid = (resHeaders.getSetCookie?.() ?? [])
		.map((c) => c.split(';')[0])
		.find((c) => c.startsWith('Wilma2SID='));
	if (!sid) throw new Error(`Wilma login failed (status ${res.status})`);
	return sid;
}

async function wilmaFetch(baseUrl: string, path: string, cookie: string): Promise<Response> {
	return fetch(`${baseUrl}${path}`, {
		headers: {
			cookie,
			accept: 'application/json, text/html;q=0.9',
			'user-agent': 'arki-dashboard/1.0'
		}
	});
}

async function discoverRoles(baseUrl: string, cookie: string): Promise<Role[]> {
	const res = await wilmaFetch(baseUrl, '/', cookie);
	const html = await res.text();
	const seen = new Map<string, Role>();
	const re = /href="\/!([^/"?#]+)\/?"[^>]*>\s*([^<]+?)\s*</g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html))) {
		const slug = m[1];
		if (seen.has(slug)) continue;
		const rawName = m[2].trim();
		const isGuardianSelf = /\(huoltaja\)/i.test(rawName);
		const name = rawName.replace(/\s*\(huoltaja\)\s*/i, '').trim();
		seen.set(slug, { slug, name, isGuardianSelf });
	}
	return [...seen.values()];
}

async function ensureSession(): Promise<Session> {
	const { baseUrl, username, password } = config();
	if (!baseUrl || !username || !password) {
		throw new Error('Wilma not configured');
	}
	if (session && session.baseUrl === baseUrl && Date.now() - session.at < SESSION_TTL_MS) {
		return session;
	}
	const cookie = await login(baseUrl, username, password);
	const allRoles = await discoverRoles(baseUrl, cookie);
	// Drop inactive roles (past school years, empty parent shells). A role is
	// "active" only if its /overview returns at least one schedule slot.
	const activeChecks = await Promise.all(
		allRoles.map(async (r) => ({ role: r, active: await roleHasSchedule(baseUrl, cookie, r) }))
	);
	const roles = activeChecks.filter((x) => x.active).map((x) => x.role);
	session = { cookie, baseUrl, at: Date.now(), roles };
	return session;
}

async function roleHasSchedule(baseUrl: string, cookie: string, role: Role): Promise<boolean> {
	try {
		const res = await wilmaFetch(baseUrl, `/!${role.slug}/overview`, cookie);
		if (!res.ok) return false;
		const data = (await res.json()) as { Schedule?: unknown[] };
		return Array.isArray(data.Schedule) && data.Schedule.length > 0;
	} catch {
		return false;
	}
}

// ── Schedule (overview JSON) ───────────────────────────────────────────────

interface OverviewGroup {
	Caption?: string;
	FullCaption?: string;
	ShortCaption?: string;
	Rooms?: Array<{ LongCaption?: string; Caption?: string }>;
	Teachers?: Array<{ LongCaption?: string; Caption?: string }>;
}

interface OverviewSlot {
	ReservationID: number;
	ScheduleID: number;
	Start: string; // "HH:MM"
	End: string;
	Class?: string;
	DateArray?: string[]; // ["2026-04-20", ...]
	Groups?: OverviewGroup[];
}

export function expandSchedule(
	slots: OverviewSlot[],
	role: { slug: string; name: string },
	fromDate: string,
	toDate: string
): FamilyEvent[] {
	const out: FamilyEvent[] = [];
	for (const s of slots ?? []) {
		const group = s.Groups?.[0];
		const title = group?.FullCaption ?? group?.Caption ?? group?.ShortCaption ?? 'Oppitunti';
		const room = group?.Rooms?.[0]?.LongCaption ?? group?.Rooms?.[0]?.Caption;
		for (const date of s.DateArray ?? []) {
			if (date < fromDate || date > toDate) continue;
			out.push({
				id: `wilma:lesson:${role.slug}:${s.ReservationID}:${date}`,
				source: 'wilma',
				title,
				start: `${date}T${s.Start}:00`,
				end: `${date}T${s.End}:00`,
				allDay: false,
				location: room,
				person: role.name,
				raw: { slot: s, group }
			});
		}
	}
	return out;
}

async function fetchScheduleForRole(
	baseUrl: string,
	cookie: string,
	role: Role,
	fromDate: string,
	toDate: string
): Promise<FamilyEvent[]> {
	const res = await wilmaFetch(baseUrl, `/!${role.slug}/overview`, cookie);
	if (!res.ok) return [];
	try {
		const data = (await res.json()) as { Schedule?: OverviewSlot[] };
		return expandSchedule(data.Schedule ?? [], role, fromDate, toDate);
	} catch {
		return [];
	}
}

// ── Exams (HTML scrape) ────────────────────────────────────────────────────

/**
 * Parses a date like "Pe 8.5.2026" → "2026-05-08".
 * Also handles numeric-month Finnish forms and localized month names.
 */
export function parseFinnishDate(input: string): string | null {
	const s = input.trim();
	// "Pe 8.5.2026" or "8.5.2026"
	const m1 = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
	if (m1) {
		const [, d, mo, y] = m1;
		return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
	}
	// "8. toukokuuta 2026"
	const m2 = s.match(/(\d{1,2})\.\s+([a-zäö]+)\w*\s+(\d{4})/i);
	if (m2) {
		const [, d, mo, y] = m2;
		const stem = mo.toLowerCase().replace(/kuuta$/, '').replace(/kuu$/, '');
		const mm = FINNISH_MONTHS[stem];
		if (mm) return `${y}-${mm}-${d.padStart(2, '0')}`;
	}
	return null;
}

export interface ParsedExam {
	date: string;
	title: string;
	subject?: string;
	details?: string;
}

/** Parses /!<slug>/exams/calendar HTML into a list of exams. */
export function parseExamsHtml(html: string): ParsedExam[] {
	const exams: ParsedExam[] = [];
	// Each exam is a <table class="table table-grey">...</table>
	const tableRe = /<table[^>]*class="[^"]*table-grey[^"]*"[^>]*>([\s\S]*?)<\/table>/g;
	let t: RegExpExecArray | null;
	while ((t = tableRe.exec(html))) {
		const tbl = t[1];
		const strong = tbl.match(/<strong>([^<]+)<\/strong>/);
		if (!strong) continue;
		const date = parseFinnishDate(strong[1]);
		if (!date) continue;

		// The "header" row has two <td>s: the date cell and the description cell.
		const rowMatch = tbl.match(/<tr>[\s\S]*?<td[^>]*>[\s\S]*?<strong>[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/);
		const descCell = rowMatch?.[1] ?? '';
		const text = descCell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
		// Format: "<desc> : <groupCode> : <subject>"
		const parts = text.split(/\s*:\s*/).filter(Boolean);
		const subject = parts.length >= 2 ? parts[parts.length - 1] : undefined;
		const title = parts[0] ?? text;

		const detailsMatch = tbl.match(/Kokeen lisätiedot[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/);
		const details = detailsMatch
			? detailsMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
			: undefined;

		exams.push({ date, title, subject, details });
	}
	return exams;
}

async function fetchExamsForRole(
	baseUrl: string,
	cookie: string,
	role: Role,
	fromDate: string,
	toDate: string
): Promise<FamilyEvent[]> {
	const res = await wilmaFetch(baseUrl, `/!${role.slug}/exams/calendar`, cookie);
	if (!res.ok) return [];
	const html = await res.text();
	const exams = parseExamsHtml(html);
	return exams
		.filter((e) => e.date >= fromDate && e.date <= toDate)
		.map((e) => ({
			id: `wilma:exam:${role.slug}:${e.date}:${e.title}`.slice(0, 200),
			source: 'wilma' as const,
			title: e.subject ? `Koe: ${e.subject} — ${e.title}` : `Koe: ${e.title}`,
			start: e.date,
			end: e.date,
			allDay: true,
			person: role.name,
			raw: e
		}));
}

// ── Aggregator ─────────────────────────────────────────────────────────────

export async function fetchWilmaEvents(from: Date, to: Date): Promise<SourceResult> {
	const { baseUrl, username, password } = config();
	if (!baseUrl || !username || !password) {
		return { source: 'wilma', events: [] };
	}
	try {
		const s = await ensureSession();
		const fromDate = from.toISOString().slice(0, 10);
		const toDate = to.toISOString().slice(0, 10);

		// Every role may be a student (parent sees "(huoltaja)" suffix for children
		// they guard — empty roles naturally produce zero events).
		const batches = await Promise.all(
			s.roles.map(async (r) => {
				const [sched, exams] = await Promise.all([
					fetchScheduleForRole(s.baseUrl, s.cookie, r, fromDate, toDate),
					fetchExamsForRole(s.baseUrl, s.cookie, r, fromDate, toDate)
				]);
				return [...sched, ...exams];
			})
		);

		return { source: 'wilma', events: batches.flat() };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (/401|403|session|login/i.test(msg)) session = null;
		return { source: 'wilma', events: [], error: msg };
	}
}
