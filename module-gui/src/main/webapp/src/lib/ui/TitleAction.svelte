<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';

	interface Props extends Omit<HTMLButtonAttributes, 'children' | 'class'> {
		icon: string;
		class?: string;
		disabled?: boolean;
		dot?: string | null;
	}

	/** An icon button in the title bar of a Goobi box; `dot` is the accessible text of a small dot that marks the button (here: unsaved changes). */
	let { icon, disabled = false, dot = null, class: className = '', ...rest }: Props = $props();
</script>

<button type="button" class={['btn d-flex align-items-center btn--title-action', className]} {disabled} {...rest}>
	<Icon name={icon} />
	{#if dot}<span data-unsaved-dot class="unsaved-dot" role="img" aria-label={dot}></span>{/if}
</button>
