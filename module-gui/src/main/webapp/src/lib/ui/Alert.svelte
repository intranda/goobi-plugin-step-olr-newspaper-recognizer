<script lang="ts">
	import type { Snippet } from 'svelte';
		interface Props {
		type?: 'info' | 'danger' | 'warning';
		class?: string;
		children: Snippet;
		[attribute: string]: any;
	}

	/** A Bootstrap alert in the padded strip the plugin uses for its notices. */
	let { type = 'info', class: className = '', children, ...rest }: Props = $props();
</script>

<div class="p-3" {...rest}>
	<div class={['alert', `alert-${type}`, className]}>{@render children()}</div>
</div>
