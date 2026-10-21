<svelte:options customElement={{ tag: 'goobi-plugin-step-newspaper-recognizer', shadow: 'none' }} />

<script lang="ts">
	import type { PluginProps } from './types';
	import Plugin from './Plugin.svelte';

	interface Props {
		config?: PluginProps;
	}

	/**
	 * <goobi-plugin-step-newspaper-recognizer>: the plugin as a custom element, see the plugin frontend contract.
	 *
	 * No shadow root: the plugin builds on the global styles of Goobi (Bootstrap, Goobi's own classes) and on the document
	 * (ids of the blocks, listeners that close popovers). The page sets `element.config` (PluginProps); the plugin
	 * is built as soon as it is there, which may be after the element was inserted.
	 */
	let { config }: Props = $props();
</script>

{#if config}<Plugin {config} />{/if}
