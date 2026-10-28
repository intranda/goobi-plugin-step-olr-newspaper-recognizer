<script lang="ts">
	import { getApp } from '../recognizer.svelte';
	import { buildTree, siblingsFrom } from '../logic/blocks.mjs';
	import { continueFrom, followingTypeCounts, numberModeMatters } from '../logic/generation.mjs';
	import { WEEKDAY_PRESETS } from '../logic/dates.mjs';
	import { DAYS } from '../continueText';
	import Modal from '../ui/Modal.svelte';
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';
	import Toggle from '../ui/Toggle.svelte';
	import Check from '../ui/Check.svelte';
	import ContinuePreview from './ContinuePreview.svelte';
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

	const { t, fmt, catalog } = getApp();
	const P = 'plugin_newspaperRecognizer_';
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

	const matters = $derived(numberModeMatters({ dateMode, include }, catalog));
	// the setting shown; the user's choice is kept while it has no effect
	const numberMode = $derived(matters ? mode : 'perIssue');
	const result = $derived(continueFrom(pages, startRef, { include: $state.snapshot(include), mode, dateMode, weekdays: $state.snapshot(weekdays), biweekly }, catalog));

	// the preset the selected weekdays equal, if any
	const activePreset = $derived(PRESETS.find(preset => WEEKDAY_PRESETS[preset.name].every((on, i) => on === weekdays[i]))?.name ?? null);

	const toggleInclude = (type: string | null) => (include = include.includes(type) ? include.filter(t => t !== type) : [...include, type]);
	const toggleDay = (index: number) => (weekdays = weekdays.map((on, i) => (i === index ? !on : on)));
</script>

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

		<div class="col-12 col-lg-7">
			<ContinuePreview {pages} {result} {numberMode} />
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
