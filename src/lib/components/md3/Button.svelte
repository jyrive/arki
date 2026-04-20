<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: 'filled' | 'tonal' | 'outlined' | 'text' | 'elevated';
		children?: Snippet;
	}

	let { variant = 'filled', class: klass = '', children, ...rest }: Props = $props();

	const base =
		'inline-flex items-center justify-center gap-2 h-10 px-6 rounded-full text-label-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:opacity-40 disabled:pointer-events-none';
	const variants: Record<NonNullable<Props['variant']>, string> = {
		filled: 'bg-primary text-on-primary hover:opacity-90',
		tonal: 'bg-secondary-container text-on-secondary-container hover:opacity-90',
		outlined: 'border border-outline text-primary hover:bg-primary/8',
		text: 'text-primary hover:bg-primary/8 px-3',
		elevated: 'bg-surface-container-low text-primary shadow-sm hover:shadow-md'
	};
</script>

<button class={`${base} ${variants[variant]} ${klass}`} {...rest}>
	{@render children?.()}
</button>
