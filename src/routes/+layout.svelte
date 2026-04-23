<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="bg-background text-on-background min-h-full">
	<main class="px-4 pt-2 pb-6">
		{@render children?.()}
	</main>
</div>
