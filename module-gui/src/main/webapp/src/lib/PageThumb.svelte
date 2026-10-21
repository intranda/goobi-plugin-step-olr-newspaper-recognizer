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
	const image = $derived(app.pages[index].image);
</script>

<!-- the thumbnail has no keyboard equivalent: the block fields next to it offer the same changes -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions, a11y_missing_attribute -->
<a onclick={e => app.onPageClick(e, index)}>
	<Thumbcanvas width={size} height={size} small={image.thumbnailUrl} large={image.largeThumbnailUrl} title={image.tooltip}
		{preloadLarge} {text} {bg} />
</a>
{#if app.showDeletePageButton}
	<button type="button" class="btn btn-image position-absolute top-0" aria-label={app.t('loeschen')} onclick={() => app.askDeletePage(index)}>
		<Icon name="trash" />
	</button>
{/if}
