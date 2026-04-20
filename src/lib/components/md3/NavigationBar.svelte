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
	class="bg-surface-container border-outline-variant fixed inset-x-0 bottom-0 z-30 flex h-20 items-stretch justify-around border-t pb-[env(safe-area-inset-bottom)] md:hidden"
	aria-label="Primary"
>
	{#each items as item (item.href)}
		{@const active = $page.url.pathname === item.href}
		<a
			href={item.href}
			class="group flex flex-1 flex-col items-center justify-center gap-1 pt-3 pb-2"
			aria-current={active ? 'page' : undefined}
		>
			<span
				class={`flex h-8 w-16 items-center justify-center rounded-full text-xl transition-colors ${
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
