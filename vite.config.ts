import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	ssr: {
		// Native module — must not be bundled by Vite.
		external: ['better-sqlite3']
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	}
});
