<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import type { FamilyEvent } from '$lib/types/event';
	import Icon from '$lib/components/md3/Icon.svelte';
	import { formatDayHeading } from '$lib/utils/date';

	interface MessageRaw {
		sender?: string;
		subject?: string;
		contentText?: string;
		contentHtml?: string;
	}

	interface Props {
		message: FamilyEvent | null;
		onclose: () => void;
	}

	let { message, onclose }: Props = $props();

	function raw(): MessageRaw {
		return (message?.raw as MessageRaw) ?? {};
	}

	function formatTime(iso: string): string {
		const m = iso.match(/T(\d{2}:\d{2})/);
		return m ? m[1] : '';
	}

	function onbackdropclick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={onkeydown} />

{#if message}
	<!-- Backdrop -->
	<div
		transition:fade={{ duration: 180 }}
		class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
		role="presentation"
		onclick={onbackdropclick}
	></div>

	<!-- Bottom sheet on mobile · modal on md+ -->
	<div
		transition:fly={{ y: 40, duration: 250 }}
		class="bg-surface text-on-surface fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl p-6 shadow-xl
		       md:inset-auto md:top-1/2 md:left-1/2 md:bottom-auto md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
		role="dialog"
		aria-modal="true"
	>
		<!-- Drag handle (mobile only) -->
		<div class="bg-outline-variant mx-auto mb-5 h-1 w-10 rounded-full md:hidden"></div>

		<!-- Header -->
		<div class="mb-4 flex items-start justify-between gap-4">
			<div class="min-w-0">
				<p class="text-label-md text-on-surface-variant mb-1">
					{formatDayHeading(message.start.slice(0, 10))}
					{#if formatTime(message.start)} · {formatTime(message.start)}{/if}
					{#if message.person} · <span class="text-secondary font-medium">{message.person.split(' ')[0]}</span>{/if}
				</p>
				<h2 class="text-title-md text-on-surface font-medium">{raw().subject ?? message.title}</h2>
				{#if raw().sender}
					<p class="text-body-sm text-on-surface-variant mt-0.5">{raw().sender}</p>
				{/if}
			</div>
			<button
				type="button"
				onclick={onclose}
				class="text-on-surface-variant hover:text-on-surface hover:bg-surface-container shrink-0 rounded-full p-1 transition-colors"
				aria-label="Close"
			>
				<Icon name="close" size={20} />
			</button>
		</div>

		<!-- Body -->
		{#if raw().contentText}
			<div class="text-body-md text-on-surface whitespace-pre-line leading-relaxed">
				{raw().contentText}
			</div>
		{:else}
			<p class="text-body-md text-on-surface-variant italic">No message content.</p>
		{/if}
	</div>
{/if}
