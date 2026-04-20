export type EventSource = 'google' | 'wilma' | 'myclub';

export interface FamilyEvent {
	id: string;
	source: EventSource;
	title: string;
	/** ISO 8601 datetime (UTC or with offset). For all-day events, ISO date. */
	start: string;
	/** ISO 8601 datetime/date. For all-day events, exclusive end date. */
	end: string;
	allDay: boolean;
	location?: string;
	attendees?: string[];
	/** Hex color hint for the source/calendar */
	color?: string;
	/** Optional per-person tag (e.g. child name) */
	person?: string;
	/** Original payload, for debugging only */
	raw?: unknown;
}

export interface SourceResult {
	source: EventSource;
	events: FamilyEvent[];
	error?: string;
}
