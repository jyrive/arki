import { redirect } from '@sveltejs/kit';
import { createHash } from 'crypto';
import { env } from '$env/dynamic/private';

const COOKIE = 'auth';

function expectedToken() {
	const pw = env.AUTH_PASSWORD;
	if (!pw) return null;
	return createHash('sha256').update(pw).digest('hex');
}

export const handle = async ({ event, resolve }) => {
	const path = event.url.pathname;

	// API routes have their own auth; login page is public
	if (path.startsWith('/api/') || path.startsWith('/login')) {
		return resolve(event);
	}

	const token = expectedToken();
	if (token && event.cookies.get(COOKIE) !== token) {
		const next = encodeURIComponent(path + event.url.search);
		redirect(303, `/login?next=${next}`);
	}

	return resolve(event);
};
