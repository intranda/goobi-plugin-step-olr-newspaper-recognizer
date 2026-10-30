<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import FormRow from './ui/FormRow.svelte';
	import Button from './ui/Button.svelte';
	import MetadataField from './MetadataField.svelte';
	import { DebouncedEdits } from './debounce';
	import { ruleText } from './ruleText';
	import type { BlockNode, StrategyOption, TypeOption } from '../types';

	interface Props {
		node: BlockNode;
		typeOptions: TypeOption[];
		main?: boolean;
		color?: string | null;
	}

	/**
	 * The fields of a block: type, date, number, (for a block of level 0) the pagination strategy and the visible metadata fields (page range and additional data: see BlockFooter).
	 * `main` is set for a block of level 0: only it may become "without block", be repeated by a pattern or be continued; the others
	 * show a colour dot (`color`) instead of an icon.
	 */
	let { node, typeOptions, main = false, color = null }: Props = $props();

	const app = getApp();
	const { t } = app;
	const uid = $props.id();

	const start = $derived(node.start);
	const info = $derived(app.catalog[start.type ?? '']);
	const flags = $derived(app.flagsFor(node));
	const fields = $derived(app.fieldsOf(node));
	const canContinue = $derived(main && app.isGeneratable(node));
	const continueText = $derived(t('plugin_newspaperRecognizer_continue_button_' + (info?.dated && info.numbered ? 'both' : info?.dated ? 'date' : 'number')));
	const strategy = $derived(app.strategyOf(node));
	const strategyOptions = $derived(app.strategyOptionsFor(node));
	const P = 'plugin_newspaperRecognizer_pagination_strategy_';

	/** the text of an entry of the pagination dropdown */
	function optionText(option: StrategyOption) {
		switch (option.kind) {
			case 'rule':
				return ruleText(option.beginsWith, t);
			case 'hand':
				return t(P + 'hand');
			case 'rules':
				return t(P + 'rules');
			default:
				if (option.id === 'continue:parent') {
					return t(P + 'continueParent');
				}
				// an untyped nested block has no type to name: it reads like the top-level entry
				if (option.id === 'continue:sibling' && option.type) {
					return app.fmt(P + 'continueSibling', app.catalog[option.type]?.label ?? option.type);
				}
				return t(P + 'continuePrevious');
		}
	}

	/**
	 * A pick commits at once, except on a block with labels edited by hand: it asks first, as the labels are replaced. The select always
	 * shows the strategy the block has, so a cancelled pick (and the rules entry, which only opens the dialog) leaves it as it was.
	 */
	function pick(select: HTMLSelectElement) {
		const id = select.value;
		select.value = strategy;
		const option = strategyOptions.find(entry => entry.id === id);
		if (!option || id === strategy) {
			return;
		}
		if (strategy === 'hand' && option.kind !== 'rules') {
			app.askConfirmation(P + 'confirmTitle', P + 'confirmText', P + 'confirmButton', () => app.setStrategy(node, id), undefined, [optionText(option)]);
			return;
		}
		app.setStrategy(node, id);
	}

	// date and number are applied when the typing pauses (or the field is left); the page counts as changed at once, so that saving is
	// possible while the typing is still pending (leaving the field for the button applies it first)
	const edits = new DebouncedEdits(() => (app.typingPending = true));
	$effect(() => () => edits.cancelAll());
</script>

