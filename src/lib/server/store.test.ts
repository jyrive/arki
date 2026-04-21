import { describe, it, expect } from 'vitest';
import { rowToEvent, type DbEventRow } from './store';

describe('rowToEvent', () => {
	it('keeps timed events as ISO datetime', () => {
		const row: DbEventRow = {
			id: 'wilma:lesson:abc:1:2026-04-20',
			source: 'wilma',
			kind: 'lesson',
			title: 'Matikka',
			start_at: '2026-04-20T09:15:00.000Z',
			end_at: '2026-04-20T10:00:00.000Z',
			all_day: false,
			location: 'Room 1',
			person: 'TestKid',
			color: null,
			raw: null
		};
		const e = rowToEvent(row);
		expect(e.start).toBe('2026-04-20T09:15:00.000Z');
		expect(e.allDay).toBe(false);
		expect(e.source).toBe('wilma');
		expect(e.location).toBe('Room 1');
	});

	it('collapses all-day events to YYYY-MM-DD', () => {
		const row: DbEventRow = {
			id: 'wilma:hw:abc:2:2026-04-20:text',
			source: 'wilma',
			kind: 'homework',
			title: 'Läksy · Matikka · s. 105',
			start_at: '2026-04-20T00:00:00.000Z',
			end_at: '2026-04-20T00:00:00.000Z',
			all_day: true,
			location: null,
			person: 'TestKid',
			color: null,
			raw: null
		};
		const e = rowToEvent(row);
		expect(e.start).toBe('2026-04-20');
		expect(e.end).toBe('2026-04-20');
		expect(e.allDay).toBe(true);
		expect(e.location).toBeUndefined();
	});

	it('handles Date instances from pg driver', () => {
		const row: DbEventRow = {
			id: 'google:x',
			source: 'google',
			kind: 'calendar',
			title: 'Siivouspäivä',
			start_at: new Date('2026-04-20T00:00:00Z'),
			end_at: new Date('2026-04-21T00:00:00Z'),
			all_day: true,
			location: null,
			person: null,
			color: '#ccc',
			raw: { id: 'foo' }
		};
		const e = rowToEvent(row);
		expect(e.start).toBe('2026-04-20');
		expect(e.end).toBe('2026-04-21');
		expect(e.color).toBe('#ccc');
	});
});
