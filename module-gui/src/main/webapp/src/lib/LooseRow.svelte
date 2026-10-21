<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import PageCell from './PageCell.svelte';
	import type { Row } from '../types';

	interface Props {
		row: Extract<Row, { loose: true }>;
	}

	/** A run of pages without block: a heading and the small thumbnails of the pages. */
	let { row }: Props = $props();

	const app = getApp();
	const last = $derived(row.pages[row.pages.length - 1]);
</script>

<div class="thumbnail-image px-3 pb-3"></div>
<div class="issue-controls d-flex flex-column gap-2 px-3 pb-3">
	<strong>{app.t('plugin_newspaperRecognizer_pagesWithoutStructure')}</strong>
	<span class="small text-muted">{app.pagesSummary(row.pages[0] + 1, last + 1)}</span>
</div>
<div class="thumbnails px-3 pb-3" style="--thumb-size: {app.thumbHeight / 2.5}px;">
	{#each row.pages as index (app.pages[index].filename)}
		<PageCell {index} />
	{/each}
	<div data-typing-hint class="newspaper-hint" aria-live="polite">{app.hintFor(row)}</div>
</div>
