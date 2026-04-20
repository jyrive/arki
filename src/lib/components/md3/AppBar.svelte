<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title?: Snippet;
		actions?: Snippet;
		leading?: Snippet;
	}

	let { title, actions, leading }: Props = $props();
</script>

<header
	class="bg-surface text-on-surface sticky top-0 z-30 flex h-16 items-center gap-2 px-4 backdrop-blur"
>
	{#if leading}
		<div class="flex items-center">{@render leading()}</div>
	{/if}
	<h1 class="text-title-lg flex-1 truncate font-medium">
		{#if title}{@render title()}{/if}
	</h1>
	{#if actions}
		<div class="flex items-center gap-1">{@render actions()}</div>
	{/if}
</header>
