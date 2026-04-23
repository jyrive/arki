<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLSpanElement> {
		/** Material Symbols icon name, e.g. `menu_book`, `expand_more`. */
		name: string;
		/** Optical size in pixels (also used as font-size). */
		size?: number;
		filled?: boolean;
	}

	let {
		name,
		size = 24,
		filled = false,
		class: klass = '',
		style = '',
		...rest
	}: Props = $props();

	const fontStyle = $derived(
		`font-size: ${size}px; font-variation-settings: 'FILL' ${filled ? 1 : 0}, 'opsz' ${size};`
	);
</script>

<span
	aria-hidden="true"
	class={`material-symbols-rounded inline-block leading-none select-none ${klass}`}
	style={`${fontStyle}${style ? ';' + style : ''}`}
	{...rest}
>
	{name}
</span>

<style>
	.material-symbols-rounded {
		font-family: 'Material Symbols Rounded';
		font-weight: normal;
		font-style: normal;
		letter-spacing: normal;
		text-transform: none;
		white-space: nowrap;
		word-wrap: normal;
		direction: ltr;
		-webkit-font-feature-settings: 'liga';
		font-feature-settings: 'liga';
		-webkit-font-smoothing: antialiased;
	}
</style>
