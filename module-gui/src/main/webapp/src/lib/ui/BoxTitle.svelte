<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	interface Props {
		title: string;
		icon: string;
		children?: Snippet;
	}

	/** The title bar of a Goobi box: icon and title on the left, the actions (children) on the right. */
	let { title, icon, children }: Props = $props();
</script>

<div class="box__title">
	<h2>
		<Icon name={icon} />
		{title}
	</h2>
	{#if children}<div class="actions d-flex align-items-center gap-2">{@render children()}</div>{/if}
</div>
