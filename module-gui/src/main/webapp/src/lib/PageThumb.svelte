<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import Thumbcanvas from './Thumbcanvas.svelte';
	import Icon from './ui/Icon.svelte';

	interface Props {
		index: number;
		size: number;
		preloadLarge?: boolean;
		text?: string | null;
		bg?: string | null;
	}

	/**
	 * The thumbnail of a page: a click toggles its block (see Recognizer.onPageClick), the button deletes the image.
	 * The wrapper around it, which reserves the height, is up to the caller.
	 */
	let { index, size, preloadLarge = false, text = null, bg = null }: Props = $props();

	const app = getApp();
	const { fmt } = app;
	const image = $derived(app.pages[index].image);
</script>

<!-- a button, so that the block structure can be changed with the keyboard too; Alt or Ctrl with Enter or Space makes a child block, as with the mouse -->
<button type="button" class="btn btn-blank d-block p-0 border-0 page-thumb" aria-label={fmt('plugin_newspaperRecognizer_page_toggle', index + 1)}
	onclick={e => app.onPageClick(e, index)}>
	<Thumbcanvas width={size} height={size} small={image.thumbnailUrl} large={image.largeThumbnailUrl} title={image.tooltip}
		{preloadLarge} {text} {bg} />
</button>
{#if app.showDeletePageButton}
	<button type="button" class="btn btn-image position-absolute top-0" aria-label={app.t('loeschen')} onclick={() => app.askDeletePage(index)}>
		<Icon name="trash" />
	</button>
{/if}
