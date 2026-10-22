<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	// the other attributes go to the outer div
	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> {
		type?: 'info' | 'danger' | 'warning';
		class?: string;
		children: Snippet;
	}

	/** A Bootstrap alert in the padded strip the plugin uses for its notices. */
	let { type = 'info', class: className = '', children, ...rest }: Props = $props();
</script>

<div class="p-3" {...rest}>
	<div class={['alert', `alert-${type}`, className]}>{@render children()}</div>
</div>
