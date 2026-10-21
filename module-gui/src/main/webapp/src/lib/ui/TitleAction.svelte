<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		icon: string;
		disabled?: boolean;
		[attribute: string]: any;
	}

	/** An icon button in the title bar of a Goobi box. */
	let { icon, disabled = false, ...rest }: Props = $props();
</script>

<a class={['btn d-flex align-items-center btn--title-action', disabled && 'disabled']} {...rest}>
	<Icon name={icon} />
</a>
