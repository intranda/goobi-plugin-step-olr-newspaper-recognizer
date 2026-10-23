<script lang="ts">
	import { getApp } from '../recognizer.svelte';
	import { buildTree, flatten } from '../../../logic/blocks.mjs';
	import { streams } from '../../../logic/pagination.mjs';
	import { inScope, simulateRules } from '../../../logic/pagination-tools.mjs';
	import { positionColor } from '../../../logic/colors.mjs';
	import Modal from '../ui/Modal.svelte';
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';
	import Check from '../ui/Check.svelte';
	import PreviewTable from '../ui/PreviewTable.svelte';
	import PageRef from '../ui/PageRef.svelte';
	import MoreRows from '../ui/MoreRows.svelte';
	import type { BlockNode, Page, PaginationSettings, RulesScope, StreamPart } from '../../types';

	interface Props {
		pages: Page[];
		settings: PaginationSettings;
		types: string[];
		first: number | null | undefined;
		oncancel: () => void;
		onapply: (settings: PaginationSettings, scope: RulesScope) => void;
	}

	/**
	 * The pagination rules of the session: how the labels of a type of block begin, whether they follow automatically and which
	 * labels the new rules overwrite. Only types with a rule are listed, the others can be added with the button (like the steps of the
	 * type pattern dialog). The preview shows the labels before and after, and the rule that applied, for the pages of that scope.
	 */
	let { pages, settings, types, first, oncancel, onapply }: Props = $props();

	const { t, fmt, typeLabel, catalog } = getApp();
	const P = 'plugin_newspaperRecognizer_';
	const R = P + 'pagination_rules_';

	// the rules offered besides "custom", with the key of their text
	const PRESET_KEYS: Record<string, string> = { '1': 'arabic', 'i': 'roman', 'I': 'romanUpper', '[1]': 'fictitious', '– 1': 'firstNone', '–': 'none' };
	const PRESETS = Object.keys(PRESET_KEYS);
	const LOOSE = '__loose__';
	const PREVIEW_ROWS = 20; // like the type pattern dialog; count and button still cover all pages of the scope
	const fromBlock = $derived(first !== null && first !== undefined);
	const scopeKinds: RulesScope['kind'][] = $derived(fromBlock ? ['none', 'block', 'fromBlock', 'volume'] : ['none', 'volume']);

	const ruleToPreset = (beginsWith: string[] | undefined) => {
		if (!beginsWith || beginsWith.length === 0) {
			return { preset: '', custom: '' };
		}
		const text = beginsWith.join(' ');
		return PRESETS.includes(text) ? { preset: text, custom: '' } : { preset: 'custom', custom: text };
	};

	// the editing starts from the rules of the session
	const initialRows = () => {
		const result: Record<string, { preset: string, custom: string, continueInParent?: boolean }> = {};
		for (const type of types) {
			const rule = (settings.rules || {})[type];
			result[type] = { ...ruleToPreset(rule && rule.beginsWith), continueInParent: !!(rule && rule.continueInParent) };
		}
		result[LOOSE] = ruleToPreset(settings.withoutBlock);
		return result;
	};

	// opened from a block, the rules overwrite that block's labels, else nothing
	const initialScope = (): RulesScope['kind'] => (fromBlock ? 'block' : 'none');
	const initialAutomatic = () => settings.automatic !== false;

	const initial = initialRows();
	let rows = $state(initial);
	// the table lists the rules of the session; the other types stay out of it until they are added
	const configured = Object.keys(initial).filter(key => initial[key].preset !== ''); // these cannot be removed, only the added ones
	let shown: string[] = $state([...configured]);
	let automatic = $state(initialAutomatic());
	let scopeKind: RulesScope['kind'] = $state(initialScope());

	const children = $derived(new Set(types.flatMap(type => (catalog[type] || {}).children || [])));
	// everything that can have a rule, in the order of the types; the pages without block come last
	const allRows = $derived([
		...types.map(type => ({ key: type, label: typeLabel(type), child: children.has(type), ...rows[type] })),
		{ key: LOOSE, label: t(P + 'pagination_withoutBlock'), child: false, ...rows[LOOSE] },
	]);
	const ruleRows = $derived(allRows.filter(entry => shown.includes(entry.key)));
	const addable = $derived(allRows.filter(entry => !shown.includes(entry.key)));
	let addChoice = $state('');
	const addKey = $derived(addable.some(entry => entry.key === addChoice) ? addChoice : addable[0]?.key);

	function addRule() {
		if (addKey !== undefined) {
			setRow(addKey, { preset: PRESETS[0] });
			shown = [...shown, addKey];
		}
	}

	function removeRule(key: string) {
		setRow(key, { preset: '', custom: '', continueInParent: false });
		shown = shown.filter(entry => entry !== key);
	}

	/* the settings as they are edited: the rules of the types and the rule of the pages without block */
	const draft = $derived.by(() => {
		const beginsWith = ({ preset, custom }: { preset: string, custom: string }) => (preset === 'custom' ? custom.split(/\s+/).filter(Boolean) : preset === '' ? [] : preset.split(' '));
		const rules = { ...(settings.rules || {}) };
		for (const type of types) {
			const values = beginsWith(rows[type]);
			if (values.length === 0) {
				delete rules[type];
			} else {
				rules[type] = { ...(rules[type] || {}), beginsWith: values, continueInParent: rows[type].continueInParent };
			}
		}
		return { ...settings, automatic, rules, withoutBlock: beginsWith(rows[LOOSE]) };
	});
	const scope = $derived({ kind: scopeKind, first });

	/* per page its deepest block and, for a child, the number of the child block of the level-0 block */
	function blockOwners() {
		const owners = new Array(pages.length).fill(null);
		for (const root of buildTree(pages).roots) {
			for (const node of flatten([root])) {
				const child = node.level === 0 ? 0 : root.children.findIndex(c => c.first <= node.first && node.first <= c.last) + 1;
				for (let i = node.first; i <= node.last; i++) {
					owners[i] = { node, child, rootType: root.start.type ?? '' };
				}
			}
		}
		return owners;
	}

	type Owner = { node: BlockNode, child: number, rootType: string } | null;

	function blockCell(owner: Owner) {
		if (!owner) {
			return { block: t(P + 'pagination_withoutBlock'), dot: null };
		}
		const label = typeLabel(owner.node.start.type);
		return owner.child > 0 ? { block: `${label} ${owner.child}`, dot: positionColor(owner.child - 1) } : { block: label, dot: null };
	}

	const owners = $derived(blockOwners());

	// how a rule reads in the table: the name of its preset or the text itself
	function ruleText(beginsWith: string[] | undefined) {
		if (!beginsWith || beginsWith.length === 0) {
			return t(R + 'ruleNone');
		}
		const text = beginsWith.join(' ');
		return text in PRESET_KEYS ? t(R + 'preset_' + PRESET_KEYS[text]) : text;
	}

	/* the rule that labels the pages of a block: a child that continues in its parent follows the rule of the parent */
	function ruleOf(owner: Owner) {
		if (!owner) {
			return ruleText(draft.withoutBlock);
		}
		const own = (draft.rules || {})[owner.node.start.type ?? ''];
		const rule = owner.child > 0 && own && own.continueInParent ? (draft.rules || {})[owner.rootType] : own;
		return ruleText(rule && rule.beginsWith);
	}

	/* the pages the scope covers with their label now and after the rules, in page order */
	const view = $derived.by(() => {
		const covered = inScope(scope);
		const indexes = streams(pages, draft).list
			.flatMap(stream => stream.parts.filter((part: StreamPart) => covered(stream, part)).flatMap((part: StreamPart) => part.pages)).sort((a, b) => a - b);
		const simulated = simulateRules(pages, draft, scope);
		const all = indexes.map(i => ({ page: i + 1, ...blockCell(owners[i]), rule: ruleOf(owners[i]), start: owners[i]?.node.first === i, child: (owners[i]?.child ?? 0) > 0, thumb: pages[i].image?.thumbnailUrl || null, before: pages[i].label ?? '', after: simulated[i].label ?? '' }));
		return { rows: all, changed: all.filter(row => row.before !== row.after).length };
	});

	const countText = $derived(scopeKind === 'none' ? ''
		: view.changed === 0 ? '· ' + t(R + 'unchanged')
			: '· ' + fmt(R + (view.changed === 1 ? 'changedOne' : 'changed'), view.changed));
	const applyText = $derived(scopeKind === 'none' || view.changed === 0 ? t(R + 'apply')
		: fmt(R + (view.changed === 1 ? 'applyOverwriteOne' : 'applyOverwrite'), view.changed));

	// a type that is not listed keeps the labels of its blocks (or the parent's stream)
	function presetsOf() {
		const options = PRESETS.map(value => ({ value, label: t(R + 'preset_' + PRESET_KEYS[value]) }));
		options.push({ value: 'custom', label: t(R + 'custom') });
		return options;
	}

	const setRow = (key: string, change: object) => (rows = { ...rows, [key]: { ...rows[key], ...change } });
