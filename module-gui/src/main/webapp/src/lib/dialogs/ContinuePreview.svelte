<script lang="ts">
	import { getApp } from '../recognizer.svelte';
	import { continueFrom, groupByDay, previewDays } from '../logic/generation.mjs';
	import { fromIso, formatByPattern } from '../logic/dates.mjs';
	import { continueTexts } from '../continueText';
	import PreviewTable from '../ui/PreviewTable.svelte';
	import PageRef from '../ui/PageRef.svelte';
	import MoreRows from '../ui/MoreRows.svelte';
	import Icon from '../ui/Icon.svelte';
	import Check from '../ui/Check.svelte';
	import DisclosureButton from '../ui/DisclosureButton.svelte';
	import type { Page } from '../../types';

	interface Props {
		pages: Page[];
		result: ReturnType<typeof continueFrom>;
		/** the number setting that is in effect (the one shown, not necessarily the one chosen) */
		numberMode: string;
	}

	/**
	 * The preview of the continue dialog: the following blocks by publication day with their old and new values. "Only changes" and the
	 * folds are the view's own state; the folds belong to the result they were opened in.
	 */
	let { pages, result, numberMode }: Props = $props();
	const id = $props.id();

	const { t, fmt, typeLabel, dateFormatPattern } = getApp();
	const P = 'plugin_newspaperRecognizer_';
	const PREVIEW_ROWS = 20;

	let onlyChanges = $state(false);

	const thumb = (index: number) => pages[index]?.image?.thumbnailUrl || null;
	const formatDate = (iso: string | null) => {
		const date = fromIso(iso);
		return date ? formatByPattern(date, dateFormatPattern) : '—';
	};
	const { dayText, numberText, dayHeader, foldText } = continueTexts({ t, fmt, dateFormatPattern });
	const reasonText = (reason: string) => t(P + 'continue_reason_' + reason);

	// "ab Fr 01.03.1912, Nr. 61": only the parts the type of the start block has (continueFrom leaves the others out)
	const startingPoint = $derived(result.start
		? fmt(P + 'continue_startingPoint', [result.start.date && dayText(result.start.date), result.start.number && numberText(result.start.number)].filter(Boolean).join(', '))
		: '');
	const summary = $derived.by(() => {
		const skipped = result.preview.filter(row => row.reason).length;
		const same = result.preview.length - skipped - result.count;
		return [
			result.count > 0 && fmt(P + (result.count === 1 ? 'continue_changedOne' : 'continue_changedMany'), result.count),
			same > 0 && fmt(P + (same === 1 ? 'continue_sameOne' : 'continue_sameMany'), same),
			skipped > 0 && fmt(P + 'continue_skipped', skipped),
		].filter(Boolean).join(', ');
	});
	// "only changes" hides the blocks whose values stay; left-out blocks are always shown
	const shown = (row: (typeof result.preview)[number]) => !onlyChanges || row.changed || !!row.reason;
	// the days with the rows still shown, the first PREVIEW_ROWS of them; a day header counts all blocks of its day and the hidden ones.
	// With "only changes" each run of days without a shown block folds into one row (mockups 19, approach A)
	const days = $derived(result.start ? groupByDay(result.preview, result.start) : []);
	const visibleCount = $derived(result.preview.filter(shown).length);
	const hiddenCount = $derived(result.preview.length - visibleCount);
	// a header needs a date or a day number to name; without dates and with a single day it would only repeat the starting point
	const headers = $derived(days.some(day => day.date) || (numberMode === 'perDay' && days.length > 1));
	const entries = $derived(previewDays(days, shown, PREVIEW_ROWS, onlyChanges && headers));
	const dayKey = (day: { rows: { ref: { page: number } }[] }) => day.rows[0].ref.page;
	// the open folds belong to the result they were opened in: any change of the selection on the left closes them all
	let opened: { result: typeof result | null, keys: Set<number> } = $state.raw({ result: null, keys: new Set() });
	const openFolds = $derived(opened.result === result ? opened.keys : new Set<number>());
	const toggleFold = (key: number) => {
		const keys = new Set(openFolds);
		if (!keys.delete(key)) {
			keys.add(key);
		}
		opened = { result, keys };
	};
</script>

