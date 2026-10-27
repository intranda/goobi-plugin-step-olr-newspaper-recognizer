<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'children'> {
		icon: string;
		/** the text colour of the group the entry belongs to, e.g. text-danger */
		tone: string;
		children: Snippet;
		/** the buttons below the text */
		actions?: Snippet;
	}

	/** An entry of the notices section: an icon in the colour of its group, the text and its buttons below the text. */
	let { icon, tone, children, actions, ...rest }: Props = $props();
</script>

<div class="notices-entry d-flex align-items-start gap-2" {...rest}>
	<Icon name={icon} class={tone} />
	<div class="d-flex flex-column gap-1 position-relative">
		<div>{@render children()}</div>
		{#if actions}<div class="d-flex flex-wrap align-items-center gap-2">{@render actions()}</div>{/if}
	</div>
</div>
