import type { PageServerLoad } from './$types';
import { aggregate } from '$lib/server/aggregate';
import { startOfDay, endOfDay, addDays } from '$lib/utils/date';
import { isExam } from '$lib/utils/classify';

export const load: PageServerLoad = async () => {
	const now = new Date();
	const [today, horizon] = await Promise.all([
		aggregate(startOfDay(now), endOfDay(now)),
		aggregate(startOfDay(now), endOfDay(addDays(now, 14)))
	]);
	const upcomingExams = horizon.events
		.filter(isExam)
		.sort((a, b) => a.start.localeCompare(b.start));
	return {
		...today,
		events: today.events.filter((e) => !isExam(e)),
		upcomingExams
	};
};
