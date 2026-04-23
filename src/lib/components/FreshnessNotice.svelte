<script lang="ts">
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
	<p class="text-label-sm text-tertiary">
		⚠️ Tiedot voivat olla vanhoja — viimeisin päivitys {label}
	</p>
{:else if label}
	<p class="text-label-sm text-on-surface-variant/70">Päivitetty {label}</p>
{/if}
