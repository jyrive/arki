import type { SourceResult } from '$lib/types/event';

// Stub — Wilma integration planned for Phase 2.
export async function fetchWilmaEvents(_from: Date, _to: Date): Promise<SourceResult> {
	return { source: 'wilma', events: [] };
}
