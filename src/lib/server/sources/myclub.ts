import type { SourceResult } from '$lib/types/event';

// Stub — MyClub integration deferred (no public API).
export async function fetchMyClubEvents(_from: Date, _to: Date): Promise<SourceResult> {
	return { source: 'myclub', events: [] };
}
