<script lang="ts">
	import type { FamilyEvent } from '$lib/types/event';
	import Card from '$lib/components/md3/Card.svelte';
	import { formatDayHeading } from '$lib/utils/date';

	interface Props {
		homework: FamilyEvent[];
		heading?: string;
	}
	let { homework, heading = 'Läksyt' }: Props = $props();

	let expanded = $state(new Set<string>());

	/** Group by person → { recent: latest day, older: up to 5 earlier days } */
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
		return [...people.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([person, byDay]) => {
				const days = [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a));
				return { person, recent: days.slice(0, 1), older: days.slice(1, 6) };
			});
	});

	function toggle(person: string) {
		const next = new Set(expanded);
		if (next.has(person)) next.delete(person);
		else next.add(person);
		expanded = next;
	}

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
		<div class="grid items-start gap-3" style="grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr))">
			{#each byPerson as { person, recent, older } (person)}
				<Card variant="outlined" class="space-y-3 border-secondary/40">
					<p class="text-label-lg text-secondary font-medium">{person}</p>

					{#each recent as [day, items] (day)}
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

					{#if older.length > 0}
						<button
							onclick={() => toggle(person)}
							aria-label={expanded.has(person) ? 'Piilota aiemmat' : 'Näytä aiemmat'}
							class="text-secondary/50 hover:text-secondary -mx-1 flex w-full cursor-pointer justify-center py-1 transition-colors"
						>
							<svg
								class="size-8 transition-transform duration-200"
								class:rotate-180={expanded.has(person)}
								viewBox="0 0 24 24"
								fill="currentColor"
								aria-hidden="true"
							>
								<path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
							</svg>
						</button>

						{#if expanded.has(person)}
							<div class="border-outline/20 space-y-3 border-t pt-2">
								{#each older as [day, items] (day)}
									<div class="space-y-1">
										<p class="text-label-md text-on-surface-variant/60 uppercase tracking-wide">
											{formatDayHeading(day)}
										</p>
										{#each items as e (e.id)}
											{@const parsed = trim(e.title)}
											<p class="text-body-sm text-on-surface/60">
												{#if parsed.subject}
													<span class="text-on-surface-variant/60">{parsed.subject}:</span>
												{/if}
												{parsed.text}
											</p>
										{/each}
									</div>
								{/each}
							</div>
						{/if}
					{/if}
				</Card>
			{/each}
		</div>
	</section>
{/if}
