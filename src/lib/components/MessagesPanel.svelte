<script lang="ts">
	import type { FamilyEvent } from '$lib/types/event';
	import Card from '$lib/components/md3/Card.svelte';
	import Icon from '$lib/components/md3/Icon.svelte';
	import MessageDrawer from '$lib/components/MessageDrawer.svelte';
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

	/** All messages sorted newest first. Show latest per child in recent, up to 5 others on expand. */
	const sorted = $derived([...messages].sort((a, b) => b.start.localeCompare(a.start)));
	const recent = $derived.by(() => {
		const seen = new Set<string>();
		return sorted.filter((e) => {
			const p = e.person ?? '';
			if (seen.has(p)) return false;
			seen.add(p);
			return true;
		});
	});
	const recentIds = $derived(new Set(recent.map((e) => e.id)));
	const older = $derived(sorted.filter((e) => !recentIds.has(e.id)).slice(0, 5));

	let expanded = $state(false);
	let activeMessage = $state<FamilyEvent | null>(null);

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

<MessageDrawer message={activeMessage} onclose={() => (activeMessage = null)} />

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
				<button
					type="button"
					onclick={() => (activeMessage = e)}
					class="hover:bg-surface-container -mx-1 w-[calc(100%+0.5rem)] cursor-pointer rounded-lg px-1 py-1 text-left transition-colors"
				>
					<div class="space-y-1">
						<p class="text-label-md text-on-surface-variant uppercase tracking-wide">
							{formatDayHeading(day)} · {formatTime(e.start)}
						</p>
						<p class="text-body-sm text-on-surface flex gap-2">
							<span class="text-secondary shrink-0 font-medium">{firstName(e.person)}</span>
							<span class="font-medium">{raw.subject ?? e.title}</span>
						</p>
						{#if raw.sender}
							<p class="text-label-sm text-on-surface-variant pl-[calc(--spacing(2)+1ch)]">{raw.sender}</p>
						{/if}
						{#if raw.contentText}
							<p class="text-body-sm text-on-surface/70 line-clamp-2">{excerpt(raw.contentText)}</p>
						{/if}
					</div>
				</button>
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
							<button
								type="button"
								onclick={() => (activeMessage = e)}
								class="hover:bg-surface-container -mx-1 w-[calc(100%+0.5rem)] cursor-pointer rounded-lg px-1 py-1 text-left transition-colors"
							>
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
										<p class="text-body-sm text-on-surface/50 line-clamp-2">{excerpt(raw.contentText)}</p>
									{/if}
								</div>
							</button>
						{/each}
					</div>
				{/if}
			{/if}
		</Card>
	</section>
{/if}

