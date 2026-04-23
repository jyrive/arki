import { fail, redirect } from '@sveltejs/kit';
import { createHash } from 'crypto';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';

const COOKIE = 'auth';
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

function token() {
	const pw = env.AUTH_PASSWORD;
	if (!pw) return null;
	return createHash('sha256').update(pw).digest('hex');
}

export const load: PageServerLoad = async ({ cookies, url }) => {
	// Already logged in — go where they were headed
	const t = token();
	if (t && cookies.get(COOKIE) === t) {
		const next = url.searchParams.get('next') ?? '/';
		redirect(303, next);
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const password = String(data.get('password') ?? '');

		if (!env.AUTH_PASSWORD || password !== env.AUTH_PASSWORD) {
			return fail(403, { error: 'Wrong password.' });
		}

		cookies.set(COOKIE, token(), {
			path: '/',
			httpOnly: true,
			secure: !dev,
			sameSite: 'strict',
			maxAge: TEN_YEARS
		});

		const next = url.searchParams.get('next') ?? '/';
		redirect(303, next);
	}
};
