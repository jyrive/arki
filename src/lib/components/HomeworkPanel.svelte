<script lang="ts">
	import type { FamilyEvent } from '$lib/types/event';
	import Card from '$lib/components/md3/Card.svelte';
	import Icon from '$lib/components/md3/Icon.svelte';
	import { formatDayHeading } from '$lib/utils/date';

	interface Props {
		homework: FamilyEvent[];
		heading?: string;
	}
	let { homework, heading = 'Läksyt' }: Props = $props();

	let expanded = $state(false);

	/** All items grouped by day (newest first). */
	const byDay = $derived.by(() => {
		const days = new Map<string, FamilyEvent[]>();
		for (const e of homework) {
			const day = e.start.slice(0, 10);
			const list = days.get(day) ?? [];
			list.push(e);
			days.set(day, list);
		}
		return [...days.entries()].sort(([a], [b]) => b.localeCompare(a));
	});

	const recentDays = $derived(byDay.slice(0, 1));
	const olderDays = $derived(byDay.slice(1, 6));

	/** Strip the `Läksy · <subject> · ` prefix for display. */
	function trim(title: string): { subject: string; text: string } {
		const parts = title.split(' · ');
		if (parts.length >= 3) {
			return { subject: parts[1], text: parts.slice(2).join(' · ') };
		}
		return { subject: '', text: title };
	}

	function firstName(person: string | undefined): string {
		return person?.split(' ')[0] ?? '';
	}
</script>

{#if homework.length > 0}
	<section class="space-y-2">
		<header class="flex items-baseline justify-between px-1">
			<h3 class="text-title-md text-on-surface flex items-center gap-2 font-medium">
				<Icon name="menu_book" size={20} />
				{heading}
			</h3>
			<span class="text-label-md text-on-surface-variant">{homework.length}</span>
		</header>

		<Card variant="outlined" class="space-y-3 border-secondary/40">
			{#each recentDays as [day, items] (day)}
				<div class="space-y-1">
					<p class="text-label-md text-on-surface-variant uppercase tracking-wide">
						{formatDayHeading(day)}
					</p>
					{#each items as e (e.id)}
						{@const parsed = trim(e.title)}
						<p class="text-body-sm text-on-surface flex gap-2">
							<span class="text-secondary shrink-0 font-medium">{firstName(e.person)}</span>
							<span>
								{#if parsed.subject}
									<span class="text-on-surface-variant">{parsed.subject}:</span>
								{/if}
								{parsed.text}
							</span>
						</p>
					{/each}
				</div>
			{/each}

			{#if olderDays.length > 0}
				<button
					onclick={() => (expanded = !expanded)}
					aria-label={expanded ? 'Piilota aiemmat' : 'Näytä aiemmat'}
					class="text-secondary/50 hover:text-secondary -mx-1 flex w-full cursor-pointer justify-center py-1 transition-colors"
				>
					<Icon
						name="expand_more"
						size={32}
						class={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
					/>
				</button>

				{#if expanded}
					<div class="border-outline/20 space-y-3 border-t pt-2">
						{#each olderDays as [day, items] (day)}
							<div class="space-y-1">
								<p class="text-label-md text-on-surface-variant/60 uppercase tracking-wide">
									{formatDayHeading(day)}
								</p>
								{#each items as e (e.id)}
									{@const parsed = trim(e.title)}
									<p class="text-body-sm text-on-surface/60 flex gap-2">
										<span class="text-secondary/60 shrink-0 font-medium">{firstName(e.person)}</span>
										<span>
											{#if parsed.subject}
												<span class="text-on-surface-variant/60">{parsed.subject}:</span>
											{/if}
											{parsed.text}
										</span>
									</p>
								{/each}
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</Card>
	</section>
{/if}
