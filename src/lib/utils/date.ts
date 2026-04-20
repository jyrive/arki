/**
 * Lightweight date helpers. Works in local time of the runtime — for a personal
 * family dashboard this matches user expectation (the server runs at home).
 */

export function startOfDay(d: Date): Date {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	return x;
}

export function endOfDay(d: Date): Date {
	const x = new Date(d);
	x.setHours(23, 59, 59, 999);
	return x;
}

/** ISO week starts on Monday. */
export function startOfWeek(d: Date): Date {
	const x = startOfDay(d);
	const dow = x.getDay(); // 0 = Sun
	const diff = (dow + 6) % 7; // days since Monday
	x.setDate(x.getDate() - diff);
	return x;
}

export function endOfWeek(d: Date): Date {
	const start = startOfWeek(d);
	const x = new Date(start);
	x.setDate(x.getDate() + 7);
	x.setMilliseconds(-1);
	return x;
}

export function addDays(d: Date, n: number): Date {
	const x = new Date(d);
	x.setDate(x.getDate() + n);
	return x;
}

export function sameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/** Group events by local-day key (YYYY-MM-DD). */
export function groupByDay<T extends { start: string }>(events: T[]): Map<string, T[]> {
	const out = new Map<string, T[]>();
	for (const ev of events) {
		const d = new Date(ev.start);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		const arr = out.get(key) ?? [];
		arr.push(ev);
		out.set(key, arr);
	}
	return out;
}

export function formatTime(iso: string, allDay: boolean): string {
	if (allDay) return 'All day';
	return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function formatDayHeading(key: string): string {
	const d = new Date(`${key}T00:00:00`);
	const today = startOfDay(new Date());
	const tomorrow = addDays(today, 1);
	if (sameDay(d, today)) return 'Today';
	if (sameDay(d, tomorrow)) return 'Tomorrow';
	return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
