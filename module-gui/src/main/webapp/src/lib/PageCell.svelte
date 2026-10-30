<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import PageThumb from './PageThumb.svelte';
	import LabelInput from './LabelInput.svelte';

	interface Props {
		index: number;
		child?: number;
	}

	/** A small page of the grid under a block (or without block): thumbnail, optionally with the number of its child block, and its label. */
	let { index, child = 0 }: Props = $props();

	const app = getApp();
	// as large as the column of the grid (--thumb-size of the block row)
	const size = $derived(app.thumbHeight / 2.5);
</script>

<div class="newspaper-thumbnail">
	<div class="page-fit">
		<div class="newspaper-thumbnail__image position-relative" style="min-height: {size}px;">
			<PageThumb {index} {size} text={child ? String(child) : null} bg={child ? app.childColor(child) : null} />
		</div>
		{#if app.settings.enabled}<LabelInput {index} />{/if}
	</div>
</div>
