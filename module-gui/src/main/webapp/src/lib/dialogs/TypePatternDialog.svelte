<script lang="ts">
	import { getApp } from '../recognizer.svelte';
	import { buildTree, siblingsFrom } from '../../../logic/blocks.mjs';
	import { positionColor } from '../../../logic/colors.mjs';
	import { movePatternEntry } from '../../../logic/generation.mjs';
	import Modal from '../ui/Modal.svelte';
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';
	import PreviewTable from '../ui/PreviewTable.svelte';
	import PageRef from '../ui/PageRef.svelte';
	import MoreRows from '../ui/MoreRows.svelte';
	import type { BlockRef, Page, TypeOption } from '../../types';

	interface Props {
		pages: Page[];
		startRef: BlockRef;
		typeOptions: TypeOption[];
		oncancel: () => void;
		onapply: (pattern: string[]) => void;
	}

	/**
	 * Gives the blocks of a level a repeating pattern of types (e.g. morning, evening edition): the steps can be reordered by dragging
	 * or with the arrow keys, the preview shows the result for the first blocks.
	 */
	let { pages, startRef, typeOptions, oncancel, onapply }: Props = $props();

	const { t, fmt, typeLabel } = getApp();
	const P = 'plugin_newspaperRecognizer_';
	const PREVIEW_ROWS = 20;

	const siblings = $derived(siblingsFrom(buildTree(pages), startRef));

	// the pattern starts with the type of the first block, if it is one of the options
	const initialPattern = () => {
		const names = typeOptions.map(option => option.name);
		const type = siblings[0]?.start.type ?? '';
		return [names.includes(type) ? type : names[0]];
	};

	let pattern = $state(initialPattern());
	let dragging: number | null = $state(null);
	let grips: HTMLElement[] = [];

	const rows = $derived(siblings.slice(0, PREVIEW_ROWS).map((node, i) => ({
		page: node.first + 1,
		thumb: pages[node.first]?.image?.thumbnailUrl || null,
		before: typeLabel(node.start.type),
		after: typeLabel(pattern[i % pattern.length]),
		position: i % pattern.length,
	})));

	/* the entry follows the pointer while dragging, so the preview shows the new order right away */
	function dragOver(e: DragEvent, index: number) {
		e.preventDefault();
		if (dragging !== null && dragging !== index) {
			pattern = movePatternEntry(pattern, dragging, index);
			dragging = index;
		}
	}

	function moveByKey(e: KeyboardEvent, index: number) {
		const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : null;
		if (to === null || to < 0 || to >= pattern.length) {
			return;
		}
		e.preventDefault();
		pattern = movePatternEntry(pattern, index, to);
		grips[to].focus();
	}

	const setEntry = (index: number, type: string) => (pattern = pattern.map((entry, i) => (i === index ? type : entry)));
</script>

<Modal title={t(P + 'typePattern_title')} size="xl" onclose={oncancel}>
	<!-- pattern and preview side by side, stacked on small screens -->
	<div class="row g-4">
		<div class="col-12 col-lg-5">
			<h5 class="mb-2">{t(P + 'typePattern_steps')}</h5>
			<ol class="list-unstyled d-flex flex-column gap-2 mb-2">
				{#each pattern as type, index (index)}
					<li class={['pattern-step', dragging === index && 'pattern-step--dragging']} style="--position-color: {positionColor(index)};" draggable="true"
						ondragstart={e => { if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index)); } dragging = index; }}
						ondragover={e => dragOver(e, index)} ondragend={() => (dragging = null)}>
						<button type="button" bind:this={grips[index]} class="btn btn-blank btn-sm pattern-step__grip" title={t(P + 'typePattern_move')}
							aria-label="{t(P + 'typePattern_move')} {index + 1}" onkeydown={e => moveByKey(e, index)}>
							<Icon name="grip-vertical" />
						</button>
						<span class="pattern-step__no" aria-hidden="true">{index + 1}</span>
						<select class="form-select form-select-sm" aria-label="{t(P + 'typePattern_entry')} {index + 1}" value={type}
							onchange={e => setEntry(index, e.currentTarget.value)}>
							{#each typeOptions as option (option.name)}<option value={option.name}>{option.label}</option>{/each}
						</select>
						<Button size="sm" disabled={pattern.length < 2} title={t(P + 'typePattern_removeEntry')} aria-label="{t(P + 'typePattern_removeEntry')} {index + 1}"
							onclick={() => (pattern = pattern.filter((_, i) => i !== index))}>
							<Icon name="x" />
						</Button>
					</li>
				{/each}
			</ol>
			<Button size="sm" icon="plus" onclick={() => (pattern = [...pattern, pattern[pattern.length - 1]])}>{t(P + 'typePattern_add')}</Button>
			<p class="small text-muted mt-3 mb-2 d-flex gap-2">
				<Icon name="repeat" />
				<span>{fmt(P + 'typePattern_repeats', pattern.length)}</span>
			</p>
			<p class="small text-muted mb-0">{t(P + 'typePattern_hint')}</p>
		</div>
		<div class="col-12 col-lg-7">
			<h5 class="mb-2">{t(P + 'preview')}</h5>
			<PreviewTable columns={[
				{ label: t(P + 'preview_block'), col: 'preview-col-block' },
				{ label: t(P + 'preview_before') },
				{ label: t(P + 'preview_after') },
			]}>
				{#each rows as row (row.page)}
					<tr>
						<td><PageRef number={row.page} thumb={row.thumb} /></td>
						<td class="text-muted">{row.before}</td>
						<td class={row.before !== row.after ? 'fw-bold' : undefined}>
							<span class="position-dot" style="background: {positionColor(row.position)};" aria-hidden="true"></span>{row.after}
						</td>
					</tr>
				{/each}
			</PreviewTable>
			<MoreRows count={siblings.length - PREVIEW_ROWS} class="small text-muted mt-2 mb-0" />
		</div>
	</div>
	{#snippet footer()}
		<Button onclick={oncancel}>{t('cancel')}</Button>
		<Button variant="success" onclick={() => onapply(pattern)}>{fmt(P + 'apply', siblings.length)}</Button>
	{/snippet}
</Modal>
