<script lang="ts">
	import type { FamilyEvent } from '$lib/types/event';
	import { formatTime } from '$lib/utils/date';
	import Card from '$lib/components/md3/Card.svelte';
	import Icon from '$lib/components/md3/Icon.svelte';

	interface Props {
		event: FamilyEvent;
	}
	let { event }: Props = $props();

	const sourceColor: Record<FamilyEvent['source'], string> = {
		google: 'bg-primary',
		wilma: 'bg-tertiary',
		myclub: 'bg-secondary'
	};
</script>

<Card variant="filled" class="flex gap-3">
	<div class={`w-1 shrink-0 rounded-full ${sourceColor[event.source]}`}></div>
	<div class="min-w-0 flex-1">
		<div class="flex items-baseline justify-between gap-3">
			<h3 class="text-title-md text-on-surface truncate font-medium">{event.title}</h3>
			<span class="text-label-md text-on-surface-variant shrink-0 tabular-nums">
				{formatTime(event.start, event.allDay)}
				{#if !event.allDay}
					– {formatTime(event.end, false)}
				{/if}
			</span>
		</div>
		{#if event.location}
			<p class="text-body-sm text-on-surface-variant flex items-center gap-1 truncate">
				<Icon name="location_on" size={16} />
				<span class="truncate">{event.location}</span>
			</p>
		{/if}
	</div>
</Card>
