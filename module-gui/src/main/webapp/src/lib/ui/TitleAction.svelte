<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';

	interface Props extends Omit<HTMLButtonAttributes, 'children' | 'class'> {
		icon: string;
		class?: string;
		disabled?: boolean;
	}

	/** An icon button in the title bar of a Goobi box. */
	let { icon, disabled = false, class: className = '', ...rest }: Props = $props();
</script>

<button type="button" class={['btn d-flex align-items-center btn--title-action', className]} {disabled} {...rest}>
	<Icon name={icon} />
</button>
