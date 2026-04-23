<script lang="ts">
	import EventCard from '$lib/components/EventCard.svelte';
	import ExamsPanel from '$lib/components/ExamsPanel.svelte';
	import FreshnessNotice from '$lib/components/FreshnessNotice.svelte';
	import HomeworkPanel from '$lib/components/HomeworkPanel.svelte';
	import MessagesPanel from '$lib/components/MessagesPanel.svelte';
	import Card from '$lib/components/md3/Card.svelte';
	import { isLesson } from '$lib/utils/classify';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const otherEvents = $derived(data.events.filter((e) => !isLesson(e)));

	const today = new Date().toLocaleDateString(undefined, {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
	});
</script>

<section class="mx-auto w-full max-w-7xl space-y-3">
	{#each data.sources as src (src.source)}
		{#if src.error}
			<Card variant="outlined" class="border-error/40">
				<p class="text-label-lg text-error font-medium capitalize">{src.source} unavailable</p>
				<p class="text-body-sm text-on-surface-variant">{src.error}</p>
			</Card>
		{/if}
	{/each}

	<div class="grid items-start gap-4 md:grid-cols-[2fr_1fr_1fr]">
		<!-- Column 1: Today's events -->
		<div class="space-y-3">
			<div class="px-1">
				<h2 class="text-title-lg text-on-surface font-medium capitalize">{today}</h2>
				<FreshnessNotice stalestSuccess={data.stalestSuccess} fromDb={data.fromDb} />
			</div>
			{#if otherEvents.length === 0}
				<Card variant="outlined">
					<p class="text-on-surface-variant text-body-md">
						Nothing scheduled today. Enjoy the calm.
					</p>
				</Card>
			{:else}
				<div class="space-y-3">
					{#each otherEvents as event (event.id)}
						<EventCard {event} />
					{/each}
				</div>
			{/if}
		</div>

		<!-- Column 2: Messages -->
		<div>
			<MessagesPanel messages={data.recentMessages} heading="Viimeisimmät viestit" />
		</div>

		<!-- Column 3: Homework + Exams -->
		<div class="space-y-4">
			<HomeworkPanel homework={data.recentHomework} heading="Viimeisimmät läksyt" />
			<ExamsPanel exams={data.upcomingExams} heading="Tulevat kokeet" />
		</div>
	</div>
</section>