<div class="d-flex flex-column gap-2">
	<!-- type, hidden data and tools share one input group, so they line up with the field -->
	<FormRow id="{uid}-type" label={t('plugin_newspaperRecognizer_preview_type')} icon="category" {color}
		errors={[flags.missingType && t('plugin_newspaperRecognizer_validation_missingType'), flags.notAllowed && t('plugin_newspaperRecognizer_validation_notAllowed')]}
		invalid={flags.missingType || flags.notAllowed}>
		{#snippet children(aria)}
			<select class="form-select" id="{uid}-type" value={start.type ?? ''} onchange={e => app.changeType(node, e.currentTarget.value || null)} {...aria}>
				<option value="">{t('plugin_newspaperRecognizer_pleaseSelect')}</option>
				{#each typeOptions as option (option.name)}<option value={option.name}>{option.label}</option>{/each}
				{#if main}
					<hr />
					<option value="__loose__">{t('plugin_newspaperRecognizer_pagination_withoutBlock')}</option>
				{/if}
			</select>
			{#if main}
				<Button class="text-nowrap block-type__pattern" icon="repeat" title={t('plugin_newspaperRecognizer_typePattern_title')} onclick={() => app.openDialog('pattern', node)}>
					{t('plugin_newspaperRecognizer_typePattern_short')}
				</Button>
			{/if}
		{/snippet}
	</FormRow>

	<!-- date and number sit in one grid, so the continue button can span the rows it fills -->
	{#if info?.dated || info?.numbered}
		<div class="block-dates" style="--rows: {(info?.dated ? 1 : 0) + (info?.numbered ? 1 : 0)};">
			{#if info?.dated}
				<FormRow id="{uid}-date" label={t('plugin_newspaperRecognizer_date') + (info.dateRequired ? ' *' : '')} icon="calendar"
					errors={[
						flags.invalidDate && `${t('plugin_newspaperRecognizer_wrongDateFormat')} ${app.dateFormatPattern}`,
						flags.missingDate && t('plugin_newspaperRecognizer_validation_missingRequired'),
						flags.duplicate && t('plugin_newspaperRecognizer_validation_duplicate'),
					]}>
					{#snippet children(aria)}
						<input type="text" class="form-control" id="{uid}-date" value={start.dateInput} placeholder={app.dateFormatPattern}
							{...edits.field('date', value => app.changeDate(node, value))} {...aria} />
					{/snippet}
				</FormRow>
			{/if}

			{#if info?.numbered}
				<FormRow id="{uid}-number" label={t('plugin_newspaperRecognizer_nro') + (info.numberRequired ? ' *' : '')} icon="hash"
					errors={[flags.missingNumber && t('plugin_newspaperRecognizer_validation_missingRequired')]}>
					{#snippet children(aria)}
						{#if info.partNumbered}
							<input type="text" class="form-control" value={start.prefix || ''} aria-label={t('prefix')} placeholder={t('prefix')}
								{...edits.field('prefix', value => app.changeField(node, 'prefix', value))} {...aria} />
						{/if}
						<input type="text" class="form-control" id="{uid}-number" value={start.number || ''} {...edits.field('number', value => app.changeField(node, 'number', value))} {...aria} />
						{#if info.partNumbered}
							<input type="text" class="form-control" value={start.suffix || ''} aria-label={t('suffix')} placeholder={t('suffix')}
								{...edits.field('suffix', value => app.changeField(node, 'suffix', value))} {...aria} />
						{/if}
					{/snippet}
				</FormRow>
			{/if}

			{#if canContinue}
				<Button class="block-dates__continue" icon="calendar-plus" data-continue title={t('plugin_newspaperRecognizer_continueFromHere')} onclick={() => app.openDialog('continue', node)}>
					{continueText}
				</Button>
			{/if}
		</div>
	{/if}

	{#if app.settings.enabled}
		<FormRow id="{uid}-pagination" label={t('plugin_newspaperRecognizer_pagination_rules_title')} icon="list-numbers">
			{#snippet children()}
				<select class="form-select" id="{uid}-pagination" data-strategy={node.first} value={strategy} onchange={e => pick(e.currentTarget)}>
					{#each strategyOptions as option, i (option.id)}
						{#if (option.kind === 'continue' && strategyOptions[i - 1]?.kind !== 'continue') || option.kind === 'rules'}<hr />{/if}
						<option value={option.id} disabled={option.disabled}>{optionText(option)}</option>
					{/each}
				</select>
			{/snippet}
		</FormRow>
	{/if}

	<!-- the visible metadata fields of the type (plugin configuration), see lib/logic/fields.mjs -->
	{#each fields as field (field.key)}
		<MetadataField {node} {field} id="{uid}-field-{field.key}" />
	{/each}
</div>
