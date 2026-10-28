<script lang="ts">
	import { getApp } from '../recognizer.svelte';
	import { buildTree, siblingsFrom } from '../../../logic/blocks.mjs';
	import { continueFrom, followingTypeCounts, groupByDay, numberModeMatters, previewDays } from '../../../logic/generation.mjs';
	import { fromIso, formatByPattern, weekday, WEEKDAY_PRESETS } from '../../../logic/dates.mjs';
	import Modal from '../ui/Modal.svelte';
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';
	import Toggle from '../ui/Toggle.svelte';
	import Check from '../ui/Check.svelte';
	import PreviewTable from '../ui/PreviewTable.svelte';
	import PageRef from '../ui/PageRef.svelte';
	import MoreRows from '../ui/MoreRows.svelte';
	import DisclosureButton from '../ui/DisclosureButton.svelte';
	import type { BlockRef, Page, TypeOption } from '../../types';

	interface Props {
		pages: Page[];
		startRef: BlockRef;
		typeOptions: TypeOption[];
		oncancel: () => void;
		onapply: (pages: Page[]) => void;
	}

	/**
	 * Continues the date and number of a block over the blocks that follow it: which types take part, how date and number count and
	 * on which weekdays the paper appears. The preview lists the following blocks by publication day with their old and new values.
	 */
	let { pages, startRef, typeOptions, oncancel, onapply }: Props = $props();
	const id = $props.id();

	const { t, fmt, typeLabel, catalog, dateFormatPattern } = getApp();
	const P = 'plugin_newspaperRecognizer_';
	const PREVIEW_ROWS = 20;
	// index = weekday() of logic/dates.mjs (0 = Sunday)
	const DAYS = [
		{ index: 1, key: P + 'monday' },
		{ index: 2, key: P + 'tuesday' },
		{ index: 3, key: P + 'wednesday' },
		{ index: 4, key: P + 'thursday' },
		{ index: 5, key: P + 'friday' },
		{ index: 6, key: P + 'saturday' },
		{ index: 0, key: P + 'sunday' },
	];
	const PRESETS: { name: keyof typeof WEEKDAY_PRESETS, key: string }[] = [
		{ name: 'daily', key: P + 'weekdays_daily' },
		{ name: 'monToSat', key: P + 'weekdays_monToSat' },
		{ name: 'monToFri', key: P + 'weekdays_monToFri' },
	];

	const startType = $derived(siblingsFrom(buildTree(pages), startRef)[0]?.start.type ?? null);
	const generatable = $derived(typeOptions.filter(option => {
		const info = catalog[option.name] || {};
		return info.dated || info.numbered;
	}));
	const following = $derived(followingTypeCounts(pages, startRef));

	// the type of the block the dialog was opened from always takes part
	const initialInclude = () => [startType];

	let include = $state(initialInclude());
	let mode = $state('perDay');
	let dateMode = $state('perDay');
	let weekdays = $state([true, true, true, true, true, true, true]);
	let biweekly = $state(false);
	let onlyChanges = $state(false);

	const matters = $derived(numberModeMatters({ dateMode, include }, catalog));
	// the setting shown; the user's choice is kept while it has no effect
	const numberMode = $derived(matters ? mode : 'perIssue');
	const result = $derived(continueFrom(pages, startRef, { include: $state.snapshot(include), mode, dateMode, weekdays: $state.snapshot(weekdays), biweekly }, catalog));

	// the preset the selected weekdays equal, if any
	const activePreset = $derived(PRESETS.find(preset => WEEKDAY_PRESETS[preset.name].every((on, i) => on === weekdays[i]))?.name ?? null);

	const thumb = (index: number) => pages[index]?.image?.thumbnailUrl || null;
	const formatDate = (iso: string | null) => {
		const date = fromIso(iso);
		return date ? formatByPattern(date, dateFormatPattern) : '—';
	};
	// "Fr 01.03.1912": the short weekday in front of the date
	const dayText = (iso: string) => {
		const date = fromIso(iso);
		return date ? t(DAYS.find(day => day.index === weekday(date))!.key).slice(0, 2) + ' ' + formatByPattern(date, dateFormatPattern) : iso;
	};
	const numberText = (number: string) => t(P + 'preview_number') + ' ' + number;
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
	const dayHeader = (day: (typeof days)[number]) => [day.date && dayText(day.date), numberMode === 'perDay' && day.dayNumber && numberText(day.dayNumber)].filter(Boolean).join(' · ');
	// "Mo 04.03.1912 – Mi 06.03.1912 · 3 Tage, 6 Blöcke ohne Änderung": the days by their date, without dates by their number
	const foldDay = (day: (typeof days)[number]) => (day.date ? dayText(day.date) : numberText(day.dayNumber || ''));
	const foldText = (fold: { days: (typeof days)[number][], blocks: number }) => {
		const first = foldDay(fold.days[0]), last = foldDay(fold.days[fold.days.length - 1]);
		return (fold.days.length === 1 ? first : first + ' – ' + last) + ' · '
			+ (fold.days.length === 1 ? t(P + 'continue_foldDaysOne') : fmt(P + 'continue_foldDays', fold.days.length)) + ', '
			+ (fold.blocks === 1 ? t(P + 'preview_unchangedOne') : fmt(P + 'preview_unchanged', fold.blocks));
	};
	const toggleInclude = (type: string | null) => (include = include.includes(type) ? include.filter(t => t !== type) : [...include, type]);
	const toggleDay = (index: number) => (weekdays = weekdays.map((on, i) => (i === index ? !on : on)));
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
				{dayHeader(day)}
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

