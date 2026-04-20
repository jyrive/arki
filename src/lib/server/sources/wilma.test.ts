import { describe, it, expect } from 'vitest';
import { expandSchedule, parseFinnishDate, parseExamsHtml, parseHomeworkHtml } from './wilma';

describe('parseFinnishDate', () => {
	it('parses weekday-prefixed dot format', () => {
		expect(parseFinnishDate('Pe 8.5.2026')).toBe('2026-05-08');
	});
	it('parses bare dot format', () => {
		expect(parseFinnishDate('8.5.2026')).toBe('2026-05-08');
		expect(parseFinnishDate('20.12.2025')).toBe('2025-12-20');
	});
	it('parses month-name variant', () => {
		expect(parseFinnishDate('8. toukokuuta 2026')).toBe('2026-05-08');
	});
	it('returns null for unrecognized input', () => {
		expect(parseFinnishDate('something else')).toBeNull();
	});
});

describe('expandSchedule', () => {
	const role = { slug: 'abc12345', name: 'TestKid' };
	const slot = {
		ReservationID: 14121,
		ScheduleID: 1926887850,
		Start: '09:15',
		End: '10:00',
		DateArray: ['2026-04-20', '2026-04-27', '2026-05-04'],
		Groups: [{ FullCaption: 'Suomen kieli ja kirjallisuus', Rooms: [{ LongCaption: 'Room 1' }] }]
	};

	it('emits one event per DateArray entry inside window', () => {
		const events = expandSchedule([slot], role, '2026-04-20', '2026-04-27');
		expect(events).toHaveLength(2);
		expect(events[0]).toMatchObject({
			source: 'wilma',
			title: 'Suomen kieli ja kirjallisuus',
			start: '2026-04-20T09:15:00',
			end: '2026-04-20T10:00:00',
			location: 'Room 1',
			person: 'TestKid',
			allDay: false
		});
	});

	it('filters out dates outside window', () => {
		const events = expandSchedule([slot], role, '2026-05-01', '2026-05-31');
		expect(events).toHaveLength(1);
		expect(events[0].start).toBe('2026-05-04T09:15:00');
	});

	it('produces stable unique ids', () => {
		const events = expandSchedule([slot], role, '2026-04-01', '2026-12-31');
		const ids = new Set(events.map((e) => e.id));
		expect(ids.size).toBe(events.length);
	});
});

describe('parseExamsHtml', () => {
	const html = `
		<div class="table-responsive"><table class="table table-grey">
			<tr><td><strong>Pe 8.5.2026</strong></td>
			<td>sanaluokat : 2.SUK_ SUK_41 : Suomen kieli ja kirjallisuus</td></tr>
			<tr><th>Kokeen lisätiedot</th><td>Taitojen vihko s. 58-79<br>Verbit ja substantiivit.</td></tr>
		</table></div>
		<table class="table table-grey">
			<tr><td><strong>Ma 11.5.2026</strong></td>
			<td>yhteiskuntaopin koe : 2.YH_ YH_41 : Yhteiskuntaoppi</td></tr>
		</table>
	`;
	const exams = parseExamsHtml(html);

	it('finds all exam tables', () => {
		expect(exams).toHaveLength(2);
	});

	it('extracts date, subject, and title', () => {
		expect(exams[0]).toMatchObject({
			date: '2026-05-08',
			subject: 'Suomen kieli ja kirjallisuus',
			title: 'sanaluokat'
		});
		expect(exams[1]).toMatchObject({
			date: '2026-05-11',
			subject: 'Yhteiskuntaoppi',
			title: 'yhteiskuntaopin koe'
		});
	});

	it('captures additional details with newlines', () => {
		expect(exams[0].details).toContain('Taitojen vihko');
		expect(exams[0].details).toContain('\nVerbit');
	});

	it('skips tables without a recognizable date', () => {
		expect(parseExamsHtml('<table class="table-grey"><tr><td><strong>n/a</strong></td></tr></table>')).toEqual([]);
	});
});

describe('parseHomeworkHtml', () => {
	const sample = `
		<h2>Muuta</h2>
		<table><tr><td>1.1.2026</td><td>ignored</td></tr></table>
		<h3 class="margin-top">Kotitehtävät</h3>
		<table class="table-grey">
			<tr><td data-sortvalue="46132">20.04.2026</td><td>s. 105 KT-laatikko</td></tr>
			<tr><td data-sortvalue="46125">13.04.2026</td><td>Lue s. 12-14<br>tee tehtävä 3</td></tr>
			<tr><td>bogus</td><td>no date</td></tr>
			<tr><td data-sortvalue="46118">06.04.2026</td><td></td></tr>
		</table>
	`;

	it('returns only rows under the Kotitehtävät heading', () => {
		const rows = parseHomeworkHtml(sample);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toEqual({ date: '2026-04-20', text: 's. 105 KT-laatikko' });
	});

	it('normalizes whitespace and strips tags', () => {
		const rows = parseHomeworkHtml(sample);
		expect(rows[1]).toEqual({ date: '2026-04-13', text: 'Lue s. 12-14 tee tehtävä 3' });
	});

	it('returns empty list when heading missing', () => {
		expect(parseHomeworkHtml('<p>nothing here</p>')).toEqual([]);
	});
});
