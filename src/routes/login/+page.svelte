<script lang="ts">
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let password = $state('');
</script>

<svelte:head>
	<title>Sign in</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center px-4">
	<div class="w-full max-w-xs space-y-6">
		<h1 class="text-headline-sm text-on-surface text-center font-medium">Arki</h1>

		<form method="POST" class="space-y-4">
			<div class="space-y-1">
				<label for="password" class="text-label-md text-on-surface-variant">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					bind:value={password}
					class="border-outline-variant bg-surface text-on-surface focus:border-primary focus:ring-primary w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:ring-1"
				/>
			</div>

			{#if form?.error}
				<p class="text-error text-body-sm">{form.error}</p>
			{/if}

			<button
				type="submit"
				class="bg-primary text-on-primary hover:opacity-90 focus-visible:outline-primary h-10 w-full rounded-full px-6 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2"
			>
				Sign in
			</button>
		</form>
	</div>
</div>