<!-- an unchanged value plain; a changed one in the colour of changes with the old one struck through above it -->
{#snippet value(before: string, after: string)}
	{#if before === after}
		{after}
	{:else}
		{#if before !== '—'}<span class="preview-old"><span class="visually-hidden">{t(P + 'preview_before')}: </span>{before}</span>{/if}
		<span class="preview-changed">{after}</span>
	{/if}
{/snippet}

<!-- a publication day: its header (when the preview has headers) and the given rows of it -->
{#snippet dayRows(day: (typeof days)[number], rows: (typeof days)[number]['rows'], hidden: number)}
	{#if headers}
		<tr class="preview-day" id="{id}-day-{dayKey(day)}" data-continue-day>
			<th colspan="4" scope="rowgroup">
				<Icon name="calendar" class="me-1" />
				{dayHeader(day, numberMode === 'perDay')}
				<span class="small text-muted fw-normal">· {day.rows.length === 1 ? t(P + 'continue_dayBlocksOne') : fmt(P + 'continue_dayBlocks', day.rows.length)}{hidden ? ', ' + fmt(P + 'continue_dayHidden', hidden) : ''}</span>
			</th>
		</tr>
	{/if}
	{#each rows as row (row.ref.page)}
		<tr class={row.reason ? 'preview-skip' : undefined} data-continue-row={row.ref.page + 1} data-changed={row.changed}>
			<td><PageRef number={row.ref.page + 1} thumb={thumb(row.ref.page)} /></td>
			<td>
				{#if row.reason}
					<span title={reasonText(row.reason)}><Icon name="circle-minus" class="me-1" /><span class="visually-hidden">{reasonText(row.reason)}, </span></span>
				{/if}
				{typeLabel(row.type)}
			</td>
			<td>{@render value(formatDate(row.before.date), formatDate(row.after.date))}</td>
			<td>{@render value(row.before.number || '—', row.after.number || '—')}</td>
		</tr>
	{/each}
{/snippet}

<div class="continue-preview" data-continue-preview>
	<h5 class="mb-2">
		{t(P + 'preview')}
		{#if summary}<span class="small text-muted fw-normal" data-continue-summary>· {summary}</span>{/if}
	</h5>
	{#if result.error}
		<div class="alert alert-warning mb-0">{t(P + 'continue_error_' + result.error)}</div>
	{:else}
		<!-- the starting point and the switch of the view, right above the table -->
		<div class="d-flex flex-wrap align-items-center gap-2 mb-2">
			<span class="me-auto" data-continue-start>{startingPoint}</span>
			<Check class="form-switch mb-0" id="{id}-onlyChanges" role="switch" data-preview-only checked={onlyChanges} onchange={() => (onlyChanges = !onlyChanges)}>
				{t(P + 'preview_onlyChanges')}
			</Check>
		</div>
		<PreviewTable columns={[
			{ label: t(P + 'preview_block'), col: 'preview-col-block' },
			{ label: t(P + 'preview_type') },
			{ label: t(P + 'preview_date'), col: 'preview-col-date' },
			{ label: t(P + 'preview_number'), col: 'preview-col-number' },
		]}>
			{#each entries as entry (entry.fold ? 'f' + dayKey(entry.days[0]) : dayKey(entry.day))}
				{#if entry.fold}
					{@const key = dayKey(entry.days[0])}
					<tr class="preview-start preview-fold" data-continue-fold={entry.days.length}>
						<td><DisclosureButton expanded={openFolds.has(key)} controls={entry.days.map(day => `${id}-day-${dayKey(day)}`).join(' ')} label={t(P + 'preview_showUnchanged')}
							onclick={() => toggleFold(key)} /></td>
						<td colspan="3" class="small text-muted">{foldText(entry)}</td>
					</tr>
					{#if openFolds.has(key)}
						{#each entry.days as day (dayKey(day))}{@render dayRows(day, day.rows, 0)}{/each}
					{/if}
				{:else}
					{@render dayRows(entry.day, entry.rows, entry.hidden)}
				{/if}
			{/each}
		</PreviewTable>
		<MoreRows count={visibleCount - PREVIEW_ROWS} />
		<!-- with "only changes" on: how many blocks are hidden, and the way back to all of them -->
		{#if onlyChanges && hiddenCount > 0}
			<p class="small text-muted mt-2 mb-0 d-flex flex-wrap align-items-center gap-1" data-preview-hidden>
				<Icon name="eye-off" />
				<span>{hiddenCount === 1 ? t(P + 'preview_hiddenOne') : fmt(P + 'preview_hidden', hiddenCount)} ·</span>
				<button type="button" class="btn btn-link btn-sm p-0" onclick={() => (onlyChanges = false)}>{t(P + 'preview_showAll')}</button>
			</p>
		{/if}
	{/if}
</div>
