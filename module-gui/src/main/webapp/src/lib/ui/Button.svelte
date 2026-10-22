<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';

	interface Props extends Omit<HTMLButtonAttributes, 'class' | 'children'> {
		variant?: string;
		size?: string;
		icon?: string | null;
		class?: string;
		children?: Snippet;
	}

	/** A button with an optional icon in front of its text (or content). `variant` is the Bootstrap/Goobi suffix: blank, primary, success, danger, hot … */
	let { variant = 'blank', size = '', icon = null, class: className = '', children, ...rest }: Props = $props();
</script>

<button type="button" class={['btn', `btn-${variant}`, size && `btn-${size}`, icon && 'd-inline-flex align-items-center gap-1', className]} {...rest}>
	{#if icon}<Icon name={icon} />{/if}
	{#if icon}<span>{@render children?.()}</span>{:else}{@render children?.()}{/if}
</button>
