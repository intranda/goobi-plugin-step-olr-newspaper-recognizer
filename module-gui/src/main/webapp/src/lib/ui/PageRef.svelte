<script lang="ts">
	interface Props {
		number: number;
		thumb?: string | null;
	}

	/**
	 * The page number of a preview row with the thumbnail of the page in front. Like the thumbnails of the main view it shows the
	 * placeholder image until the thumbnail is loaded, and stays with it if there is none or it does not load.
	 */
	let { number, thumb = null }: Props = $props();

	// the thumbnail that has loaded; a new one starts with the placeholder again
	let loadedUrl: string | null = $state(null);
	const loaded = $derived(!!thumb && loadedUrl === thumb);
</script>

<div class="d-flex align-items-center gap-2">
	<span class="preview-thumb">
		{#if !loaded}<img src="newspaper_placeholder2.png" alt="" />{/if}
		{#key thumb}
			{#if thumb}<img src={thumb} alt="" loading="lazy" class:invisible={!loaded} onload={() => (loadedUrl = thumb)} onerror={() => (loadedUrl = null)} />{/if}
		{/key}
	</span>
	<span>{number}</span>
</div>