<Modal title={t(P + 'continue_title')} size="xl" data-continue-dialog="true" onclose={oncancel}>
	<!-- options and preview side by side, stacked on small screens -->
	<div class="row g-4">
		<div class="col-12 col-lg-5 d-flex flex-column gap-3">
			<fieldset>
				<legend class="fs-6 fw-bold">{t(P + 'continue_include')}</legend>
				<div class="d-flex flex-column gap-2">
					{#each generatable as option (option.name)}
						<Toggle class="d-flex align-items-center gap-2 text-start" pressed={include.includes(option.name)} disabled={option.name === startType}
							title={fmt(P + 'continue_following', following[option.name] || 0)} onclick={() => toggleInclude(option.name)}>
							<span class="flex-grow-1">{option.label}</span>
							<span class="small">{option.name === startType ? t(P + 'continue_note_start') + ' · ' : ''}{following[option.name] || 0}</span>
						</Toggle>
					{/each}
				</div>
			</fieldset>
			<fieldset>
				<legend class="fs-6 fw-bold">{t(P + 'continue_date')}</legend>
				<Check type="radio" name="{id}-dateMode" id="{id}-dateRepeat" checked={dateMode === 'perDay'} onchange={() => (dateMode = 'perDay')}>
					{t(P + 'continue_dateRepeat')}
				</Check>
				<Check type="radio" name="{id}-dateMode" id="{id}-datePerIssue" checked={dateMode === 'perIssue'} onchange={() => (dateMode = 'perIssue')}>
					{t(P + 'continue_datePerIssue')}
				</Check>
			</fieldset>
			<!-- with a new date for every issue both settings count alike (unless a type has a number but no date): locked, with the reason -->
			<fieldset disabled={!matters}>
				<legend class={['fs-6 fw-bold', !matters && 'text-muted']}>{t(P + 'continue_number')}</legend>
				<Check type="radio" name="{id}-mode" id="{id}-perDay" checked={numberMode === 'perDay'} onchange={() => (mode = 'perDay')}>
					{t(P + 'continue_perDay')}
				</Check>
				<Check type="radio" name="{id}-mode" id="{id}-perIssue" checked={numberMode === 'perIssue'} onchange={() => (mode = 'perIssue')}>
					{t(P + 'continue_perIssue')}
				</Check>
				{#if !matters}
					<div class="form-text d-flex gap-1 mt-1">
						<Icon name="info-circle" />
						<span>{t(P + 'continue_numberPerIssueHint')}</span>
					</div>
				{/if}
			</fieldset>
			<fieldset>
				<legend class="fs-6 fw-bold">{t(P + 'continue_weekdays')}</legend>
				<!-- seven equal segments, one per weekday -->
				<div class="weekday-picker" role="group" aria-label={t(P + 'continue_weekdays')}>
					{#each DAYS as day (day.index)}
						<button type="button" class="weekday-picker__day" aria-pressed={weekdays[day.index] ? 'true' : 'false'} title={t(day.key)} aria-label={t(day.key)}
							onclick={() => toggleDay(day.index)}>
							{t(day.key).slice(0, 2)}
						</button>
					{/each}
				</div>
				<div class="d-flex flex-wrap align-items-center gap-2 mt-2">
					<span class="small text-muted">{t(P + 'continue_weekdaysPresets')}</span>
					<div class="btn-group" role="group" aria-label={t(P + 'continue_weekdaysPresets')}>
						{#each PRESETS as preset (preset.name)}
							<button type="button" class={['btn btn-sm weekday-preset', activePreset === preset.name && 'is-active']} aria-pressed={activePreset === preset.name ? 'true' : 'false'}
								onclick={() => (weekdays = [...WEEKDAY_PRESETS[preset.name]])}>{t(preset.key)}</button>
						{/each}
					</div>
				</div>
				<Check class="form-switch mt-3" id="{id}-biweekly" checked={biweekly} onchange={() => (biweekly = !biweekly)} role="switch">
					{t(P + 'biWeekly')}
				</Check>
			</fieldset>
		</div>

		<div class="col-12 col-lg-7 continue-preview" data-continue-preview>
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
	</div>
	{#snippet footer()}
		<span class="me-auto text-muted">{t(P + 'continue_footer')}</span>
		<Button onclick={oncancel}>{t('cancel')}</Button>
		<Button variant="primary" disabled={!!result.error || result.count === 0} onclick={() => !result.error && onapply(result.pages)}>
			{result.count === 1 ? t(P + 'applyOne') : fmt(P + 'apply', result.count || 0)}
		</Button>
	{/snippet}
</Modal>
