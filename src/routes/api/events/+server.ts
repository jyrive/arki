import { json, error } from '@sveltejs/kit';
import { aggregate } from '$lib/server/aggregate';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const fromStr = url.searchParams.get('from');
	const toStr = url.searchParams.get('to');
	if (!fromStr || !toStr) {
		throw error(400, 'from and to query params (ISO datetimes) are required');
	}
	const from = new Date(fromStr);
	const to = new Date(toStr);
	if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
		throw error(400, 'invalid datetime');
	}
	const result = await aggregate(from, to);
	return json(result);
};
