<script lang="ts">
	import { tick } from 'svelte';
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
	 * or with the move up/down buttons (the buttons are the pointer-only-free alternative required by WCAG 2.5.7), the preview shows the result for the first blocks.
	 */
	let { pages, startRef, typeOptions, oncancel, onapply }: Props = $props();

	const { t, fmt, typeLabel } = getApp();
	const P = 'plugin_newspaperRecognizer_';
	const PREVIEW_ROWS = 20;

	const siblings = $derived(siblingsFrom(buildTree(pages), startRef));

	// every step has an id of its own, so that the each block keeps the element of a step that is moved or removed
	let nextId = 0;
	const step = (type: string) => ({ id: nextId++, type });

	// the pattern starts with the type of the first block, if it is one of the options
	const initialPattern = () => {
		const names = typeOptions.map(option => option.name);
		const type = siblings[0]?.start.type ?? '';
		return [step(names.includes(type) ? type : names[0])];
	};

	let pattern = $state(initialPattern());
	let dragging: number | null = $state(null);
	let list: HTMLElement | undefined = $state();
	// spoken after a move, as the new order is otherwise only visible
	let announcement = $state('');

	const rows = $derived(siblings.slice(0, PREVIEW_ROWS).map((node, i) => ({
		page: node.first + 1,
		thumb: pages[node.first]?.image?.thumbnailUrl || null,
		before: typeLabel(node.start.type),
		after: typeLabel(pattern[i % pattern.length].type),
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

	/* moves an entry one place and keeps the focus on the button that was used (or its counterpart if that one is now disabled at the edge) */
	async function move(index: number, direction: -1 | 1) {
		const to = index + direction;
		if (to < 0 || to >= pattern.length) {
			return;
		}
		pattern = movePatternEntry(pattern, index, to);
		announcement = fmt(P + 'typePattern_moved', index + 1, to + 1);
		await tick();
		const atEdge = direction === -1 ? to === 0 : to === pattern.length - 1;
		const target = list?.querySelector<HTMLElement>(`[data-move="${to}:${atEdge ? -direction : direction}"]`);
		target?.focus();
	}

	const setEntry = (index: number, type: string) => (pattern = pattern.map((entry, i) => (i === index ? { ...entry, type } : entry)));
</script>

<Modal title={t(P + 'typePattern_title')} size="xl" onclose={oncancel}>
	<!-- pattern and preview side by side, stacked on small screens -->
	<div class="row g-4">
		<div class="col-12 col-lg-5">
			<h5 class="mb-2">{t(P + 'typePattern_steps')}</h5>
			<ol bind:this={list} class="list-unstyled d-flex flex-column gap-2 mb-2">
				{#each pattern as { id, type }, index (id)}
					<li class={['pattern-step', dragging === index && 'pattern-step--dragging']} style="--position-color: {positionColor(index)};" draggable="true"
						ondragstart={e => { if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index)); } dragging = index; }}
						ondragover={e => dragOver(e, index)} ondragend={() => (dragging = null)}>
						<Icon name="grip-vertical" />
						<span class="pattern-step__no" aria-hidden="true">{index + 1}</span>
						<select class="form-select form-select-sm" aria-label="{t(P + 'typePattern_entry')} {index + 1}" value={type}
							onchange={e => setEntry(index, e.currentTarget.value)}>
							{#each typeOptions as option (option.name)}<option value={option.name}>{option.label}</option>{/each}
						</select>
						<Button size="sm" disabled={index === 0} data-move="{index}:-1" title={t(P + 'typePattern_moveUp')} aria-label="{t(P + 'typePattern_moveUp')} {index + 1}"
							onclick={() => move(index, -1)}>
							<Icon name="arrow-up" />
						</Button>
						<Button size="sm" disabled={index === pattern.length - 1} data-move="{index}:1" title={t(P + 'typePattern_moveDown')} aria-label="{t(P + 'typePattern_moveDown')} {index + 1}"
							onclick={() => move(index, 1)}>
							<Icon name="arrow-down" />
						</Button>
						<Button size="sm" disabled={pattern.length < 2} title={t(P + 'typePattern_removeEntry')} aria-label="{t(P + 'typePattern_removeEntry')} {index + 1}"
							onclick={() => (pattern = pattern.filter((_, i) => i !== index))}>
							<Icon name="x" />
						</Button>
					</li>
				{/each}
			</ol>
			<div class="visually-hidden" role="status" aria-live="polite">{announcement}</div>
			<Button size="sm" icon="plus" onclick={() => (pattern = [...pattern, step(pattern[pattern.length - 1].type)])}>{t(P + 'typePattern_add')}</Button>
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
							<span class="pattern-step__no" style="background: {positionColor(row.position)};">
								{row.position + 1}
							</span> {row.after}
						</td>
					</tr>
				{/each}
			</PreviewTable>
			<MoreRows count={siblings.length - PREVIEW_ROWS} class="small text-muted mt-2 mb-0" />
		</div>
	</div>
	{#snippet footer()}
		<Button onclick={oncancel}>{t('cancel')}</Button>
		<Button variant="primary" onclick={() => onapply(pattern.map(entry => entry.type))}>{fmt(P + 'apply', siblings.length)}</Button>
	{/snippet}
</Modal>
