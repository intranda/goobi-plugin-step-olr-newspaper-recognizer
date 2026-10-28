<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';

	interface Props extends Omit<HTMLButtonAttributes, 'children' | 'class'> {
		icon: string;
		class?: string;
		disabled?: boolean;
		dot?: boolean;
		/** the button element, for a caller that has to move the focus to it */
		element?: HTMLButtonElement | null;
	}

	/** An icon button in the title bar of a Goobi box; `dot` shows a small dot that marks the button (here: unsaved changes) — it is hidden from
	    assistive technology, so the caller names the state in the button's aria-label. */
	let { icon, disabled = false, dot = false, element = $bindable(null), class: className = '', ...rest }: Props = $props();
</script>

<button bind:this={element} type="button" class={['btn d-flex align-items-center btn--title-action me-0', className]} {disabled} {...rest}>
	<Icon name={icon} />
	{#if dot}<span data-unsaved-dot class="unsaved-dot" aria-hidden="true"></span>{/if}
</button>
