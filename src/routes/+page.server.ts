import type { PageServerLoad } from './$types';
import { aggregate } from '$lib/server/aggregate';
import { startOfDay, endOfDay, addDays } from '$lib/utils/date';
import { isExam, isHomework, isMessage } from '$lib/utils/classify';

export const load: PageServerLoad = async () => {
	const now = new Date();
	// One wide range covers: today's timeline, +14d exams, -7d homework, -30d messages.
	const windowStart = startOfDay(addDays(now, -30));
	const windowEnd = endOfDay(addDays(now, 14));
	const data = await aggregate(windowStart, windowEnd);

	const todayIso = now.toISOString().slice(0, 10);
	const horizonIso = addDays(now, 14).toISOString().slice(0, 10);
	const homeworkFromIso = addDays(now, -7).toISOString().slice(0, 10);
	const messageFromIso = addDays(now, -30).toISOString().slice(0, 10);

	const todayEvents = data.events.filter((e) => e.start.slice(0, 10) === todayIso);
	const upcomingExams = data.events
		.filter(isExam)
		.filter((e) => e.start >= todayIso && e.start <= horizonIso)
		.sort((a, b) => a.start.localeCompare(b.start));
	const recentHomework = data.events
		.filter(isHomework)
		.filter((e) => e.start >= homeworkFromIso && e.start <= todayIso)
		.sort((a, b) => b.start.localeCompare(a.start));
	const recentMessages = data.events
		.filter(isMessage)
		.filter((e) => e.start.slice(0, 10) >= messageFromIso)
		.sort((a, b) => b.start.localeCompare(a.start));

	return {
		...data,
		events: todayEvents.filter((e) => !isExam(e) && !isHomework(e) && !isMessage(e)),
		upcomingExams,
		recentHomework,
		recentMessages
	};
};
