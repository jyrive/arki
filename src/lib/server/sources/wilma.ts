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

export interface Role {
	slug: string;
	name: string;
	isGuardianSelf: boolean; // parent's "huoltaja" role — skip scheduling, used for context
}

export interface Session {
	cookie: string;
	baseUrl: string;
	at: number;
	roles: Role[];
}

let session: Session | null = null;
let sessionPromise: Promise<Session> | null = null;

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
	// Serialize: if a login is already in flight, wait for it instead of
	// starting a second parallel login (which Wilma invalidates).
	if (sessionPromise) return sessionPromise;
	sessionPromise = (async () => {
		const cookie = await login(baseUrl, username, password);
		const allRoles = await discoverRoles(baseUrl, cookie);
		const activeChecks = await Promise.all(
			allRoles.map(async (r) => ({ role: r, active: await roleHasSchedule(baseUrl, cookie, r) }))
		);
		const roles = activeChecks.filter((x) => x.active).map((x) => x.role);
		session = { cookie, baseUrl, at: Date.now(), roles };
		return session;
	})();
	try {
		return await sessionPromise;
	} finally {
		sessionPromise = null;
	}
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
	Id?: number;
	Caption?: string;
	FullCaption?: string;
	ShortCaption?: string;
	Rooms?: Array<{ LongCaption?: string; Caption?: string }>;
	Teachers?: Array<{ LongCaption?: string; Caption?: string }>;
}

export interface OverviewSlot {
	ReservationID: number;
	ScheduleID: number;
	Start: string; // "HH:MM"
	End: string;
	Class?: string;
	DateArray?: string[]; // ["2026-04-20", ...]
	Groups?: OverviewGroup[];
}

export interface GroupRef {
	id: number;
	caption: string;
}

