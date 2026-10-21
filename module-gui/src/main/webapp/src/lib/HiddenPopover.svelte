<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import Popover from './ui/Popover.svelte';
	import Button from './ui/Button.svelte';
	import type { Hidden, HiddenStructure } from '../types';

	interface Props {
		summary: Hidden | null;
		align?: 'left' | 'right';
		onclose: () => void;
		onremove?: (() => void) | null;
	}

	/**
	 * Lists the additional data of a block (or of the volume) that the plugin keeps but does not show as fields.
	 * `onremove` is optional: without it the data cannot be removed here.
	 */
	let { summary, align = 'right', onclose, onremove = null }: Props = $props();

	const { t, fmt } = getApp();
	const structures = $derived(summary?.structures ?? []);
	const metadata = $derived(summary?.metadata ?? []);

	const pages = (structure: HiddenStructure) => structure.firstPage < 0
		? t('plugin_newspaperRecognizer_hidden_noPages')
		: fmt('plugin_newspaperRecognizer_hidden_pages', structure.firstPage + 1, structure.lastPage + 1);
</script>

<Popover title={t('plugin_newspaperRecognizer_hidden_title')} align={align === 'left' ? 'start' : 'end'} {onclose}>
	<div class="d-flex flex-column gap-2">
		<p class="mb-0 text-muted">{t('plugin_newspaperRecognizer_hidden_hint')}</p>
		{#if structures.length > 0}
			<div>
				<strong>{t('plugin_newspaperRecognizer_hidden_structures')}</strong>
				<ul class="mb-0">
					{#each structures as structure (structure.label + '|' + structure.title + '|' + structure.firstPage)}
						<li>{structure.label}{structure.title ? ' – ' + structure.title : ''} ({pages(structure)})</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if metadata.length > 0}
			<div>
				<strong>{t('plugin_newspaperRecognizer_hidden_metadata')}</strong>
				<ul class="mb-0">
					{#each metadata as entry (entry.label + '|' + entry.value)}<li>{entry.label}: {entry.value}</li>{/each}
				</ul>
			</div>
		{/if}
		{#if onremove}
			<div class="text-end">
				<Button variant="hot" size="sm" onclick={onremove}>{t('plugin_newspaperRecognizer_hidden_remove')}</Button>
			</div>
		{/if}
	</div>
</Popover>
