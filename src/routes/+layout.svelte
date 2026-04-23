<script lang="ts">
	import '../app.css';
	import NavigationBar from '$lib/components/md3/NavigationBar.svelte';
	import NavigationRail from '$lib/components/md3/NavigationRail.svelte';
	import AppBar from '$lib/components/md3/AppBar.svelte';

	const navItems = [
		{ href: '/', label: 'Today', icon: 'today' },
		{ href: '/school', label: 'School', icon: 'school' },
		{ href: '/week', label: 'Week', icon: 'calendar_month' }
	];

	let { children } = $props();
</script>

<div class="bg-background text-on-background flex min-h-full">
	<NavigationRail items={navItems} />
	<div class="flex min-h-full flex-1 flex-col">
		<AppBar>
			{#snippet title()}Arki{/snippet}
		</AppBar>
		<main class="flex-1 px-4 pt-2 pb-28 md:pb-6">
			{@render children?.()}
		</main>
	</div>
	<NavigationBar items={navItems} />
</div>
