/// <reference types="@sveltejs/kit" />
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module '*.sql?raw' {
	const content: string;
	export default content;
}

export {};
