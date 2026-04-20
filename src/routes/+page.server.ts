import type { PageServerLoad } from './$types';
import { aggregate } from '$lib/server/aggregate';
import { startOfDay, endOfDay } from '$lib/utils/date';

export const load: PageServerLoad = async () => {
	const now = new Date();
	const result = await aggregate(startOfDay(now), endOfDay(now));
	return result;
};
