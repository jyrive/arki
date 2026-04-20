import type { FamilyEvent, SourceResult } from '$lib/types/event';
import { fetchGoogleEvents } from './sources/google';
import { fetchWilmaEvents } from './sources/wilma';
import { fetchMyClubEvents } from './sources/myclub';

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
}

export async function aggregate(from: Date, to: Date): Promise<AggregateResult> {
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
	return { events, sources: results, cachedAt: new Date(at).toISOString() };
}
