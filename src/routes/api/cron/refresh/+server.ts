import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { migrate } from '$lib/server/migrate';
import { upsertEvents, recordRun, type EventKind } from '$lib/server/store';
import { hasDb } from '$lib/server/db';
import type { EventSource, FamilyEvent } from '$lib/types/event';
import {
	wilmaSession,
	wilmaRoles,
	fetchWilmaOverviewGroups,
	fetchWilmaLessons,
	fetchWilmaExams,
	fetchWilmaHomework,
	invalidateWilmaSession
} from '$lib/server/sources/wilma';
import { fetchGoogleEvents } from '$lib/server/sources/google';
import { fetchMyClubEvents } from '$lib/server/sources/myclub';

/**
 * Background refresher invoked by Vercel cron (or GitHub Actions / `pnpm cron:refresh`).
 *
 *   GET  /api/cron/refresh       ← Vercel cron calls this
 *   POST /api/cron/refresh       ← accepts both for manual runs
 *
 * Auth: `Authorization: Bearer $CRON_SECRET`. Vercel also sends that header
 * for its own crons when you configure CRON_SECRET in project env vars.
 */

interface KindReport {
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

function dateOnly(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
	const copy = new Date(d);
	copy.setUTCDate(copy.getUTCDate() + days);
	return copy;
}

/** A refresher for one (source, kind). Handles timing, errors, DB write. */
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
		await recordRun(source, kind, {
			success: true,
			durationMs,
			stats,
			window
		});
		return { source, kind, success: true, durationMs, fetched: events.length, ...stats };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		const durationMs = Date.now() - t0;
		await recordRun(source, kind, {
			success: false,
			error: msg,
			durationMs,
			window
		}).catch(() => undefined);
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

async function handle(request: Request) {
	// Auth ---------------------------------------------------------------
	const secret = env.CRON_SECRET;
	if (!secret) {
		throw error(500, 'CRON_SECRET not configured');
	}
	const auth = request.headers.get('authorization') ?? '';
	if (auth !== `Bearer ${secret}`) {
		throw error(401, 'unauthorized');
	}

	if (!hasDb()) {
		throw error(500, 'DATABASE_URL not configured');
	}

	await migrate();

	const now = new Date();
	const reports: KindReport[] = [];

	// ── Windows (per the plan) ─────────────────────────────────────────
	const lessonWindow = { from: addDays(now, -3), to: addDays(now, 7) };
	const examWindow = { from: now, to: addDays(now, 21) };
	const homeworkWindow = { from: addDays(now, -7), to: addDays(now, 1) };
	const calendarWindow = { from: addDays(now, -3), to: addDays(now, 14) };
	const myclubWindow = { from: addDays(now, -3), to: addDays(now, 14) };

	// ── Wilma (lessons/exams/homework) ─────────────────────────────────
	const session = await wilmaSession();
	if (session) {
		const roles = wilmaRoles(session);
		for (const role of roles) {
			// Overview is shared between lessons and homework (group ids). Do it
			// once per role, reuse for both.
			let overview: Awaited<ReturnType<typeof fetchWilmaOverviewGroups>> | null = null;
			try {
				overview = await fetchWilmaOverviewGroups(session, role);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				if (/401|403|session|login/i.test(msg)) invalidateWilmaSession();
				reports.push({
					source: 'wilma',
					kind: 'lesson',
					success: false,
					error: `overview: ${msg}`,
					durationMs: 0,
					fetched: 0,
					inserted: 0,
					updated: 0,
					unchanged: 0,
					removed: 0
				});
				continue;
			}

			const localOverview = overview;

			reports.push(
				await runKind('wilma', 'lesson', lessonWindow, () =>
					fetchWilmaLessons(session, role, dateOnly(lessonWindow.from), dateOnly(lessonWindow.to))
				)
			);
			reports.push(
				await runKind('wilma', 'exam', examWindow, () =>
					fetchWilmaExams(session, role, dateOnly(examWindow.from), dateOnly(examWindow.to))
				)
			);
			reports.push(
				await runKind('wilma', 'homework', homeworkWindow, () =>
					fetchWilmaHomework(
						session,
						role,
						localOverview.groups,
						dateOnly(homeworkWindow.from),
						dateOnly(homeworkWindow.to)
					)
				)
			);
		}
	} else {
		reports.push({
			source: 'wilma',
			kind: 'lesson',
			success: false,
			error: 'not configured or session failed',
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
	return json({ ok, at: now.toISOString(), reports }, { status: ok ? 200 : 207 });
}

export const GET: RequestHandler = ({ request }) => handle(request);
export const POST: RequestHandler = ({ request }) => handle(request);
