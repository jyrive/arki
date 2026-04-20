<script lang="ts">
	import EventCard from '$lib/components/EventCard.svelte';
	import ExamsPanel from '$lib/components/ExamsPanel.svelte';
	import Card from '$lib/components/md3/Card.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const today = new Date().toLocaleDateString(undefined, {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	});
</script>

<section class="mx-auto w-full max-w-2xl space-y-4">
	<header class="px-1 pt-2">
		<p class="text-label-lg text-on-surface-variant uppercase tracking-wide">Today</p>
		<h2 class="text-headline-md text-on-surface font-medium">{today}</h2>
	</header>

	{#each data.sources as src (src.source)}
		{#if src.error}
			<Card variant="outlined" class="border-error/40">
				<p class="text-label-lg text-error font-medium capitalize">{src.source} unavailable</p>
				<p class="text-body-sm text-on-surface-variant">{src.error}</p>
			</Card>
		{/if}
	{/each}

	<ExamsPanel exams={data.upcomingExams} heading="Tulevat kokeet" />

	{#if data.events.length === 0}
		<Card variant="outlined">
			<p class="text-on-surface-variant text-body-md">Nothing scheduled today. Enjoy the calm. 🌿</p>
		</Card>
	{:else}
		<div class="space-y-3">
			{#each data.events as event (event.id)}
				<EventCard {event} />
			{/each}
		</div>
	{/if}
</section>
