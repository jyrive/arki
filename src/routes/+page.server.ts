import type { PageServerLoad } from './$types';
import { aggregate } from '$lib/server/aggregate';
import { startOfDay, endOfDay, addDays } from '$lib/utils/date';
import { isExam, isHomework } from '$lib/utils/classify';

export const load: PageServerLoad = async () => {
	const now = new Date();
	const [today, horizon] = await Promise.all([
		aggregate(startOfDay(now), endOfDay(now)),
		aggregate(startOfDay(now), endOfDay(addDays(now, 14)))
	]);
	const upcomingExams = horizon.events
		.filter(isExam)
		.sort((a, b) => a.start.localeCompare(b.start));

	// Homework: Wilma source surfaces the last 21 days regardless of window.
	// Keep only the most recent ~7 days so the panel stays focused.
	const recentCutoff = addDays(now, -7).toISOString().slice(0, 10);
	const recentHomework = today.events
		.filter(isHomework)
		.filter((e) => e.start >= recentCutoff)
		.sort((a, b) => b.start.localeCompare(a.start));

	return {
		...today,
		events: today.events.filter((e) => !isExam(e) && !isHomework(e)),
		upcomingExams,
		recentHomework
	};
};
