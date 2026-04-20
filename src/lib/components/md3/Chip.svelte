<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		selected?: boolean;
		variant?: 'assist' | 'filter' | 'suggestion';
		children?: Snippet;
	}

	let {
		selected = false,
		variant = 'filter',
		class: klass = '',
		children,
		...rest
	}: Props = $props();

	const base =
		'inline-flex items-center gap-2 h-8 px-3 rounded-sm border text-label-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2';
	const unselected = 'border-outline text-on-surface-variant hover:bg-on-surface/8';
	const selectedCls = 'border-transparent bg-secondary-container text-on-secondary-container';
</script>

<button
	class={`${base} ${selected ? selectedCls : unselected} ${klass}`}
	role={variant === 'filter' ? 'switch' : undefined}
	aria-pressed={variant === 'filter' ? selected : undefined}
	{...rest}
>
	{@render children?.()}
</button>
