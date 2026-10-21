<script lang="ts">
	interface Props {
		number: number;
		thumb?: string | null;
	}

	/** The page number of a preview row with the thumbnail of the page in front. */
	let { number, thumb = null }: Props = $props();
</script>

<div class="d-flex align-items-center gap-2">
	{#if thumb}<img src={thumb} alt="" class="preview-thumb" loading="lazy" />{/if}
	<span>{number}</span>
</div>
