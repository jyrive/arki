import type { FamilyEvent, SourceResult, EventSource } from '$lib/types/event';
import { fetchGoogleEvents } from './sources/google';
import { fetchWilmaEvents } from './sources/wilma';
import { fetchMyClubEvents } from './sources/myclub';
import { hasDb } from './db';
import { selectEvents, selectSourceRuns } from './store';

interface CacheEntry {
	at: number;
	results: SourceResult[];
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

function key(from: Date, to: Date) {
	return `${from.toISOString()}|${to.toISOString()}`;
}

export interface AggregateResult {
	events: FamilyEvent[];
	sources: SourceResult[];
	cachedAt: string;
	/** When DB-backed, oldest successful fetch among (source, kind) slots. */
	stalestSuccess?: string | null;
	/** Whether data came from Postgres (`true`) or live fetch (`false`). */
	fromDb?: boolean;
}

export async function aggregate(from: Date, to: Date): Promise<AggregateResult> {
	if (hasDb()) {
		return aggregateFromDb(from, to);
	}
	return aggregateLive(from, to);
}

/** DB-backed path (cron keeps it warm). */
async function aggregateFromDb(from: Date, to: Date): Promise<AggregateResult> {
	const [events, runs] = await Promise.all([selectEvents(from, to), selectSourceRuns()]);

	// Roll up source_runs → SourceResult (one per source). An error at any kind
	// surfaces as a source error; UI shows the "source unavailable" banner.
	const bySource = new Map<EventSource, { events: FamilyEvent[]; errors: string[] }>();
	for (const e of events) {
		if (!bySource.has(e.source)) bySource.set(e.source, { events: [], errors: [] });
		bySource.get(e.source)!.events.push(e);
	}
	for (const r of runs) {
		const src = r.source as EventSource;
		if (!bySource.has(src)) bySource.set(src, { events: [], errors: [] });
		if (r.last_error) bySource.get(src)!.errors.push(`${r.kind}: ${r.last_error}`);
	}

	const sources: SourceResult[] = [...bySource.entries()].map(([source, v]) => ({
		source,
		events: v.events,
		error: v.errors.length > 0 ? v.errors.join('; ') : undefined
	}));

	const stalestSuccess = runs.reduce<string | null>((acc, r) => {
		if (!r.last_success_at) return acc;
		if (!acc) return r.last_success_at;
		return r.last_success_at < acc ? r.last_success_at : acc;
	}, null);

	return {
		events,
		sources,
		cachedAt: new Date().toISOString(),
		stalestSuccess,
		fromDb: true
	};
}

/** Legacy live-fetch path; used locally when `DATABASE_URL` isn't set. */
async function aggregateLive(from: Date, to: Date): Promise<AggregateResult> {
	const k = key(from, to);
	const hit = cache.get(k);
	if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
		return finalize(hit.results, hit.at);
	}

	const results = await Promise.all([
		fetchGoogleEvents(from, to),
		fetchWilmaEvents(from, to),
		fetchMyClubEvents(from, to)
	]);

	const at = Date.now();
	cache.set(k, { at, results });
	return finalize(results, at);
}

function finalize(results: SourceResult[], at: number): AggregateResult {
	const events = results
		.flatMap((r) => r.events)
		.sort((a, b) => a.start.localeCompare(b.start));
	return { events, sources: results, cachedAt: new Date(at).toISOString(), fromDb: false };
}
