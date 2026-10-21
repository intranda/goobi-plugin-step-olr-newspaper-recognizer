<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	interface Props {
		pressed: boolean;
		class?: string;
		children?: Snippet;
		[attribute: string]: any;
	}

	/** A pressable option in the look of Goobi's table filter options, with a check box icon. */
	let { pressed, class: className = '', children, ...rest }: Props = $props();
</script>

<button type="button" class={['btn gw-table__filters__option newspaper-toggle', className]} aria-pressed={pressed ? 'true' : 'false'} {...rest}>
	<Icon name={pressed ? 'checkbox' : 'square'} />
	{@render children?.()}
</button>
