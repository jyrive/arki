/**
 * Core refresh routine — shared by the HTTP endpoint (Vercel) and the
 * standalone GitHub Actions fetcher. Accepts a plain `env` map so it works
 * both inside SvelteKit (process.env is populated by the platform) and as a
 * standalone Node script.
 */
import { migrate } from './migrate';
import { upsertEvents, recordRun, type EventKind } from './store';
import type { EventSource, FamilyEvent } from '$lib/types/event';
import {
	wilmaSession,
	lastWilmaSessionError,
	wilmaRoles,
	fetchWilmaOverviewGroups,
	fetchWilmaLessons,
	fetchWilmaExams,
	fetchWilmaHomework,
	fetchWilmaMessages,
	invalidateWilmaSession
} from './sources/wilma';
import { fetchGoogleEvents } from './sources/google';
import { fetchMyClubEvents } from './sources/myclub';

export interface KindReport {
	source: EventSource;
	kind: EventKind;
	success: boolean;
	error?: string;
	durationMs: number;
	inserted: number;
	updated: number;
	unchanged: number;
	removed: number;
	fetched: number;
}

export interface RefreshResult {
	ok: boolean;
	at: string;
	reports: KindReport[];
}

function dateOnly(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
	const copy = new Date(d);
	copy.setUTCDate(copy.getUTCDate() + days);
	return copy;
}

async function runKind(
	source: EventSource,
	kind: EventKind,
	window: { from: Date; to: Date },
	fetcher: () => Promise<FamilyEvent[]>
): Promise<KindReport> {
	const t0 = Date.now();
	try {
		const events = await fetcher();
		const stats = await upsertEvents(source, kind, events, window);
		const durationMs = Date.now() - t0;
		await recordRun(source, kind, { success: true, durationMs, stats, window });
		return { source, kind, success: true, durationMs, fetched: events.length, ...stats };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		const durationMs = Date.now() - t0;
		await recordRun(source, kind, { success: false, error: msg, durationMs, window }).catch(
			() => undefined
		);
		return {
			source,
			kind,
			success: false,
			error: msg,
			durationMs,
			fetched: 0,
			inserted: 0,
			updated: 0,
			unchanged: 0,
			removed: 0
		};
	}
}

/** Fetch all sources and upsert into Neon. Throws only on truly fatal errors
 *  (missing DB, migration failure). Per-source failures land in `reports`. */
export async function runRefresh(env: NodeJS.ProcessEnv = process.env): Promise<RefreshResult> {
	await migrate();

	const now = new Date();
	const reports: KindReport[] = [];

	const lessonWindow = { from: addDays(now, -3), to: addDays(now, 7) };
	const examWindow = { from: now, to: addDays(now, 21) };
	const homeworkWindow = { from: addDays(now, -7), to: addDays(now, 1) };
	const messageWindow = { from: addDays(now, -30), to: addDays(now, 1) };
	const calendarWindow = { from: addDays(now, -3), to: addDays(now, 14) };
	const myclubWindow = { from: addDays(now, -3), to: addDays(now, 14) };

	// ── Wilma ──────────────────────────────────────────────────────────
	const missingWilma = [
		!env.WILMA_BASE_URL && 'WILMA_BASE_URL',
		!env.WILMA_USERNAME && 'WILMA_USERNAME',
		!env.WILMA_PASSWORD && 'WILMA_PASSWORD'
	].filter(Boolean) as string[];
	const session = missingWilma.length === 0 ? await wilmaSession() : null;
	if (session) {
		const roles = wilmaRoles(session);
		// Collect events across all roles per kind, then upsert ONCE per kind.
		// Per-role upserts would trigger the window-delete step for each role,
		// deleting the previous role's just-inserted events.
		const lessonEvents: FamilyEvent[] = [];
		const examEvents: FamilyEvent[] = [];
		const homeworkEvents: FamilyEvent[] = [];
		const messageEvents: FamilyEvent[] = [];
		const roleErrors: string[] = [];
		for (const role of roles) {
			let overview: Awaited<ReturnType<typeof fetchWilmaOverviewGroups>> | null = null;
			try {
				overview = await fetchWilmaOverviewGroups(session, role);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				if (/401|403|session|login/i.test(msg)) invalidateWilmaSession();
				roleErrors.push(`${role.slug} overview: ${msg}`);
				continue;
			}
			try {
				lessonEvents.push(
					...(await fetchWilmaLessons(
						session,
						role,
						dateOnly(lessonWindow.from),
						dateOnly(lessonWindow.to)
					))
				);
			} catch (err) {
				roleErrors.push(`${role.slug} lessons: ${err instanceof Error ? err.message : err}`);
			}
			try {
				examEvents.push(
					...(await fetchWilmaExams(
						session,
						role,
						dateOnly(examWindow.from),
						dateOnly(examWindow.to)
					))
				);
			} catch (err) {
				roleErrors.push(`${role.slug} exams: ${err instanceof Error ? err.message : err}`);
			}
			try {
				homeworkEvents.push(
					...(await fetchWilmaHomework(
						session,
						role,
						overview.groups,
						dateOnly(homeworkWindow.from),
						dateOnly(homeworkWindow.to)
					))
				);
			} catch (err) {
				roleErrors.push(`${role.slug} homework: ${err instanceof Error ? err.message : err}`);
			}
			try {
				messageEvents.push(
					...(await fetchWilmaMessages(
						session,
						role,
						dateOnly(messageWindow.from),
						dateOnly(messageWindow.to)
					))
				);
			} catch (err) {
				roleErrors.push(`${role.slug} messages: ${err instanceof Error ? err.message : err}`);
			}
		}
		reports.push(await runKind('wilma', 'lesson', lessonWindow, async () => lessonEvents));
		reports.push(await runKind('wilma', 'exam', examWindow, async () => examEvents));
		reports.push(await runKind('wilma', 'homework', homeworkWindow, async () => homeworkEvents));
		reports.push(await runKind('wilma', 'message', messageWindow, async () => messageEvents));
		if (roleErrors.length > 0) console.warn('[wilma] role errors:', roleErrors.join('; '));
	} else {
		const reason =
			missingWilma.length > 0
				? `missing env: ${missingWilma.join(', ')}`
				: `login failed: ${lastWilmaSessionError() ?? 'unknown'}`;
		reports.push({
			source: 'wilma',
			kind: 'lesson',
			success: false,
			error: reason,
			durationMs: 0,
			fetched: 0,
			inserted: 0,
			updated: 0,
			unchanged: 0,
			removed: 0
		});
	}

	// ── Google ─────────────────────────────────────────────────────────
	reports.push(
		await runKind('google', 'calendar', calendarWindow, async () => {
			const res = await fetchGoogleEvents(calendarWindow.from, calendarWindow.to);
			if (res.error) throw new Error(res.error);
			return res.events;
		})
	);

	// ── MyClub (stub) ──────────────────────────────────────────────────
	reports.push(
		await runKind('myclub', 'calendar', myclubWindow, async () => {
			const res = await fetchMyClubEvents(myclubWindow.from, myclubWindow.to);
			if (res.error) throw new Error(res.error);
			return res.events;
		})
	);

	const ok = reports.every((r) => r.success);
	return { ok, at: now.toISOString(), reports };
}
