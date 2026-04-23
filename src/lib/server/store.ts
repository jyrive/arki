import { createHash } from 'node:crypto';
import type { FamilyEvent, EventSource } from '$lib/types/event';
import { getDb } from './db';

export type EventKind = 'lesson' | 'exam' | 'homework' | 'calendar' | 'message';

export interface UpsertStats {
	inserted: number;
	updated: number;
	unchanged: number;
	removed: number;
}

/** Stable content hash so we can skip unchanged rows. */
function hashEvent(e: FamilyEvent): string {
	const parts = [e.title, e.start, e.end, String(e.allDay), e.location ?? '', e.person ?? ''];
	return createHash('sha256').update(parts.join('\u0001')).digest('hex').slice(0, 40);
}

/** Normalizes an ISO date/datetime. All-day → midnight UTC. */
function toTimestamp(iso: string, allDay: boolean): string {
	if (allDay && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return `${iso}T00:00:00.000Z`;
	return iso;
}

function nowIso(): string {
	return new Date().toISOString();
}

/**
 * Upsert a batch and remove anything in `[window.from, window.to)` that wasn't
 * in this batch. Returns per-operation counts.
 */
export async function upsertEvents(
	source: EventSource,
	kind: EventKind,
	events: FamilyEvent[],
	window: { from: Date; to: Date }
): Promise<UpsertStats> {
	const db = getDb();
	const stats: UpsertStats = { inserted: 0, updated: 0, unchanged: 0, removed: 0 };

	const upsert = db.prepare(`
		INSERT INTO events (
			id, source, kind, title, start_at, end_at, all_day,
			location, person, color, raw, content_hash, fetched_at
		) VALUES (
			@id, @source, @kind, @title, @start_at, @end_at, @all_day,
			@location, @person, @color, @raw, @content_hash, @fetched_at
		)
		ON CONFLICT(id) DO UPDATE SET
			title        = excluded.title,
			start_at     = excluded.start_at,
			end_at       = excluded.end_at,
			all_day      = excluded.all_day,
			location     = excluded.location,
			person       = excluded.person,
			color        = excluded.color,
			raw          = excluded.raw,
			content_hash = excluded.content_hash,
			fetched_at   = excluded.fetched_at
		WHERE events.content_hash IS NOT excluded.content_hash
	`);

	const getHash = db.prepare<[string], { content_hash: string }>(
		`SELECT content_hash FROM events WHERE id = ?`
	);

	const tx = db.transaction((rows: FamilyEvent[]) => {
		const fetched_at = nowIso();
		for (const e of rows) {
			const content_hash = hashEvent(e);
			const existing = getHash.get(e.id);
			if (!existing) {
				upsert.run({
					id: e.id,
					source,
					kind,
					title: e.title,
					start_at: toTimestamp(e.start, e.allDay),
					end_at: toTimestamp(e.end, e.allDay),
					all_day: e.allDay ? 1 : 0,
					location: e.location ?? null,
					person: e.person ?? null,
					color: e.color ?? null,
					raw: e.raw != null ? JSON.stringify(e.raw) : null,
					content_hash,
					fetched_at
				});
				stats.inserted += 1;
			} else if (existing.content_hash !== content_hash) {
				upsert.run({
					id: e.id,
					source,
					kind,
					title: e.title,
					start_at: toTimestamp(e.start, e.allDay),
					end_at: toTimestamp(e.end, e.allDay),
					all_day: e.allDay ? 1 : 0,
					location: e.location ?? null,
					person: e.person ?? null,
					color: e.color ?? null,
					raw: e.raw != null ? JSON.stringify(e.raw) : null,
					content_hash,
					fetched_at
				});
				stats.updated += 1;
			} else {
				stats.unchanged += 1;
			}
		}
	});

	if (events.length > 0) tx(events);

	// Window-scoped delete: drop anything of this (source, kind) within the
	// window that we didn't just see.
	const seenIds = new Set(events.map((e) => e.id));
	const toDelete = db
		.prepare(
			`SELECT id FROM events
			  WHERE source = ? AND kind = ?
			    AND start_at >= ? AND start_at < ?`
		)
		.all(source, kind, window.from.toISOString(), window.to.toISOString()) as {
		id: string;
	}[];
	const del = db.prepare(`DELETE FROM events WHERE id = ?`);
	const delTx = db.transaction((ids: string[]) => {
		for (const id of ids) del.run(id);
	});
	const unseen = toDelete.map((r) => r.id).filter((id) => !seenIds.has(id));
	if (unseen.length > 0) delTx(unseen);
	stats.removed = unseen.length;

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
	const db = getDb();
	const { success, error, durationMs, stats, window } = outcome;
	const now = nowIso();
	db.prepare(
		`INSERT INTO source_runs (
			source, kind, last_attempt_at, last_success_at, last_error,
			duration_ms, inserted, updated, unchanged, removed,
			window_from, window_to
		) VALUES (
			@source, @kind, @last_attempt_at, @last_success_at, @last_error,
			@duration_ms, @inserted, @updated, @unchanged, @removed,
			@window_from, @window_to
		)
		ON CONFLICT(source, kind) DO UPDATE SET
			last_attempt_at = excluded.last_attempt_at,
			last_success_at = COALESCE(excluded.last_success_at, source_runs.last_success_at),
			last_error      = excluded.last_error,
			duration_ms     = excluded.duration_ms,
			inserted        = excluded.inserted,
			updated         = excluded.updated,
			unchanged       = excluded.unchanged,
			removed         = excluded.removed,
			window_from     = excluded.window_from,
			window_to       = excluded.window_to`
	).run({
		source,
		kind,
		last_attempt_at: now,
		last_success_at: success ? now : null,
		last_error: error ?? null,
		duration_ms: durationMs,
		inserted: stats?.inserted ?? 0,
		updated: stats?.updated ?? 0,
		unchanged: stats?.unchanged ?? 0,
		removed: stats?.removed ?? 0,
		window_from: window.from.toISOString(),
		window_to: window.to.toISOString()
	});
}

export interface DbEventRow {
	id: string;
	source: string;
	kind: string;
	title: string;
	start_at: string | Date;
	end_at: string | Date;
	all_day: boolean | number;
	location: string | null;
	person: string | null;
	color: string | null;
	raw: unknown;
}

/** Convert a DB row back into the FamilyEvent shape the UI expects. */
export function rowToEvent(row: DbEventRow): FamilyEvent {
	const toIso = (v: string | Date): string => (v instanceof Date ? v.toISOString() : v);
	const allDay = Boolean(row.all_day);
	const start = toIso(row.start_at);
	const end = toIso(row.end_at);
	const start_ = allDay ? start.slice(0, 10) : start;
	const end_ = allDay ? end.slice(0, 10) : end;
	let raw: unknown = row.raw;
	if (typeof raw === 'string') {
		try {
			raw = JSON.parse(raw);
		} catch {
			// leave as string
		}
	}
	return {
		id: row.id,
		source: row.source as EventSource,
		title: row.title,
		start: start_,
		end: end_,
		allDay,
		location: row.location ?? undefined,
		person: row.person ?? undefined,
		color: row.color ?? undefined,
		raw: raw ?? undefined
	};
}

/** Query events overlapping the given window (ordered by start). */
export async function selectEvents(from: Date, to: Date): Promise<FamilyEvent[]> {
	const db = getDb();
	const rows = db
		.prepare(
			`SELECT id, source, kind, title, start_at, end_at, all_day,
			        location, person, color, raw
			   FROM events
			  WHERE start_at >= ? AND start_at < ?
			  ORDER BY start_at ASC`
		)
		.all(from.toISOString(), to.toISOString()) as DbEventRow[];
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
	const db = getDb();
	return db
		.prepare(
			`SELECT source, kind, last_attempt_at, last_success_at, last_error,
			        duration_ms, inserted, updated, unchanged, removed
			   FROM source_runs
			  ORDER BY source, kind`
		)
		.all() as SourceRunRow[];
}
