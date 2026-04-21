import { createHash } from 'node:crypto';
import type { FamilyEvent, EventSource } from '$lib/types/event';
import { getSql } from './db';

export type EventKind = 'lesson' | 'exam' | 'homework' | 'calendar';

export interface UpsertStats {
	inserted: number;
	updated: number;
	unchanged: number;
	removed: number;
}

/** Stable content hash so `ON CONFLICT DO UPDATE` can skip unchanged rows. */
function hashEvent(e: FamilyEvent): string {
	const parts = [e.title, e.start, e.end, String(e.allDay), e.location ?? '', e.person ?? ''];
	return createHash('sha256').update(parts.join('\u0001')).digest('hex').slice(0, 40);
}

/** Normalizes an ISO date/datetime for Postgres. All-day → midnight UTC. */
function toTimestamp(iso: string, allDay: boolean): string {
	if (allDay && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return `${iso}T00:00:00Z`;
	return iso;
}

/**
 * Upsert a batch and remove anything in `[window.from, window.to)` that wasn't
 * in this batch. `window` is an inclusive-from, exclusive-to datetime range.
 *
 * Returns per-operation counts so the cron can log what actually changed.
 */
export async function upsertEvents(
	source: EventSource,
	kind: EventKind,
	events: FamilyEvent[],
	window: { from: Date; to: Date }
): Promise<UpsertStats> {
	const sql = getSql();
	const stats: UpsertStats = { inserted: 0, updated: 0, unchanged: 0, removed: 0 };

	// 1) Upsert with content-hash guard. Returned rows are ONLY the ones that
	//    actually changed (insert or meaningful update). Anything with the same
	//    hash triggers no write and doesn't appear in RETURNING.
	if (events.length > 0) {
		// Build rows in parallel arrays for parameterized multi-row insert.
		const ids: string[] = [];
		const sources: string[] = [];
		const kinds: string[] = [];
		const titles: string[] = [];
		const starts: string[] = [];
		const ends: string[] = [];
		const allDays: boolean[] = [];
		const locations: (string | null)[] = [];
		const persons: (string | null)[] = [];
		const colors: (string | null)[] = [];
		const raws: string[] = [];
		const hashes: string[] = [];
		for (const e of events) {
			ids.push(e.id);
			sources.push(source);
			kinds.push(kind);
			titles.push(e.title);
			starts.push(toTimestamp(e.start, e.allDay));
			ends.push(toTimestamp(e.end, e.allDay));
			allDays.push(e.allDay);
			locations.push(e.location ?? null);
			persons.push(e.person ?? null);
			colors.push(e.color ?? null);
			raws.push(JSON.stringify(e.raw ?? null));
			hashes.push(hashEvent(e));
		}

		const changed = (await sql`
			INSERT INTO events (
				id, source, kind, title, start_at, end_at, all_day,
				location, person, color, raw, content_hash, fetched_at
			)
			SELECT
				x.id, x.source, x.kind, x.title, x.start_at::timestamptz, x.end_at::timestamptz,
				x.all_day, x.location, x.person, x.color, x.raw::jsonb, x.content_hash, now()
			FROM unnest(
				${ids}::text[],       ${sources}::text[],   ${kinds}::text[],
				${titles}::text[],    ${starts}::text[],    ${ends}::text[],
				${allDays}::bool[],   ${locations}::text[], ${persons}::text[],
				${colors}::text[],    ${raws}::text[],      ${hashes}::text[]
			) AS x(
				id, source, kind, title, start_at, end_at, all_day,
				location, person, color, raw, content_hash
			)
			ON CONFLICT (id) DO UPDATE SET
				title        = EXCLUDED.title,
				start_at     = EXCLUDED.start_at,
				end_at       = EXCLUDED.end_at,
				all_day      = EXCLUDED.all_day,
				location     = EXCLUDED.location,
				person       = EXCLUDED.person,
				color        = EXCLUDED.color,
				raw          = EXCLUDED.raw,
				content_hash = EXCLUDED.content_hash,
				fetched_at   = now()
			WHERE events.content_hash IS DISTINCT FROM EXCLUDED.content_hash
			RETURNING id, (xmax = 0) AS was_insert
		`) as { id: string; was_insert: boolean }[];

		for (const r of changed) {
			if (r.was_insert) stats.inserted += 1;
			else stats.updated += 1;
		}
		stats.unchanged = events.length - changed.length;
	}

	// 2) Window-scoped delete: drop anything of this (source, kind) within the
	//    window that we didn't just see. Keeps history outside the window.
	const seenIds = events.map((e) => e.id);
	const removed = (await sql`
		DELETE FROM events
		 WHERE source = ${source}
		   AND kind = ${kind}
		   AND start_at >= ${window.from.toISOString()}
		   AND start_at <  ${window.to.toISOString()}
		   AND NOT (id = ANY(${seenIds}::text[]))
		RETURNING id
	`) as { id: string }[];
	stats.removed = removed.length;

	return stats;
}

/** Records the outcome of a cron fetch for a (source, kind) slot. */
export async function recordRun(
	source: EventSource,
	kind: EventKind,
	outcome: {
		success: boolean;
		error?: string;
		durationMs: number;
		stats?: UpsertStats;
		window: { from: Date; to: Date };
	}
): Promise<void> {
	const sql = getSql();
	const { success, error, durationMs, stats, window } = outcome;
	await sql`
		INSERT INTO source_runs (
			source, kind, last_attempt_at, last_success_at, last_error,
			duration_ms, inserted, updated, unchanged, removed,
			window_from, window_to
		)
		VALUES (
			${source}, ${kind}, now(),
			${success ? new Date().toISOString() : null},
			${error ?? null},
			${durationMs},
			${stats?.inserted ?? 0},
			${stats?.updated ?? 0},
			${stats?.unchanged ?? 0},
			${stats?.removed ?? 0},
			${window.from.toISOString()},
			${window.to.toISOString()}
		)
		ON CONFLICT (source, kind) DO UPDATE SET
			last_attempt_at = EXCLUDED.last_attempt_at,
			last_success_at = COALESCE(EXCLUDED.last_success_at, source_runs.last_success_at),
			last_error      = EXCLUDED.last_error,
			duration_ms     = EXCLUDED.duration_ms,
			inserted        = EXCLUDED.inserted,
			updated         = EXCLUDED.updated,
			unchanged       = EXCLUDED.unchanged,
			removed         = EXCLUDED.removed,
			window_from     = EXCLUDED.window_from,
			window_to       = EXCLUDED.window_to
	`;
}

export interface DbEventRow {
	id: string;
	source: string;
	kind: string;
	title: string;
	start_at: string | Date;
	end_at: string | Date;
	all_day: boolean;
	location: string | null;
	person: string | null;
	color: string | null;
	raw: unknown;
}

/** Convert a DB row back into the FamilyEvent shape the UI expects. */
export function rowToEvent(row: DbEventRow): FamilyEvent {
	const toIso = (v: string | Date): string => (v instanceof Date ? v.toISOString() : v);
	// All-day events live as date-only strings in FamilyEvent; DB stores midnight
	// UTC. Strip back to YYYY-MM-DD.
	const start = toIso(row.start_at);
	const end = toIso(row.end_at);
	const start_ = row.all_day ? start.slice(0, 10) : start;
	const end_ = row.all_day ? end.slice(0, 10) : end;
	return {
		id: row.id,
		source: row.source as EventSource,
		title: row.title,
		start: start_,
		end: end_,
		allDay: row.all_day,
		location: row.location ?? undefined,
		person: row.person ?? undefined,
		color: row.color ?? undefined,
		raw: row.raw ?? undefined
	};
}

/** Query events overlapping the given window (ordered by start). */
export async function selectEvents(from: Date, to: Date): Promise<FamilyEvent[]> {
	const sql = getSql();
	const rows = (await sql`
		SELECT id, source, kind, title, start_at, end_at, all_day,
		       location, person, color, raw
		  FROM events
		 WHERE start_at >= ${from.toISOString()}
		   AND start_at <  ${to.toISOString()}
		 ORDER BY start_at ASC
	`) as DbEventRow[];
	return rows.map(rowToEvent);
}

export interface SourceRunRow {
	source: string;
	kind: string;
	last_attempt_at: string;
	last_success_at: string | null;
	last_error: string | null;
	duration_ms: number;
	inserted: number;
	updated: number;
	unchanged: number;
	removed: number;
}

export async function selectSourceRuns(): Promise<SourceRunRow[]> {
	const sql = getSql();
	const rows = (await sql`
		SELECT source, kind, last_attempt_at, last_success_at, last_error,
		       duration_ms, inserted, updated, unchanged, removed
		  FROM source_runs
		 ORDER BY source, kind
	`) as SourceRunRow[];
	return rows;
}
