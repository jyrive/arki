import type { PageServerLoad } from './$types';
import { aggregate } from '$lib/server/aggregate';
import { startOfWeek, endOfWeek } from '$lib/utils/date';
import { isExam } from '$lib/utils/classify';

export const load: PageServerLoad = async () => {
	const now = new Date();
	const result = await aggregate(startOfWeek(now), endOfWeek(now));
	const upcomingExams = result.events
		.filter(isExam)
		.sort((a, b) => a.start.localeCompare(b.start));
	return {
		...result,
		events: result.events.filter((e) => !isExam(e)),
		upcomingExams
	};
};
