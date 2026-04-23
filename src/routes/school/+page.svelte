<script lang="ts">
	import FreshnessNotice from '$lib/components/FreshnessNotice.svelte';
	import SchoolDayColumns from '$lib/components/SchoolDayColumns.svelte';
	import Card from '$lib/components/md3/Card.svelte';
	import { groupByDay, formatDayHeading, startOfWeek, addDays } from '$lib/utils/date';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const grouped = $derived(groupByDay(data.events));

	/** Mon–Fri of the current week. */
	const schoolDays = $derived.by(() => {
		const start = startOfWeek(new Date());
		return Array.from({ length: 5 }, (_, i) => {
			const d = addDays(start, i);
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		});
	});
</script>

<section class="mx-auto w-full max-w-4xl space-y-4">
	<header class="px-1 pt-2">
		<p class="text-label-lg text-on-surface-variant uppercase tracking-wide">Koulu</p>
		<h2 class="text-headline-md text-on-surface font-medium">Tämän viikon lukujärjestys</h2>
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

	{#each schoolDays as day (day)}
		{@const lessons = grouped.get(day) ?? []}
		<div class="space-y-2">
			<h3 class="text-title-md text-on-surface px-1 font-medium">{formatDayHeading(day)}</h3>
			{#if lessons.length === 0}
				<p class="text-body-sm text-on-surface-variant px-1">—</p>
			{:else}
				<SchoolDayColumns events={lessons} />
			{/if}
		</div>
	{/each}
</section>
