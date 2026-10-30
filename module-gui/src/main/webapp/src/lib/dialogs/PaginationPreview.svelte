<script lang="ts">
	import { getApp } from '../recognizer.svelte';
	import { labelRange, previewGroups } from '../logic/pagination-tools.mjs';
	import { positionColor } from '../logic/colors.mjs';
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';
	import Check from '../ui/Check.svelte';
	import PageRef from '../ui/PageRef.svelte';
	import DisclosureButton from '../ui/DisclosureButton.svelte';
	import type { Page, RulesScope } from '../../types';

	interface Props {
		pages: Page[];
		/** the pages the scope covers, one group per block, with their labels now and after the rules */
		preview: { groups: ReturnType<typeof previewGroups>, changed: number };
		scopeKind: RulesScope['kind'];
	}

	/**
	 * The preview of the pagination dialog: the labels before and after for the pages of the scope, one row per block that opens to its
	 * pages; blocks without change can be folded into one row. Which rows are open is the view's own state.
	 */
	let { pages, preview, scopeKind }: Props = $props();
	const id = $props.id();

	const { t, fmt, typeLabel } = getApp();
	const P = 'plugin_newspaperRecognizer_';
	const R = P + 'pagination_rules_';

	type Group = (typeof preview.groups)[number];

	/*
	 * the rows of the preview: with "only changes" a run of level-0 blocks without change (with their child blocks, all unchanged) is one row
	 * that opens to them; all rows start closed
	 */
	let onlyChanges = $state(false);
	let open: Set<string> = $state(new Set());
	const groupKey = (group: Group) => 'g' + group.first;
	type Row = { fold: false, group: Group } | { fold: true, key: string, groups: Group[] };
	const rowsView = $derived.by(() => {
		const roots: Group[][] = [];
		for (const group of preview.groups) {
			const last = roots[roots.length - 1];
			if (last && last[0].root === group.root) {
				last.push(group);
			} else {
				roots.push([group]);
			}
		}
		const unchanged = (root: Group[]) => root.every(group => group.changed === 0);
		const runs: { fold: boolean, groups: Group[] }[] = [];
		for (const root of roots) {
			const last = runs[runs.length - 1];
			const fold = onlyChanges && unchanged(root);
			if (fold && last?.fold) {
				last.groups.push(...root);
			} else {
				runs.push({ fold, groups: [...root] });
			}
		}
		return runs.flatMap((run): Row[] => (run.fold ? [{ fold: true, key: 'f' + run.groups[0].first, groups: run.groups }]
			: run.groups.map(group => ({ fold: false, group }))));
	});
	// the block rows that can be seen: those not folded and those of an open fold
	const visibleKeys = $derived(rowsView.flatMap(row => (!row.fold ? [groupKey(row.group)] : open.has(row.key) ? row.groups.map(groupKey) : [])));
	const allOpen = $derived(visibleKeys.length > 0 && visibleKeys.every(key => open.has(key)));
	const toggle = (key: string) => {
		const next = new Set(open);
		if (!next.delete(key)) {
			next.add(key);
		}
		open = next;
	};
	const toggleAll = () => (open = allOpen ? new Set([...open].filter(key => !visibleKeys.includes(key))) : new Set([...open, ...visibleKeys]));

	const groupName = (group: Group) => (group.level < 0 ? t(P + 'pagination_withoutBlock')
		: group.child > 0 ? `${typeLabel(group.type)} ${group.child}` : typeLabel(group.type));
	const rangeText = (labels: string[]) => labelRange(labels);
	const changedText = (n: number) => (n === 1 ? t(R + 'changedOne') : fmt(R + 'changed', n));
	const foldText = (groups: Group[]) => (groups.length === 1 ? t(P + 'preview_unchangedOne') : fmt(P + 'preview_unchanged', groups.length));

	const countText = $derived(scopeKind === 'none' ? ''
		: preview.changed === 0 ? '· ' + t(R + 'unchanged')
			: '· ' + fmt(R + (preview.changed === 1 ? 'changedOne' : 'changed'), preview.changed));
</script>

