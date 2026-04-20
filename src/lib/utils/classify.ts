import type { FamilyEvent } from '$lib/types/event';

/** An "exam" is currently a Wilma all-day event whose title is prefixed with "Koe:". */
export function isExam(e: FamilyEvent): boolean {
	return e.source === 'wilma' && e.allDay && e.title.startsWith('Koe');
}
