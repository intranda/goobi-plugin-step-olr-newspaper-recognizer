<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import FormRow from './ui/FormRow.svelte';
	import Icon from './ui/Icon.svelte';
	import Popover from './ui/Popover.svelte';
	import Button from './ui/Button.svelte';
	import type { BlockNode, FieldState } from '../types';

	interface Props {
		node: BlockNode;
		field: FieldState;
		id: string;
	}

	/**
	 * A metadata field of a block that the plugin configuration makes visible (see logic/fields.mjs): its value is generated from the
	 * date and number of the block until the user overwrites it. `field` is a field state of that module.
	 */
	let { node, field, id }: Props = $props();

	const app = getApp();
	const { t } = app;

	let bubble = $state(false); // shows the changed generated value of a field whose value was overwritten
	const readonly = $derived(field.display === 'readonly');
	const icon = $derived(({ textarea: 'align-left', select1: 'selector', readonly: 'lock' } as Record<string, string>)[field.display] || 'letter-case');
	const missing = $derived(field.required && !String(field.value).trim());
	const oninput = (e: Event & { currentTarget: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement }) => app.changeValue(node, field.key, e.currentTarget.value);

	function decide(action: () => void) {
		bubble = false;
		action();
	}
</script>

<FormRow {id} {icon} label={field.label + (field.required ? ' *' : '')} errors={[missing && t('plugin_newspaperRecognizer_validation_missingRequired')]}>
	<div class={['newspaper-field', field.display === 'textarea' && 'grow-wrap', field.overwritten && 'newspaper-field--overwritten']}
		data-content={field.value} data-field-wrapper={field.key}>
		{#if field.display === 'select1'}
			<select class="form-select" {id} value={field.value} onchange={oninput}>
				<option value="">{t('plugin_newspaperRecognizer_pleaseSelect')}</option>
				{#if field.value && !field.items.some(item => item.value === field.value)}
					<option value={field.value}>{field.value}</option>
				{/if}
				{#each field.items as item (item.value)}<option value={item.value}>{item.label}</option>{/each}
			</select>
		{:else if field.display === 'textarea'}
			<textarea class="form-control" rows="1" {id} value={field.value} {oninput}></textarea>
		{:else}
			<input type="text" class="form-control" {id} value={field.value} {readonly} {oninput} />
		{/if}
		{#if field.overwritten && !field.stale && !readonly}
			<button type="button" class="btn btn-blank newspaper-field__reset" title={t('plugin_newspaperRecognizer_field_reset')}
				aria-label={t('plugin_newspaperRecognizer_field_reset')} onclick={() => app.resetValue(node, field.key)}>
				<Icon name="arrow-back-up" />
			</button>
		{/if}
		<!-- the generated value changed after the value was overwritten: offer it without a dialog -->
		{#if field.stale && !readonly}
			<button type="button" class="btn btn-blank newspaper-field__reset newspaper-field__reset--stale" title={t('plugin_newspaperRecognizer_field_changed')}
				aria-label={t('plugin_newspaperRecognizer_field_changed')} aria-expanded={bubble ? 'true' : 'false'} onclick={() => (bubble = !bubble)}>
				<Icon name="refresh" />
			</button>
			{#if bubble}
				<Popover title={t('plugin_newspaperRecognizer_field_changed')} onclose={() => (bubble = false)}>
					<div class="fw-semibold mb-2 text-break">{field.generated}</div>
					<div class="d-flex gap-2 justify-content-end">
						<Button size="sm" onclick={() => decide(() => app.keepValue(node, field.key))}>{t('plugin_newspaperRecognizer_field_keep')}</Button>
						<Button variant="primary" size="sm" onclick={() => decide(() => app.resetValue(node, field.key))}>{t('uebernehmen')}</Button>
					</div>
				</Popover>
			{/if}
		{/if}
	</div>
</FormRow>
