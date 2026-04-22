import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	// Inject all .env vars (no prefix filter) into process.env so that
	// server-side code using process.env directly (e.g. db.ts) works in dev.
	Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

	return {
		plugins: [tailwindcss(), sveltekit()],
		ssr: {
			// Native module — must not be bundled by Vite.
			external: ['better-sqlite3']
		},
		test: {
			include: ['src/**/*.{test,spec}.{js,ts}']
		}
	};
});
