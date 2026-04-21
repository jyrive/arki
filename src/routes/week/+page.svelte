<script lang="ts">
	import EventCard from '$lib/components/EventCard.svelte';
	import ExamsPanel from '$lib/components/ExamsPanel.svelte';
	import FreshnessNotice from '$lib/components/FreshnessNotice.svelte';
	import HomeworkPanel from '$lib/components/HomeworkPanel.svelte';
	import SchoolDayColumns from '$lib/components/SchoolDayColumns.svelte';
	import Card from '$lib/components/md3/Card.svelte';
	import { groupByDay, formatDayHeading, startOfWeek, addDays } from '$lib/utils/date';
	import { isLesson } from '$lib/utils/classify';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const grouped = $derived(groupByDay(data.events));

	const weekDays = $derived.by(() => {
		const start = startOfWeek(new Date());
		return Array.from({ length: 7 }, (_, i) => {
			const d = addDays(start, i);
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		});
	});
</script>

<section class="mx-auto w-full max-w-4xl space-y-6">
	<header class="px-1 pt-2">
		<p class="text-label-lg text-on-surface-variant uppercase tracking-wide">This week</p>
		<h2 class="text-headline-md text-on-surface font-medium">Agenda</h2>
	</header>

	{#each data.sources as src (src.source)}
		{#if src.error}
			<Card variant="outlined" class="border-error/40">
				<p class="text-label-lg text-error font-medium capitalize">{src.source} unavailable</p>
				<p class="text-body-sm text-on-surface-variant">{src.error}</p>
			</Card>
		{/if}
	{/each}

	<FreshnessNotice stalestSuccess={data.stalestSuccess} fromDb={data.fromDb} />

	<ExamsPanel exams={data.upcomingExams} heading="Kokeet tällä viikolla" />

	<HomeworkPanel homework={data.recentHomework} heading="Läksyt" />

	{#each weekDays as day (day)}
		{@const events = grouped.get(day) ?? []}
		{@const lessons = events.filter(isLesson)}
		{@const others = events.filter((e) => !isLesson(e))}
		<div class="space-y-2">
			<h3 class="text-title-md text-on-surface px-1 font-medium">{formatDayHeading(day)}</h3>
			{#if events.length === 0}
				<p class="text-body-sm text-on-surface-variant px-1">—</p>
			{:else}
				<SchoolDayColumns events={lessons} />
				{#if others.length > 0}
					<div class="space-y-2">
						{#each others as event (event.id)}
							<EventCard {event} />
						{/each}
					</div>
				{/if}
			{/if}
		</div>
	{/each}
</section>
