import { describe, it, expect } from 'vitest';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, groupByDay } from './date';

describe('date utils', () => {
	it('startOfDay zeros the time', () => {
		const d = startOfDay(new Date('2026-04-20T14:30:00'));
		expect(d.getHours()).toBe(0);
		expect(d.getMinutes()).toBe(0);
		expect(d.getSeconds()).toBe(0);
		expect(d.getMilliseconds()).toBe(0);
	});

	it('endOfDay sets to last ms', () => {
		const d = endOfDay(new Date('2026-04-20T14:30:00'));
		expect(d.getHours()).toBe(23);
		expect(d.getMinutes()).toBe(59);
	});

	it('startOfWeek returns Monday', () => {
		// 2026-04-20 is a Monday
		const d = startOfWeek(new Date('2026-04-22T10:00:00'));
		expect(d.getDay()).toBe(1);
		expect(d.getDate()).toBe(20);
	});

	it('endOfWeek is just before next Monday', () => {
		const d = endOfWeek(new Date('2026-04-22T10:00:00'));
		expect(d.getDay()).toBe(0); // Sunday
	});

	it('groupByDay groups by local day key', () => {
		const groups = groupByDay([
			{ start: '2026-04-20T08:00:00' },
			{ start: '2026-04-20T18:00:00' },
			{ start: '2026-04-21T09:00:00' }
		]);
		expect(groups.get('2026-04-20')?.length).toBe(2);
		expect(groups.get('2026-04-21')?.length).toBe(1);
	});
});