export function extractGroups(slots: OverviewSlot[]): GroupRef[] {
	const seen = new Map<number, GroupRef>();
	for (const s of slots ?? []) {
		for (const g of s.Groups ?? []) {
			if (typeof g.Id === 'number' && !seen.has(g.Id)) {
				seen.set(g.Id, {
					id: g.Id,
					caption: g.FullCaption ?? g.Caption ?? g.ShortCaption ?? `Ryhmä ${g.Id}`
				});
			}
		}
	}
	return [...seen.values()];
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

async function fetchOverview(
	baseUrl: string,
	cookie: string,
	role: Role
): Promise<{ slots: OverviewSlot[]; groups: GroupRef[] }> {
	const res = await wilmaFetch(baseUrl, `/!${role.slug}/overview`, cookie);
	if (!res.ok) return { slots: [], groups: [] };
	try {
		const data = (await res.json()) as { Schedule?: OverviewSlot[] };
		const slots = data.Schedule ?? [];
		return { slots, groups: extractGroups(slots) };
	} catch {
		return { slots: [], groups: [] };
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

// ── Homework (HTML scrape of /!<slug>/groups/<id>) ────────────────────────

export interface ParsedHomework {
	date: string;
	text: string;
}

/**
 * Parses a group page and returns the rows under <h3>Kotitehtävät</h3>.
 * Each row is a `<tr>` with two `<td>`s: date (dd.mm.yyyy) and description.
 */
export function parseHomeworkHtml(html: string): ParsedHomework[] {
	const sectionStart = html.search(/<h3[^>]*>\s*Kotitehtävät\s*<\/h3>/i);
	if (sectionStart < 0) return [];
	// Find the next </table> after the heading. That's the homework table.
	const after = html.slice(sectionStart);
	const tableMatch = after.match(/<table[^>]*>([\s\S]*?)<\/table>/);
	if (!tableMatch) return [];
	const tbody = tableMatch[1];

	const rows: ParsedHomework[] = [];
	const rowRe = /<tr>\s*<td[^>]*>([^<]+)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g;
	let m: RegExpExecArray | null;
	while ((m = rowRe.exec(tbody))) {
		const date = parseFinnishDate(m[1]);
		if (!date) continue;
		const text = m[2].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
		if (!text) continue;
		rows.push({ date, text });
	}
	return rows;
}

async function fetchHomeworkForGroup(
	baseUrl: string,
	cookie: string,
	role: Role,
	group: GroupRef,
	fromDate: string,
	toDate: string
): Promise<FamilyEvent[]> {
	try {
		const res = await wilmaFetch(baseUrl, `/!${role.slug}/groups/${group.id}`, cookie);
		if (!res.ok) return [];
		const html = await res.text();
		const rows = parseHomeworkHtml(html);
		return rows
			.filter((r) => r.date >= fromDate && r.date <= toDate)
			.map((r) => ({
				id: `wilma:hw:${role.slug}:${group.id}:${r.date}:${r.text}`.slice(0, 220),
				source: 'wilma' as const,
				title: `Läksy · ${group.caption} · ${r.text}`.slice(0, 200),
				start: r.date,
				end: r.date,
				allDay: true,
				person: role.name,
				raw: { group, homework: r }
			}));
	} catch (err) {
		console.warn(`[wilma] homework fetch failed for ${role.slug}/${group.id}:`, err);
		return [];
	}
}

/** Run tasks with a small concurrency cap so Wilma doesn't see a burst. */
async function mapLimit<T, U>(items: T[], limit: number, fn: (x: T) => Promise<U>): Promise<U[]> {
	const out: U[] = new Array(items.length);
	let i = 0;
	async function worker() {
		while (i < items.length) {
			const idx = i++;
			out[idx] = await fn(items[idx]);
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return out;
}

async function fetchHomeworkForRole(
	baseUrl: string,
	cookie: string,
	role: Role,
	groups: GroupRef[],
	fromDate: string,
	toDate: string
): Promise<FamilyEvent[]> {
	const batches = await mapLimit(groups, 4, (g) =>
		fetchHomeworkForGroup(baseUrl, cookie, role, g, fromDate, toDate)
	);
	return batches.flat();
}

// ── Aggregator ─────────────────────────────────────────────────────────────

/**
 * Expose the internal session handle so the cron can call per-kind fetchers
 * without re-logging-in between them. Returns null when Wilma isn't configured.
 */
export async function wilmaSession(): Promise<Session | null> {
	const { baseUrl, username, password } = config();
	if (!baseUrl || !username || !password) {
		const missing = [
			!baseUrl && 'WILMA_BASE_URL',
			!username && 'WILMA_USERNAME',
			!password && 'WILMA_PASSWORD'
		]
			.filter(Boolean)
			.join(', ');
		console.warn('[wilma] not configured; missing env:', missing);
		return null;
	}
	try {
		return await ensureSession();
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.warn('[wilma] session failed:', msg, err instanceof Error ? err.stack : '');
		lastSessionError = msg;
		return null;
	}
}

let lastSessionError: string | null = null;
export function lastWilmaSessionError(): string | null {
	return lastSessionError;
}

/**
 * Invalidate the cached session — call from cron after a 401/403 so the next
 * run re-logs-in. The aggregator already does this on errors, but cron handles
 * per-kind errors separately.
 */
export function invalidateWilmaSession() {
	session = null;
}

/** Fetch lessons for a single role within [fromDate, toDate] (inclusive date-only). */
export async function fetchWilmaLessons(
	s: Session,
	role: Role,
	fromDate: string,
	toDate: string
): Promise<FamilyEvent[]> {
	const { slots } = await fetchOverview(s.baseUrl, s.cookie, role);
	return expandSchedule(slots, role, fromDate, toDate);
}

/** Fetch exams for a single role. */
export async function fetchWilmaExams(
	s: Session,
	role: Role,
	fromDate: string,
	toDate: string
): Promise<FamilyEvent[]> {
	return fetchExamsForRole(s.baseUrl, s.cookie, role, fromDate, toDate);
}

/**
 * Fetch homework for a single role. Needs the role's group list (obtainable
 * from `fetchWilmaOverviewGroups`).
 */
export async function fetchWilmaHomework(
	s: Session,
	role: Role,
	groups: GroupRef[],
	fromDate: string,
	toDate: string
): Promise<FamilyEvent[]> {
	return fetchHomeworkForRole(s.baseUrl, s.cookie, role, groups, fromDate, toDate);
}

/** Fetch a role's overview once; cron reuses it for lessons + groups. */
export async function fetchWilmaOverviewGroups(
	s: Session,
	role: Role
): Promise<{ slots: OverviewSlot[]; groups: GroupRef[] }> {
	return fetchOverview(s.baseUrl, s.cookie, role);
}

/** Roles discovered for the configured account. */
export function wilmaRoles(s: Session): Role[] {
	return s.roles;
}

export async function fetchWilmaEvents(from: Date, to: Date): Promise<SourceResult> {
	const { baseUrl, username, password } = config();
	if (!baseUrl || !username || !password) {
		return { source: 'wilma', events: [] };
	}
	try {
		const s = await ensureSession();
		const fromDate = from.toISOString().slice(0, 10);
		const toDate = to.toISOString().slice(0, 10);

		// Homework is "what was given today", past-dated; widen the window so we
		// always surface the last 21 days regardless of what the caller asked for.
		const today = new Date();
		const hwFromDate = new Date(today.getTime() - 21 * 864e5).toISOString().slice(0, 10);
		const hwFrom = fromDate < hwFromDate ? fromDate : hwFromDate;
		const hwTo = toDate > hwFromDate ? toDate : today.toISOString().slice(0, 10);

		const batches = await Promise.all(
			s.roles.map(async (r) => {
				try {
					const { slots, groups } = await fetchOverview(s.baseUrl, s.cookie, r);
					const lessons = expandSchedule(slots, r, fromDate, toDate);
					const [exams, homework] = await Promise.all([
						fetchExamsForRole(s.baseUrl, s.cookie, r, fromDate, toDate).catch((e) => {
							console.warn(`[wilma] exams fetch failed for ${r.slug}:`, e);
							return [] as FamilyEvent[];
						}),
						fetchHomeworkForRole(s.baseUrl, s.cookie, r, groups, hwFrom, hwTo)
					]);
					return [...lessons, ...exams, ...homework];
				} catch (e) {
					console.warn(`[wilma] role ${r.slug} failed:`, e);
					return [] as FamilyEvent[];
				}
			})
		);

		return { source: 'wilma', events: batches.flat() };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (/401|403|session|login/i.test(msg)) session = null;
		return { source: 'wilma', events: [], error: msg };
	}
}