</script>

<Modal title={t(R + 'title')} size="xl" data-pagination-dialog="true" onclose={oncancel}>
	<!-- rules and preview side by side, stacked on small screens -->
	<div class="row g-4">
		<div class="col-12 col-lg-6 d-flex flex-column gap-3">
			<fieldset>
				<legend class="fs-6 fw-bold">{t(R + 'heading')}</legend>
				<p class="small text-muted mb-2">{t(R + 'session')}</p>
				<table class="table table-sm mb-2">
					<thead>
						<tr>
							<th scope="col">{t(R + 'block')}</th>
							<th scope="col">{t(R + 'beginsWith')}</th>
							<th scope="col" class="visually-hidden">{t(R + 'remove')}</th>
						</tr>
					</thead>
					<tbody>
						{#each ruleRows as entry (entry.key)}
							<tr data-rule-row={entry.key}>
								<td>{entry.label}</td>
								<td>
									<div class="d-flex gap-2 flex-wrap align-items-center">
										<select class="form-select form-select-sm" data-rule-preset aria-label={entry.label} value={entry.preset}
											onchange={e => setRow(entry.key, { preset: e.currentTarget.value })}>
											{#each presetsOf() as option (option.value)}<option value={option.value}>{option.label}</option>{/each}
										</select>
										{#if entry.preset === 'custom'}
											<input type="text" class="form-control form-control-sm rules-custom" data-rule-custom value={entry.custom}
												aria-label={t(R + 'customLabel')} placeholder={t(R + 'customPlaceholder')}
												oninput={e => setRow(entry.key, { custom: e.currentTarget.value })} />
										{/if}
									</div>
									{#if entry.child}
										<Check class="mt-1" id="rules-continue-{entry.key}" data-rule-continue checked={!!entry.continueInParent}
											onchange={e => setRow(entry.key, { continueInParent: e.currentTarget.checked })}>
											{t(R + 'continue')}
										</Check>
									{/if}
								</td>
								<td class="text-end">
									{#if !configured.includes(entry.key)}
										<Button size="sm" data-rule-remove title={t(R + 'remove')} aria-label="{t(R + 'remove')}: {entry.label}" onclick={() => removeRule(entry.key)}>
											<Icon name="x" />
										</Button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				{#if addable.length > 0}
					<div class="input-group mb-3" role="group">
						<select class="form-select form-select-sm" data-rule-add-select aria-label={t(R + 'addSelect')} value={addKey}
							onchange={e => (addChoice = e.currentTarget.value)}>
							{#each addable as entry (entry.key)}<option value={entry.key}>{entry.label}</option>{/each}
						</select>
						<Button size="sm" variant="outline-secondary" icon="plus" data-rule-add onclick={addRule}>{t(R + 'add')}</Button>
					</div>
				{/if}
				<Check id="rules-automatic" data-automatic checked={automatic} onchange={e => (automatic = e.currentTarget.checked)}>{t(R + 'automatic')}</Check>
			</fieldset>
			<fieldset>
				<legend class="fs-6 fw-bold">{t(R + 'overwrite')}</legend>
				{#each scopeKinds as kind (kind)}
					<Check type="radio" name="rules-scope" id="rules-scope-{kind}" data-scope={kind} value={kind} checked={scopeKind === kind} onchange={() => (scopeKind = kind)}>
						{t(R + 'scope_' + kind)}
					</Check>
				{/each}
				<div class="form-text">{t(R + 'untyped')}</div>
			</fieldset>
		</div>
		<div class="col-12 col-lg-6">
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
				<PreviewTable columns={[
					{ label: t(P + 'preview_block'), col: 'preview-col-page' },
					{ label: t(R + 'block'), col: 'preview-col-name' },
					{ label: t(R + 'rule'), col: 'preview-col-rule' },
					{ label: t(P + 'preview_before') },
					{ label: t(P + 'preview_after') },
				]}>
					{#each view.rows.slice(0, PREVIEW_ROWS) as row (row.page)}
						<tr data-preview-row={row.page} data-preview-start={row.start || undefined}
							class={row.start ? (row.child ? 'preview-start preview-start--child' : 'preview-start') : undefined}>
							<td><PageRef number={row.page} thumb={row.thumb} /></td>
							<td data-preview-block class={[row.child && 'preview-child', row.start ? 'fw-bold' : 'text-muted']}>
								{#if row.dot}<span data-preview-dot class="position-dot" style="background: {row.dot};" aria-hidden="true"></span>{/if}{row.block}
							</td>
							<td data-preview-rule class="text-muted">{row.rule}</td>
							<td data-preview-before class="text-muted">{row.before}</td>
							<td data-preview-new class={row.before !== row.after ? 'preview-changed' : undefined}>{row.after}</td>
						</tr>
					{/each}
				</PreviewTable>
				<MoreRows count={view.rows.length - PREVIEW_ROWS} class="small text-muted mt-2 mb-0" />
			{/if}
		</div>
	</div>
	{#snippet footer()}
		<Button data-cancel onclick={oncancel}>{t('abbrechen')}</Button>
		<Button variant="success" data-apply onclick={() => onapply(draft, scope)}>{applyText}</Button>
	{/snippet}
</Modal>
