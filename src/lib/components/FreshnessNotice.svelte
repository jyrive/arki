<script lang="ts">
	import Card from '$lib/components/md3/Card.svelte';

	interface Props {
		stalestSuccess?: string | null;
		fromDb?: boolean;
	}
	let { stalestSuccess, fromDb }: Props = $props();

	// Minutes since the stalest successful refresh. `undefined` when live-mode.
	const minutesAgo = $derived.by(() => {
		if (!fromDb || !stalestSuccess) return null;
		const diff = Date.now() - Date.parse(stalestSuccess);
		return Math.round(diff / 60000);
	});

	const isStale = $derived(minutesAgo !== null && minutesAgo > 60);

	const label = $derived.by(() => {
		if (minutesAgo === null) return null;
		if (minutesAgo < 1) return 'juuri nyt';
		if (minutesAgo < 60) return `${minutesAgo} min sitten`;
		const hours = Math.round(minutesAgo / 60);
		return `${hours} h sitten`;
	});
</script>

{#if isStale}
	<Card variant="outlined" class="border-tertiary/40">
		<p class="text-label-lg text-on-surface font-medium">Tiedot voivat olla vanhoja</p>
		<p class="text-body-sm text-on-surface-variant">Viimeisin onnistunut päivitys {label}.</p>
	</Card>
{/if}

{#if label}
	<p class="text-label-sm text-on-surface-variant px-1 text-right">Päivitetty {label}</p>
{/if}
