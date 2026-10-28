<script lang="ts">
	import { ICONS } from './icons';

	interface Props {
		name: string;
		class?: string;
	}

	/** A Tabler icon (outline) by name, inline; `class` adds spacing like `me-2`. */
	let { name, class: className = '' }: Props = $props();
</script>

<span aria-hidden="true" class={['icon-wrapper', className]}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">{@html ICONS[name] ?? ''}</svg></span>
