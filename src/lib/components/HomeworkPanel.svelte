<script lang="ts">
	import type { FamilyEvent } from '$lib/types/event';
	import Card from '$lib/components/md3/Card.svelte';
	import { formatDayHeading } from '$lib/utils/date';

	interface Props {
		homework: FamilyEvent[];
		heading?: string;
	}
	let { homework, heading = 'Läksyt' }: Props = $props();

	/** Group by person → date (most recent first) */
	const byPerson = $derived.by(() => {
		const people = new Map<string, Map<string, FamilyEvent[]>>();
		for (const e of homework) {
			const p = e.person ?? 'Wilma';
			const day = e.start.slice(0, 10);
			if (!people.has(p)) people.set(p, new Map());
			const d = people.get(p)!;
			const list = d.get(day) ?? [];
			list.push(e);
			d.set(day, list);
		}
		// Convert to ordered arrays (date desc)
		return [...people.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(
				([person, days]) =>
					[
						person,
						[...days.entries()].sort(([a], [b]) => b.localeCompare(a))
					] as const
			);
	});

	/** Strip the `Läksy · <subject> · ` prefix for display. */
	function trim(title: string): { subject: string; text: string } {
		const parts = title.split(' · ');
		if (parts.length >= 3) {
			return { subject: parts[1], text: parts.slice(2).join(' · ') };
		}
		return { subject: '', text: title };
	}
</script>

{#if homework.length > 0}
	<section class="space-y-2">
		<header class="flex items-baseline justify-between px-1">
			<h3 class="text-title-md text-on-surface font-medium">📘 {heading}</h3>
			<span class="text-label-md text-on-surface-variant">{homework.length}</span>
		</header>
		<div
			class="grid gap-3"
			style:grid-template-columns={`repeat(${byPerson.length}, minmax(0, 1fr))`}
		>
			{#each byPerson as [person, days] (person)}
				<Card variant="outlined" class="space-y-3 border-secondary/40">
					<p class="text-label-lg text-secondary font-medium">{person}</p>
					{#each days as [day, items] (day)}
						<div class="space-y-1">
							<p class="text-label-md text-on-surface-variant uppercase tracking-wide">
								{formatDayHeading(day)}
							</p>
							{#each items as e (e.id)}
								{@const parsed = trim(e.title)}
								<p class="text-body-sm text-on-surface">
									{#if parsed.subject}
										<span class="text-on-surface-variant">{parsed.subject}:</span>
									{/if}
									{parsed.text}
								</p>
							{/each}
						</div>
					{/each}
				</Card>
			{/each}
		</div>
	</section>
{/if}
