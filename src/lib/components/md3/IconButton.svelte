<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'standard' | 'filled' | 'tonal' | 'outlined';
		label: string;
		children?: Snippet;
	}

	let { variant = 'standard', label, class: klass = '', children, ...rest }: Props = $props();

	const base =
		'inline-flex items-center justify-center w-10 h-10 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-40 disabled:pointer-events-none';
	const variants: Record<NonNullable<Props['variant']>, string> = {
		standard: 'text-on-surface-variant hover:bg-on-surface/8',
		filled: 'bg-primary text-on-primary hover:opacity-90',
		tonal: 'bg-secondary-container text-on-secondary-container hover:opacity-90',
		outlined: 'border border-outline text-on-surface-variant hover:bg-on-surface/8'
	};
</script>

<button class={`${base} ${variants[variant]} ${klass}`} aria-label={label} {...rest}>
	{@render children?.()}
</button>
