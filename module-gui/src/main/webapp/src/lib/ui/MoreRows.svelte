<script lang="ts">
	import { getApp } from '../recognizer.svelte';

	interface Props {
		count: number;
		class?: string;
	}

	/** "… and n more", below a preview limited to its first rows. */
	let { count, class: className = 'mb-0 text-muted' }: Props = $props();

	const { fmt } = getApp();
</script>

{#if count > 0}
	<p class={className}>{fmt('plugin_newspaperRecognizer_preview_more', count)}</p>
{/if}
