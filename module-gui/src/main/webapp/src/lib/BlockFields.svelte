<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import FormRow from './ui/FormRow.svelte';
	import Button from './ui/Button.svelte';
	import Icon from './ui/Icon.svelte';
	import MetadataField from './MetadataField.svelte';
	import HiddenPopover from './HiddenPopover.svelte';
	import type { BlockNode, TypeOption } from '../types';

	interface Props {
		node: BlockNode;
		typeOptions: TypeOption[];
		main?: boolean;
		color?: string | null;
	}

	/**
	 * The fields of a block: type, date, number and the visible metadata fields, then its page range and the additional data it keeps.
	 * `main` is set for a block of level 0: only it may become "without block", be repeated by a pattern or be continued; the others
	 * show a colour dot (`color`) instead of an icon and no page range.
	 */
	let { node, typeOptions, main = false, color = null }: Props = $props();

	const app = getApp();
	const { t, fmt } = app;
	const uid = $props.id();

	const start = $derived(node.start);
	const info = $derived(app.catalog[start.type ?? '']);
	const flags = $derived(app.flagsFor(node));
	const fields = $derived(app.fieldsOf(node));
	const elementId = $derived(app.blockElementId(node));
	const structures = $derived(start.hidden?.structures ?? []);
	const metadata = $derived(start.hidden?.metadata ?? []);
	const hiddenCount = $derived(structures.length + metadata.length);
	const hiddenOpen = $derived(app.openHidden === elementId);
	const canContinue = $derived(main && app.isGeneratable(node));
	const pageFirst = $derived(main ? node.first + 1 : 0);
	const pageLast = $derived(node.last + 1);

	const hiddenText = $derived([
		structures.length > 0 && fmt('plugin_newspaperRecognizer_hidden_structureCount', structures.length),
		metadata.length > 0 && fmt('plugin_newspaperRecognizer_hidden_metadataCount', metadata.length),
	].filter(Boolean).join(', '));

	// shown values that follow the generated value, per type and field, to notice when a change of date or number updates them
	let shownGenerated: Record<string, string> = {};
	const flashUpdated = (root: HTMLElement) => {
		for (const field of fields) {
			const key = start.type + ':' + field.key;
			if (field.pattern == null || field.overwritten || !(key in shownGenerated) || shownGenerated[key] === field.value) {
				continue;
			}
			const wrapper = (root.querySelector(`[data-field-wrapper="${field.key}"]`) as HTMLElement | null);
			if (wrapper) {
				wrapper.classList.remove('newspaper-field--updated');
				void wrapper.offsetWidth; // restart the animation
				wrapper.classList.add('newspaper-field--updated');
			}
		}
		shownGenerated = Object.fromEntries(fields.filter(f => f.pattern != null && !f.overwritten).map(f => [start.type + ':' + f.key, f.value]));
	};
</script>

{#snippet continueButton()}
	<Button class="text-nowrap" icon="calendar-plus" title={t('plugin_newspaperRecognizer_continueFromHere')} onclick={() => app.openDialog('continue', node)}>
		{t('plugin_newspaperRecognizer_continue_short')}
	</Button>
{/snippet}

<div {@attach flashUpdated} class="d-flex flex-column gap-2">
	<!-- type, hidden data and tools share one input group, so they line up with the field -->
	<FormRow id="{uid}-type" label={t('plugin_newspaperRecognizer_preview_type')} icon="category" {color}
		errors={[flags.missingType && t('plugin_newspaperRecognizer_validation_missingType'), flags.notAllowed && t('plugin_newspaperRecognizer_validation_notAllowed')]}
		invalid={flags.missingType || flags.notAllowed}>
		<select class="form-select" id="{uid}-type" value={start.type ?? ''} onchange={e => app.changeType(node, e.currentTarget.value || null)}>
			<option value="">{t('plugin_newspaperRecognizer_pleaseSelect')}</option>
			{#each typeOptions as option (option.name)}<option value={option.name}>{option.label}</option>{/each}
			{#if main}
				<hr />
				<option value="__loose__">{t('plugin_newspaperRecognizer_pagination_withoutBlock')}</option>
			{/if}
		</select>
		{#if main}
			<Button class="text-nowrap" icon="repeat" title={t('plugin_newspaperRecognizer_typePattern_title')} onclick={() => app.openDialog('pattern', node)}>
				{t('plugin_newspaperRecognizer_typePattern_short')}
			</Button>
		{/if}
	</FormRow>

	{#if info?.dated}
		<FormRow id="{uid}-date" label={t('plugin_newspaperRecognizer_date') + (info.dateRequired ? ' *' : '')} icon="calendar"
			errors={[
				flags.invalidDate && `${t('plugin_newspaperRecognizer_wrongDateFormat')} ${app.dateFormatPattern}`,
				flags.missingDate && t('plugin_newspaperRecognizer_validation_missingRequired'),
				flags.duplicate && t('plugin_newspaperRecognizer_validation_duplicate'),
			]}>
			<input type="text" class="form-control" id="{uid}-date" value={start.dateInput} placeholder={app.dateFormatPattern}
				onkeyup={e => app.changeDate(node, e.currentTarget.value)} onblur={e => app.changeDate(node, e.currentTarget.value)} />
			{#if canContinue}{@render continueButton()}{/if}
		</FormRow>
	{/if}

	{#if info?.numbered}
		<FormRow id="{uid}-number" label={t('plugin_newspaperRecognizer_nro') + (info.numberRequired ? ' *' : '')} icon="hash"
			errors={[flags.missingNumber && t('plugin_newspaperRecognizer_validation_missingRequired')]}>
			{#if info.partNumbered}
				<input type="text" class="form-control" value={start.prefix || ''} aria-label={t('prefix')} placeholder={t('prefix')}
					onkeyup={e => app.changeField(node, 'prefix', e.currentTarget.value)} />
			{/if}
			<input type="text" class="form-control" id="{uid}-number" value={start.number || ''} onkeyup={e => app.changeField(node, 'number', e.currentTarget.value)} />
			{#if info.partNumbered}
				<input type="text" class="form-control" value={start.suffix || ''} aria-label={t('suffix')} placeholder={t('suffix')}
					onkeyup={e => app.changeField(node, 'suffix', e.currentTarget.value)} />
			{/if}
			{#if canContinue && !info.dated}{@render continueButton()}{/if}
		</FormRow>
	{/if}

	<!-- the visible metadata fields of the type (plugin configuration), see logic/fields.mjs -->
	{#each fields as field (field.key)}
		<MetadataField {node} {field} id="{uid}-field-{field.key}" />
	{/each}

	{#if pageFirst || hiddenCount > 0}
		<div class="d-flex justify-content-between align-items-center gap-3 small border-top pt-2 position-relative">
			<span class="text-muted">{pageFirst ? app.pagesSummary(pageFirst, pageLast) : ''}</span>
			{#if hiddenCount > 0}
				<button type="button" class="btn btn-link btn-sm p-0 d-flex align-items-center gap-1 text-decoration-none"
					onclick={() => app.toggleHidden(elementId)} aria-expanded={hiddenOpen ? 'true' : 'false'}>
					<Icon name="info-circle" />
					<span>{hiddenText}</span>
				</button>
			{/if}
			{#if hiddenOpen}
				<HiddenPopover summary={start.hidden} onclose={() => app.toggleHidden(elementId)} onremove={() => app.askRemoveHidden(node)} />
			{/if}
		</div>
	{/if}
</div>