{#snippet groupRows(group: Group)}
	{@const key = groupKey(group)}
	{@const name = groupName(group)}
	<tr id="{id}-row-{key}" data-preview-group={group.first + 1} data-preview-pages={group.pages.map((i: number) => i + 1).join()} data-preview-changed={group.changed}
		class={group.child > 0 ? 'preview-start--child' : 'preview-start'}>
		<td><DisclosureButton expanded={open.has(key)} controls="{id}-{key}" label={fmt(P + 'preview_showPages', name)} onclick={() => toggle(key)} /></td>
		<td><PageRef number={group.first + 1} thumb={pages[group.first].image?.thumbnailUrl || null} /></td>
		<td data-preview-block class={[group.level > 0 && 'preview-child', group.changed > 0 ? 'fw-bold' : 'text-muted']} title={name}>
			{#if group.child > 0}<span data-preview-dot class="position-dot" style="background: {positionColor(group.child - 1)};" aria-hidden="true"></span>{/if}{name}
		</td>
		<td data-preview-before class="preview-range text-muted">
			{#if group.changed > 0}<s>{rangeText(group.before)}</s>{:else}{rangeText(group.before)}{/if}
		</td>
		<td data-preview-new class={['preview-range', group.changed > 0 ? 'preview-changed' : 'text-muted']}>{rangeText(group.after)}</td>
		<td class="text-end">
			{#if group.changed > 0}<span class="badge badge-intranda-orange" data-preview-badge title={changedText(group.changed)}>{group.changed}<span class="visually-hidden"> {changedText(group.changed)}</span></span>{/if}
		</td>
	</tr>
	{#if open.has(key)}
		<tr class="preview-detail" id="{id}-{key}" data-preview-detail={group.first + 1}>
			<td></td>
			<td colspan="5">
				<div class="preview-cells">
					{#each group.pages as page, k (page)}
						{@const changed = group.before[k] !== group.after[k]}
						<div class="preview-cell" data-preview-cell={page + 1}>
							<div class="thumb-box preview-cell__image">
								<img src={pages[page].image?.thumbnailUrl || 'newspaper_placeholder2.png'} alt="{t(P + 'preview_block')} {page + 1}" loading="lazy" />
							</div>
							<s class="preview-cell__old small text-muted" data-preview-old>{changed ? group.before[k] : ''}</s>
							<div class={['preview-cell__label', changed ? 'preview-changed' : 'text-muted']} data-preview-label>{group.after[k]}</div>
						</div>
					{/each}
				</div>
			</td>
		</tr>
	{/if}
{/snippet}

<h5 class="mb-2">
{t(P + 'preview')}
<span data-preview-count class="small text-muted">{countText}</span>
</h5>
{#if scopeKind === 'none'}
<p class="text-muted small d-flex gap-2">
	<Icon name="info-circle" />
	<span>{t(R + 'noneHint')}</span>
</p>
{:else}
<div class="d-flex flex-wrap gap-2 align-items-center mb-2">
	<Check class="form-switch mb-0 me-auto" id="{id}-onlyChanges" role="switch" data-preview-only checked={onlyChanges} onchange={() => (onlyChanges = !onlyChanges)}>
		{t(P + 'preview_onlyChanges')}
	</Check>
	<Button size="sm" icon={allOpen ? 'chevrons-up' : 'chevrons-down'} data-preview-all disabled={visibleKeys.length === 0} onclick={toggleAll}>
		{t(P + (allOpen ? 'preview_collapseAll' : 'preview_expandAll'))}
	</Button>
</div>
<div class="preview-scroll">
	<table class="table table-sm mb-0 preview-table preview-table--blocks">
		<colgroup><col class="preview-col-chev" /><col class="preview-col-page" /><col /><col class="preview-col-range" /><col class="preview-col-range" /><col class="preview-col-count" /></colgroup>
		<thead>
			<tr>
				<th scope="col"><span class="visually-hidden">{t(P + 'preview_expand')}</span></th>
				<th scope="col">{t(P + 'preview_block')}</th>
				<th scope="col">{t(R + 'block')}</th>
				<th scope="col">{t(P + 'preview_before')}</th>
				<th scope="col">{t(P + 'preview_after')}</th>
				<th scope="col"><span class="visually-hidden">{t(P + 'preview_changes')}</span></th>
			</tr>
		</thead>
		<tbody>
			{#each rowsView as row (row.fold ? row.key : groupKey(row.group))}
				{#if row.fold}
					<tr class="preview-start preview-fold" data-preview-fold={row.groups.length}>
						<td><DisclosureButton expanded={open.has(row.key)} controls={row.groups.map(group => `${id}-row-${groupKey(group)}`).join(' ')} label={t(P + 'preview_showUnchanged')} onclick={() => toggle(row.key)} /></td>
						<td colspan="5" class="small text-muted">{foldText(row.groups)}</td>
					</tr>
					{#if open.has(row.key)}
						{#each row.groups as group (groupKey(group))}{@render groupRows(group)}{/each}
					{/if}
				{:else}
					{@render groupRows(row.group)}
				{/if}
			{/each}
		</tbody>
	</table>
</div>
{/if}
