<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import Icon from './ui/Icon.svelte';
	import HiddenPopover from './HiddenPopover.svelte';
	import type { BlockNode } from '../types';

	interface Props {
		node: BlockNode;
		main?: boolean;
	}

	/**
	 * The foot of a block: its page range (only for a block of level 0, `main`) and the additional data it keeps with the popover
	 * to look at or remove it.
	 */
	let { node, main = false }: Props = $props();

	const app = getApp();
	const { fmt } = app;

	const start = $derived(node.start);
	const elementId = $derived(app.blockElementId(node));
	const structures = $derived(start.hidden?.structures ?? []);
	const metadata = $derived(start.hidden?.metadata ?? []);
	const hiddenCount = $derived(structures.length + metadata.length);
	const hiddenOpen = $derived(app.openHidden === elementId);
	const pageFirst = $derived(main ? node.first + 1 : 0);
	const pageLast = $derived(node.last + 1);

	const hiddenText = $derived([
		structures.length > 0 && fmt('plugin_newspaperRecognizer_hidden_structureCount', structures.length),
		metadata.length > 0 && fmt('plugin_newspaperRecognizer_hidden_metadataCount', metadata.length),
	].filter(Boolean).join(', '));
</script>

{#if pageFirst || hiddenCount > 0}
	<div class="d-flex justify-content-between align-items-center gap-3 small border-top pt-2 position-relative">
		<span class="text-muted">{pageFirst ? app.pagesSummary(pageFirst, pageLast) : ''}</span>
		{#if hiddenCount > 0}
			<button type="button" class="btn btn-link btn-sm p-0 d-flex align-items-center gap-1 text-decoration-none"
				onclick={() => app.toggleHidden(elementId)} aria-expanded={hiddenOpen ? 'true' : 'false'}>
				<Icon name="info-circle" />
				<span>{hiddenText}</span>
			</button>
		{/if}
		{#if hiddenOpen}
			<HiddenPopover summary={start.hidden} onclose={() => app.toggleHidden(elementId)} onremove={() => app.askRemoveHidden(node)} />
		{/if}
	</div>
{/if}
