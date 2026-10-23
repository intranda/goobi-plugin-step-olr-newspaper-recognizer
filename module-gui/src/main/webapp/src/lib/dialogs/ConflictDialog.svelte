<script lang="ts">
	import { getApp } from '../recognizer.svelte';
	import { commonOptions } from '../../../logic/hidden.mjs';
	import Modal from '../ui/Modal.svelte';
	import Button from '../ui/Button.svelte';
	import Check from '../ui/Check.svelte';
	import Icon from '../ui/Icon.svelte';
	import type { Conflict } from '../../types';

	interface Props {
		conflicts: Conflict[];
		total?: number;
		oncancel: () => void;
		onconfirm: (choices: Record<string, string>) => void;
	}

	/** Asks what happens to the additional data (hidden structures and metadata) that a change would orphan, one decision per kind of conflict. */
	let { conflicts, total, oncancel, onconfirm }: Props = $props();

	const { t, fmt, catalog } = getApp();
	const KINDS = ['DELETED', 'TYPE', 'BOUNDARY', 'EXPLICIT'];
	const P = 'plugin_newspaperRecognizer_conflict_';

	const groups = $derived(KINDS
		.map(kind => {
			const ofKind = conflicts.filter(c => c.kind === kind);
			return { kind, conflicts: ofKind, options: commonOptions(ofKind) };
		})
		.filter(group => group.conflicts.length > 0));

	// a group with a single possible choice is preselected
	const preselected = () => Object.fromEntries(groups.filter(group => group.options.length === 1).map(group => [group.kind, group.options[0]]));

	let choices = $state(preselected());
	const complete = $derived(groups.every(group => choices[group.kind]));
	const blocks = $derived(new Set(conflicts.map(c => c.blockId)).size);

	function blockLabel(conflict: Conflict) {
		const info = catalog[conflict.type ?? ''];
		const type = info ? info.label : conflict.type || t('plugin_newspaperRecognizer_pleaseSelect');
		return fmt(P + 'block', type, conflict.page + 1);
	}
</script>

<Modal title={t(P + 'title')} size="lg" onclose={oncancel}>
	<div class="d-flex flex-column gap-3">
		{#if total}<p class="mb-0">{fmt(P + 'summary', blocks, total)}</p>{/if}
		{#each groups as group (group.kind)}
			<fieldset class="d-flex flex-column gap-2">
				<legend class="fs-6 fw-bold mb-0">{t(P + group.kind)}</legend>
				<details class="newspaper-details">
					<summary>
						<Icon name="chevron-right" class="newspaper-details__closed" /><Icon name="chevron-down" class="newspaper-details__open" />
						<span>{t(P + 'affected')}: {group.conflicts.length}</span>
					</summary>
					<ul class="mb-0">
						{#each group.conflicts as conflict (conflict.blockId)}
							<li>
								{blockLabel(conflict)}
								<ul>
									{#each conflict.structures as structure (structure.label + '|' + structure.title)}
										<li>{structure.label}{structure.title ? ' – ' + structure.title : ''}</li>
									{/each}
									{#each conflict.metadata as entry (entry.label + '|' + entry.value)}<li>{entry.label}: {entry.value}</li>{/each}
								</ul>
							</li>
						{/each}
					</ul>
				</details>
				{#if group.kind === 'DELETED' && group.conflicts.some(c => c.metadata.length > 0)}
					<p class="mb-0 text-muted">{t(P + 'DELETED_metadataLost')}</p>
				{/if}
				{#each group.options as option (option)}
					<Check type="radio" name="conflict-{group.kind}" id="conflict-{group.kind}-{option}" checked={choices[group.kind] === option}
						onchange={() => (choices = { ...choices, [group.kind]: option })}>
						{t(`${P}${group.kind}_${option}`)}
					</Check>
				{/each}
			</fieldset>
		{/each}
	</div>
	{#snippet footer()}
		<Button onclick={oncancel}>{t('cancel')}</Button>
		<Button variant="success" disabled={!complete} onclick={() => onconfirm(choices)}>{t(P + 'apply')}</Button>
	{/snippet}
</Modal>
