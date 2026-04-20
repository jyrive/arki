import type { PageServerLoad } from './$types';
import { aggregate } from '$lib/server/aggregate';
import { startOfWeek, endOfWeek } from '$lib/utils/date';

export const load: PageServerLoad = async () => {
	const now = new Date();
	const result = await aggregate(startOfWeek(now), endOfWeek(now));
	return result;
};
