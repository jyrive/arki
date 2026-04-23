<script lang="ts">
	import type { FamilyEvent } from '$lib/types/event';
	import { formatTime } from '$lib/utils/date';
	import Icon from '$lib/components/md3/Icon.svelte';

	interface Props {
		/** Lesson-style events (timed, source=wilma). */
		events: FamilyEvent[];
	}
	let { events }: Props = $props();

	const columns = $derived.by(() => {
		const map = new Map<string, FamilyEvent[]>();
		for (const e of events) {
			const key = e.person ?? 'Wilma';
			const list = map.get(key) ?? [];
			list.push(e);
			map.set(key, list);
		}
		for (const list of map.values()) list.sort((a, b) => a.start.localeCompare(b.start));
		return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
	});
</script>

{#if events.length > 0}
	<div
		class="grid gap-3"
		style:grid-template-columns={`repeat(${columns.length}, minmax(0, 1fr))`}
	>
		{#each columns as [person, items] (person)}
			<div class="space-y-2">
				<p class="text-label-lg text-tertiary px-1 font-medium">{person}</p>
				{#each items as e (e.id)}
					<div
						class="bg-surface-container text-on-surface rounded-lg border border-tertiary/30 px-3 py-2"
					>
						<p class="text-label-md text-on-surface-variant tabular-nums">
							{formatTime(e.start, false)} – {formatTime(e.end, false)}
						</p>
						<p class="text-body-md font-medium leading-snug">{e.title}</p>
						{#if e.location}
							<p class="text-body-sm text-on-surface-variant flex items-center gap-1 truncate">
								<Icon name="location_on" size={14} />
								<span class="truncate">{e.location}</span>
							</p>
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>
{/if}
