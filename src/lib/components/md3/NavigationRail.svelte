<script lang="ts">
	import { page } from '$app/stores';

	interface Item {
		href: string;
		label: string;
		icon: string;
	}

	interface Props {
		items: Item[];
	}

	let { items }: Props = $props();
</script>

<nav
	class="bg-surface text-on-surface hidden h-full w-20 shrink-0 flex-col items-center gap-3 py-6 md:flex"
	aria-label="Primary"
>
	{#each items as item (item.href)}
		{@const active = $page.url.pathname === item.href}
		<a
			href={item.href}
			class="group flex w-full flex-col items-center gap-1"
			aria-current={active ? 'page' : undefined}
		>
			<span
				class={`flex h-8 w-14 items-center justify-center rounded-full text-xl transition-colors ${
					active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
				}`}
			>
				{item.icon}
			</span>
			<span
				class={`text-label-md ${active ? 'text-on-surface' : 'text-on-surface-variant'} font-medium`}
			>
				{item.label}
			</span>
		</a>
	{/each}
</nav>
