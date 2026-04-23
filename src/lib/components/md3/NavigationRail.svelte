<script lang="ts">
	import { page } from '$app/stores';
	import Icon from './Icon.svelte';

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
				class={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
					active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
				}`}
			>
				<Icon name={item.icon} size={24} filled={active} />
			</span>
			<span
				class={`text-label-md ${active ? 'text-on-surface' : 'text-on-surface-variant'} font-medium`}
			>
				{item.label}
			</span>
		</a>
	{/each}

	<form method="POST" action="/logout" class="mt-auto flex w-full flex-col items-center">
		<button
			type="submit"
			class="group flex w-full flex-col items-center gap-1"
			title="Sign out"
		>
			<span class="text-on-surface-variant flex h-8 w-14 items-center justify-center rounded-full transition-colors group-hover:bg-error/10 group-hover:text-error">
				<Icon name="logout" size={24} />
			</span>
			<span class="text-label-md text-on-surface-variant font-medium">Sign out</span>
		</button>
	</form>
</nav>
