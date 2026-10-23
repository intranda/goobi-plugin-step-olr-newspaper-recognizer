<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import PageThumb from './PageThumb.svelte';
	import PageCell from './PageCell.svelte';
	import LabelInput from './LabelInput.svelte';
	import BlockFields from './BlockFields.svelte';
	import BlockFooter from './BlockFooter.svelte';
	import Button from './ui/Button.svelte';
	import Icon from './ui/Icon.svelte';
	import type { Row } from '../types';

	interface Props {
		row: Extract<Row, { loose: false }>;
	}

	/**
	 * A level-0 block as three cells of the grid: its first page with the label, its fields (and those of its child blocks, then its page range) and the thumbnails
	 * of its other pages with the hints for typing and for the pagination rules.
	 */
	let { row }: Props = $props();

	const app = getApp();
	const { t, fmt } = app;
	const node = $derived(row.node);
	const offer = $derived(app.offerFor(row));
</script>

<div class="thumbnail-image px-3 pb-3" id={app.blockElementId(node)}>
	<div class="goobi-thumbnail font-light">
		<div class="goobi-thumbnail-image">
			<div class="thumb position-relative" style="min-height: {app.thumbHeight}px;">
				<PageThumb index={node.first} size={app.thumbHeight} preloadLarge />
			</div>
		</div>
	</div>
	{#if app.settings.enabled}<LabelInput index={node.first} />{/if}
</div>

<div class="issue-controls d-flex flex-column gap-3 px-3 pb-3" style="min-height: {app.thumbHeight}px;" role="group"
	aria-label={fmt('plugin_newspaperRecognizer_block_group', node.first + 1)}>
	<BlockFields {node} main typeOptions={app.typeOptions(app.volumeType)} />

	{#if node.children.length > 0}
		<div class="block-tree">
			{#each node.children as child, childIndex (child.first)}
				<div class="block-tree__item d-flex flex-column gap-2" id={app.blockElementId(child)} role="group"
					aria-label={fmt('plugin_newspaperRecognizer_block_childGroup', child.first + 1)}>
					<BlockFields node={child} typeOptions={app.typeOptions(node.start.type)} color={app.childColor(childIndex + 1)} />
					<BlockFooter node={child} />
				</div>
			{/each}
		</div>
	{/if}

	<BlockFooter {node} main />

	{#if app.settings.enabled}
		<div class="newspaper-foot">
			<Button data-block-pagination={node.first} icon="list-numbers" onclick={() => app.openRulesDialog(node.first)}>
				{t('plugin_newspaperRecognizer_pagination_rules_title')}
			</Button>
		</div>
	{/if}
	{#if offer}
		<div data-offer class="alert alert-info newspaper-alert d-flex flex-wrap align-items-center gap-2 mb-0">
			<Icon name="list-numbers" />
			<span>{app.offerText(row)}</span>
			<Button variant="primary" size="sm" class="text-nowrap" data-offer-accept onclick={() => app.acceptOffer(node.first)}>{app.offerButton(row)}</Button>
			<Button size="sm" class="p-0 px-1 ms-auto" data-offer-dismiss title={t('plugin_newspaperRecognizer_pagination_offer_dismiss')}
				aria-label={t('plugin_newspaperRecognizer_pagination_offer_dismiss')} onclick={() => app.dismissOffer(node.first)}>
				<Icon name="x" />
			</Button>
		</div>
	{/if}
</div>

<div class="thumbnails px-3 pb-3" style="--thumb-size: {app.thumbHeight / 2.5}px;" role="group"
	aria-label={fmt('plugin_newspaperRecognizer_block_pages', node.first + 1)}>
	{#each app.pagesOf(node) as entry (app.pages[entry.index].filename + ':' + entry.child)}
		<PageCell index={entry.index} child={entry.child} />
	{/each}
	<div data-typing-hint class="newspaper-hint" aria-live="polite">{app.hintFor(row)}</div>
</div>
