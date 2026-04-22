<script lang="ts">
	import type { FamilyEvent } from '$lib/types/event';
	import Card from '$lib/components/md3/Card.svelte';
	import { formatDayHeading } from '$lib/utils/date';

	interface Props {
		homework: FamilyEvent[];
		heading?: string;
	}
	let { homework, heading = 'Läksyt' }: Props = $props();

	let showOlder = $state(false);

	/** The most recent day that has any homework. */
	const latestDay = $derived.by(() => {
		if (homework.length === 0) return null;
		return homework.reduce((max, e) => {
			const d = e.start.slice(0, 10);
			return d > max ? d : max;
		}, homework[0].start.slice(0, 10));
	});

	/** Up to 5 earlier days, sorted desc, excluding the latest day. */
	const olderDays = $derived.by(() => {
		if (!latestDay) return [] as string[];
		const days = new Set(homework.map((e) => e.start.slice(0, 10)));
		days.delete(latestDay);
		return [...days].sort((a, b) => b.localeCompare(a)).slice(0, 5);
	});

	/** Group homework from the given days by person → date (date desc). */
	function groupByPerson(days: string[]) {
		const daySet = new Set(days);
		const people = new Map<string, Map<string, FamilyEvent[]>>();
		for (const e of homework) {
			const day = e.start.slice(0, 10);
			if (!daySet.has(day)) continue;
			const p = e.person ?? 'Wilma';
			if (!people.has(p)) people.set(p, new Map());
			const d = people.get(p)!;
			const list = d.get(day) ?? [];
			list.push(e);
			d.set(day, list);
		}
		return [...people.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(
				([person, byDay]) =>
					[
						person,
						[...byDay.entries()].sort(([a], [b]) => b.localeCompare(a))
					] as const
			);
	}

	const recentByPerson = $derived(latestDay ? groupByPerson([latestDay]) : []);
	const olderByPerson = $derived(olderDays.length > 0 ? groupByPerson(olderDays) : []);

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

		<!-- Most recent day -->
		<div class="grid gap-3" style="grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr))">
			{#each recentByPerson as [person, days] (person)}
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

		<!-- Toggle for older days -->
		{#if olderDays.length > 0}
			<button
				onclick={() => (showOlder = !showOlder)}
				class="text-label-md text-secondary hover:text-secondary/70 flex cursor-pointer items-center gap-1 px-1 transition-colors"
			>
				<svg
					class="size-4 transition-transform duration-200"
					class:rotate-180={showOlder}
					viewBox="0 0 20 20"
					fill="currentColor"
					aria-hidden="true"
				>
					<path
						fill-rule="evenodd"
						d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
						clip-rule="evenodd"
					/>
				</svg>
				{showOlder ? 'Piilota aiemmat' : 'Näytä aiemmat'}
			</button>

			{#if showOlder}
				<div class="grid gap-3" style="grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr))">
					{#each olderByPerson as [person, days] (person)}
						<Card variant="outlined" class="space-y-3 border-secondary/20">
							<p class="text-label-lg text-secondary/70 font-medium">{person}</p>
							{#each days as [day, items] (day)}
								<div class="space-y-1">
									<p class="text-label-md text-on-surface-variant uppercase tracking-wide">
										{formatDayHeading(day)}
									</p>
									{#each items as e (e.id)}
										{@const parsed = trim(e.title)}
										<p class="text-body-sm text-on-surface/70">
											{#if parsed.subject}
												<span class="text-on-surface-variant/70">{parsed.subject}:</span>
											{/if}
											{parsed.text}
										</p>
									{/each}
								</div>
							{/each}
						</Card>
					{/each}
				</div>
			{/if}
		{/if}
	</section>
{/if}
