<script lang="ts">
	interface Props {
		name: string;
		class?: string;
	}

	/** A Goobi icon (Tabler set) by name; `class` adds spacing like `me-2`. */
	let { name, class: className = '' }: Props = $props();
</script>

<span aria-hidden="true" class={['icon-wrapper', className]}><svg><use href={GoobiIcons.iconHref(name)} /></svg></span>
