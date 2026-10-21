<script lang="ts">
	import type { Snippet } from 'svelte';
	import Button from './Button.svelte';

	interface Props {
		text: string;
		button: string;
		onclick: () => void;
		children?: Snippet;
	}

	/** A line of an alert: a text, a button with an action next to it and optionally a popover (children) below the button. */
	let { text, button, onclick, children }: Props = $props();
</script>

<li class="d-flex align-items-center gap-3 position-relative">
	<span>{text}</span>
	<Button size="sm" class="text-nowrap" {onclick}>{button}</Button>
	{@render children?.()}
</li>
