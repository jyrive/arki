<script lang="ts">
	import type { FamilyEvent } from '$lib/types/event';
	import Card from '$lib/components/md3/Card.svelte';
	import Icon from '$lib/components/md3/Icon.svelte';
	import { formatDayHeading } from '$lib/utils/date';

	interface Props {
		messages: FamilyEvent[];
		heading?: string;
	}
	let { messages, heading = 'Viestit' }: Props = $props();

	interface MessageRaw {
		sender?: string;
		subject?: string;
		contentText?: string;
		contentHtml?: string;
		timestamp?: string;
	}

	/** All messages sorted newest first. Show 1 recent + up to 5 older on expand. */
	const sorted = $derived([...messages].sort((a, b) => b.start.localeCompare(a.start)));
	const recent = $derived(sorted.slice(0, 1));
	const older = $derived(sorted.slice(1, 6));

	let expanded = $state(false);

	let openMessage = $state(new Set<string>());
	function toggleMessage(id: string) {
		const next = new Set(openMessage);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		openMessage = next;
	}

	function getRaw(e: FamilyEvent): MessageRaw {
		return (e.raw as MessageRaw) ?? {};
	}

	function excerpt(text: string | undefined, max = 140): string {
		if (!text) return '';
		const clean = text.replace(/\s+/g, ' ').trim();
		return clean.length > max ? clean.slice(0, max).trimEnd() + '…' : clean;
	}

	function formatTime(iso: string): string {
		const m = iso.match(/T(\d{2}:\d{2})/);
		return m ? m[1] : '';
	}

	function firstName(person: string | undefined): string {
		return person?.split(' ')[0] ?? '';
	}
</script>

{#if messages.length > 0}
	<section class="space-y-2">
		<header class="flex items-baseline justify-between px-1">
			<h3 class="text-title-md text-on-surface flex items-center gap-2 font-medium">
				<Icon name="mail" size={20} />
				{heading}
			</h3>
			<span class="text-label-md text-on-surface-variant">{messages.length}</span>
		</header>

		<Card variant="outlined" class="space-y-3 border-secondary/40">
			{#each recent as e (e.id)}
				{@const raw = getRaw(e)}
				{@const day = e.start.slice(0, 10)}
				{@const isOpen = openMessage.has(e.id)}
				<div class="space-y-1">
					<p class="text-label-md text-on-surface-variant uppercase tracking-wide">
						{formatDayHeading(day)} · {formatTime(e.start)}
					</p>
					<p class="text-body-sm text-on-surface flex gap-2">
						<span class="text-secondary shrink-0 font-medium">{firstName(e.person)}</span>
						<span class="font-medium">{raw.subject ?? e.title}</span>
					</p>
					{#if raw.sender}
						<p class="text-label-sm text-on-surface-variant pl-[calc(theme(spacing.2)+1ch)]">{raw.sender}</p>
					{/if}
					{#if raw.contentText}
						<button
							type="button"
							onclick={() => toggleMessage(e.id)}
							class="text-body-sm text-on-surface/80 hover:text-on-surface w-full cursor-pointer text-left whitespace-pre-line"
							aria-expanded={isOpen}
						>
							{isOpen ? raw.contentText : excerpt(raw.contentText)}
						</button>
					{/if}
				</div>
			{/each}

			{#if older.length > 0}
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
						{#each older as e (e.id)}
							{@const raw = getRaw(e)}
							{@const day = e.start.slice(0, 10)}
							{@const isOpen = openMessage.has(e.id)}
							<div class="space-y-1">
								<p class="text-label-md text-on-surface-variant/60 uppercase tracking-wide">
									{formatDayHeading(day)} · {formatTime(e.start)}
								</p>
								<p class="text-body-sm text-on-surface/80 flex gap-2">
									<span class="text-secondary/60 shrink-0 font-medium">{firstName(e.person)}</span>
									<span class="font-medium">{raw.subject ?? e.title}</span>
								</p>
								{#if raw.sender}
									<p class="text-label-sm text-on-surface-variant/60">{raw.sender}</p>
								{/if}
								{#if raw.contentText}
									<button
										type="button"
										onclick={() => toggleMessage(e.id)}
										class="text-body-sm text-on-surface/60 hover:text-on-surface w-full cursor-pointer text-left whitespace-pre-line"
										aria-expanded={isOpen}
									>
										{isOpen ? raw.contentText : excerpt(raw.contentText)}
									</button>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</Card>
	</section>
{/if}
