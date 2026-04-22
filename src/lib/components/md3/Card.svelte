<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface Props extends HTMLAttributes<HTMLDivElement> {
		variant?: 'elevated' | 'filled' | 'outlined';
		children?: Snippet;
	}

	let { variant = 'filled', class: klass = '', children, ...rest }: Props = $props();

	const base = 'rounded-md p-4 transition-shadow';
	const variants: Record<NonNullable<Props['variant']>, string> = {
		elevated: 'bg-surface-container-low text-on-surface shadow-sm hover:shadow',
		filled: 'bg-surface-container-highest text-on-surface',
		outlined: 'bg-surface text-on-surface border border-outline-variant'
	};
</script>

<div class={`${base} ${variants[variant]} ${klass}`} {...rest}>
	{@render children?.()}
</div>
