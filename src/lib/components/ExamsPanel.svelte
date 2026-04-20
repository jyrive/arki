<script lang="ts">
	import type { FamilyEvent } from '$lib/types/event';
	import Card from '$lib/components/md3/Card.svelte';
	import { formatDayHeading } from '$lib/utils/date';

	interface Props {
		exams: FamilyEvent[];
		heading?: string;
	}
	let { exams, heading = 'Kokeet' }: Props = $props();

	// Group by date (ISO YYYY-MM-DD)
	const byDay = $derived.by(() => {
		const map = new Map<string, FamilyEvent[]>();
		for (const e of exams) {
			const day = e.start.slice(0, 10);
			const list = map.get(day) ?? [];
			list.push(e);
			map.set(day, list);
		}
		return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
	});

	function cleanTitle(title: string): string {
		return title.replace(/^Koe:\s*/, '');
	}
</script>

{#if exams.length > 0}
	<section class="space-y-2">
		<header class="flex items-baseline justify-between px-1">
			<h3 class="text-title-md text-on-surface font-medium">📝 {heading}</h3>
			<span class="text-label-md text-on-surface-variant">{exams.length}</span>
		</header>
		<Card variant="outlined" class="space-y-3 border-tertiary/40">
			{#each byDay as [day, items] (day)}
				<div class="space-y-1">
					<p class="text-label-lg text-tertiary font-medium uppercase tracking-wide">
						{formatDayHeading(day)}
					</p>
					{#each items as e (e.id)}
						<div class="flex items-baseline justify-between gap-3">
							<p class="text-body-md text-on-surface min-w-0 truncate">{cleanTitle(e.title)}</p>
							{#if e.person}
								<span class="text-label-md text-on-surface-variant shrink-0">{e.person}</span>
							{/if}
						</div>
					{/each}
				</div>
			{/each}
		</Card>
	</section>
{/if}
