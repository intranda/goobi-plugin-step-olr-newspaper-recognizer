<script lang="ts">
	import { getApp } from '../recognizer.svelte';
	import { streams } from '../logic/pagination.mjs';
	import { inScope, previewGroups, simulateRules } from '../logic/pagination-tools.mjs';
	import { tick } from 'svelte';
	import Modal from '../ui/Modal.svelte';
	import Button from '../ui/Button.svelte';
	import Icon from '../ui/Icon.svelte';
	import Check from '../ui/Check.svelte';
	import PaginationPreview from './PaginationPreview.svelte';
	import { PRESET_KEYS, ruleText as ruleTextOf } from '../ruleText';
	import type { FreshOffer, Page, PaginationSettings, RulesScope, StreamPart } from '../../types';

	interface Props {
		pages: Page[];
		settings: PaginationSettings;
		/** the pagination of the plugin configuration as loaded, including the default rules the backend adds */
		configured: Partial<PaginationSettings> | null;
		types: string[];
		first: number | null | undefined;
		/** the open offers; while there are any, the scope can be "only the offered pages" */
		offers: FreshOffer[];
		offerFrom: number | null;
		initialScope?: 'offers';
		oncancel: () => void;
		onapply: (settings: PaginationSettings, scope: RulesScope) => void;
	}

	/**
	 * The pagination rules of the session: how the labels of a type of block begin, whether they follow automatically, whether they count
	 * through the volume and which labels the new rules overwrite. The rules are grouped by origin: those of the plugin configuration are
	 * always listed and can be changed or removed for the session and restored; the rules created in the session follow, the other types
	 * can be added from the menu. The preview shows the labels before and after for the pages of that scope, one row per block that opens to
	 * its pages; blocks without change can be folded into one row.
	 */
	let { pages, settings, configured, types, first, offers, offerFrom, initialScope, oncancel, onapply }: Props = $props();
	const id = $props.id();

	const { t, fmt, typeLabel, catalog } = getApp();
	const P = 'plugin_newspaperRecognizer_';
	const R = P + 'pagination_rules_';

	// the rules offered besides "custom", with the key of their text
	const PRESETS = Object.keys(PRESET_KEYS);
	const ruleText = (beginsWith: string[] | undefined) => ruleTextOf(beginsWith, t);
	const LOOSE = '__loose__';
	const fromBlock = $derived(first !== null && first !== undefined);
	const scopeKinds: RulesScope['kind'][] = $derived(['none', ...(offers.length > 0 ? ['offers' as const] : []), ...(fromBlock ? ['block' as const, 'fromBlock' as const] : []), 'volume']);

	const ruleToPreset = (beginsWith: string[] | undefined) => {
		if (!beginsWith || beginsWith.length === 0) {
			return { preset: '', custom: '' };
		}
		const text = beginsWith.join(' ');
		return PRESETS.includes(text) ? { preset: text, custom: '' } : { preset: 'custom', custom: text };
	};

	type RuleRow = { preset: string, custom: string, continueInParent: boolean, removed: boolean };

	const beginsWith = ({ preset, custom }: { preset: string, custom: string }) => (preset === 'custom' ? custom.split(/\s+/).filter(Boolean) : preset === '' ? [] : preset.split(' '));
	const ruleRow = (values: string[] | undefined, continueInParent = false): RuleRow => ({ ...ruleToPreset(values), continueInParent, removed: false });

	// the rule of the configuration, by type (LOOSE: the pages without block); no rule is preset ''
	const configuredRow = (key: string) => {
		const rule = key === LOOSE ? null : (configured?.rules || {})[key];
		return key === LOOSE ? ruleRow(configured?.withoutBlock) : ruleRow(rule?.beginsWith, !!rule?.continueInParent);
	};
	const isConfigured = (key: string) => configuredRow(key).preset !== '';

	// the editing starts from the rules of the session; a configured rule the session has none for is removed
	const initialRows = () => {
		const result: Record<string, RuleRow> = {};
		for (const type of types) {
			const rule = (settings.rules || {})[type];
			result[type] = ruleRow(rule?.beginsWith, !!rule?.continueInParent);
		}
		result[LOOSE] = ruleRow(settings.withoutBlock);
		for (const key of Object.keys(result).filter(key => isConfigured(key) && result[key].preset === '')) {
			result[key] = { ...configuredRow(key), removed: true };
		}
		return result;
	};

	// opened from the offers, the rules overwrite the offered pages; from a block that block's labels, else nothing
	const startScope = (): RulesScope['kind'] => (initialScope === 'offers' && offers.length > 0 ? 'offers' : fromBlock ? 'block' : 'none');

	const initialAutomatic = () => settings.automatic !== false;
	const initialCount = () => !!settings.countThroughVolume;

	const initial = initialRows();
	let rows = $state(initial);
	// the session group: rules not in the configuration, those of earlier openings first, the ones added now at the end
	let session: string[] = $state(Object.keys(initial).filter(key => !isConfigured(key) && initial[key].preset !== ''));
	let added: string[] = $state([]);
	let automatic = $state(initialAutomatic());
	let countChoice = $state(initialCount());
	let scopeKind: RulesScope['kind'] = $state(startScope());
	// the offers were computed with the counting of the session, so that scope keeps it (the radios show it, disabled)
	const countThroughVolume = $derived(scopeKind === 'offers' ? !!settings.countThroughVolume : countChoice);

	const children = $derived(new Set(types.flatMap(type => (catalog[type] || {}).children || [])));
	// everything that can have a rule, in the order of the types; the pages without block come last
	const allRows = $derived([
		...types.map(type => ({ key: type, label: typeLabel(type), child: children.has(type), ...rows[type] })),
		{ key: LOOSE, label: t(P + 'pagination_withoutBlock'), child: false, ...rows[LOOSE] },
	]);
	type Entry = (typeof allRows)[number];
	const configuredRows = $derived(allRows.filter(entry => isConfigured(entry.key)));
	const sessionRows = $derived(session.map(key => allRows.find(entry => entry.key === key)).filter((entry): entry is Entry => !!entry));
	const addable = $derived(allRows.filter(entry => !isConfigured(entry.key) && !session.includes(entry.key)));
	const addGroups = $derived([
		{ header: t(R + 'addIssues'), entries: addable.filter(entry => entry.key !== LOOSE && !entry.child) },
		{ header: t(R + 'addChildren'), entries: addable.filter(entry => entry.child) },
	].filter(group => group.entries.length > 0));
	const addLoose = $derived(addable.find(entry => entry.key === LOOSE));

	// a configured rule differs while it is removed, has other values or another "continue in parent"
	const differs = (entry: Entry) => {
		const own = configuredRow(entry.key);
		return entry.removed || beginsWith(entry).join(' ') !== beginsWith(own).join(' ') || (entry.child && entry.continueInParent !== own.continueInParent);
	};
	const configuredDiffer = $derived(configuredRows.some(differs));

	function configuredHint(key: string) {
		const own = configuredRow(key);
		const text = ruleText(beginsWith(own));
		return fmt(R + 'configured', own.continueInParent ? `${text} · ${t(R + 'continue')}` : text);
	}

	let body: HTMLElement | undefined = $state();
	const selectOf = (key: string) => body?.querySelector<HTMLElement>(`[data-rule-row="${key}"] [data-rule-preset]`);

	// the select of a rule that came back lights up once (like the label fields a jump leads to)
	async function flash(key: string) {
		await tick();
		const wrapper = selectOf(key)?.parentElement;
		if (wrapper) {
			wrapper.classList.remove('newspaper-flash');
			void wrapper.offsetWidth;
			wrapper.classList.add('newspaper-flash');
		}
	}

	async function addRule(key: string) {
		menuOpen = false;
		setRow(key, ruleRow([PRESETS[0]]));
		session = [...session.filter(entry => entry !== key), key];
		added = [...added.filter(entry => entry !== key), key];
		await tick();
		selectOf(key)?.focus();
	}

	// the button that was clicked goes away: the focus moves to what takes its place, so that it stays in the dialog
	async function focusAfter(selector: string) {
		await tick();
		body?.querySelector<HTMLElement>(selector)?.focus();
	}

	function removeRule(key: string) {
		if (isConfigured(key)) {
			setRow(key, { removed: true });
			focusAfter(`[data-rule-row="${key}"] [data-rule-restore]`);
			return;
		}
		setRow(key, ruleRow([]));
		session = session.filter(entry => entry !== key);
		added = added.filter(entry => entry !== key);
		focusAfter('[data-rule-add]');
	}

	function restoreRule(key: string) {
		setRow(key, configuredRow(key));
		flash(key);
		focusAfter(`[data-rule-row="${key}"] [data-rule-preset]`);
	}

	// the configuration group only; the session rules, the counting and the automatic setting stay
	function resetConfigured() {
		const restored = configuredRows.filter(differs);
		for (const entry of restored) {
			setRow(entry.key, configuredRow(entry.key));
			flash(entry.key);
		}
		focusAfter(`[data-rule-row="${restored[0]?.key}"] [data-rule-preset]`);
	}

	/* the menu of the types without rule; closes on Escape (not the dialog), on a choice or when the focus leaves it */
	let menuOpen = $state(false);
	let menu: HTMLElement | undefined = $state();
	const menuItems = () => [...(menu?.querySelectorAll<HTMLElement>('button.dropdown-item') ?? [])];

	function onmenukeydown(e: KeyboardEvent) {
		if (!menuOpen) {
			return;
		}
		if (e.key === 'Escape') {
			e.stopPropagation();
			menuOpen = false;
			menu?.querySelector<HTMLElement>('[data-rule-add]')?.focus();
			return;
		}
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') {
			return;
		}
		e.preventDefault();
		const entries = menuItems();
		const at = entries.indexOf(document.activeElement as HTMLElement);
		entries[e.key === 'ArrowDown' ? (at + 1) % entries.length : (at - 1 + entries.length) % entries.length]?.focus();
	}

	function onmenufocusout(e: FocusEvent) {
		if (menuOpen && !(e.relatedTarget instanceof Node && menu?.contains(e.relatedTarget))) {
			menuOpen = false;
		}
	}

	/* the settings as they are edited: the rules of the types and the rule of the pages without block; a removed rule is no rule */
	const draft = $derived.by(() => {
		const values = (key: string) => (rows[key].removed ? [] : beginsWith(rows[key]));
		const rules = { ...(settings.rules || {}) };
		for (const type of types) {
			if (values(type).length === 0) {
				delete rules[type];
			} else {
				rules[type] = { ...(rules[type] || {}), beginsWith: values(type), continueInParent: rows[type].continueInParent };
			}
		}
		return { ...settings, automatic, countThroughVolume, rules, withoutBlock: values(LOOSE) };
	});
	const scope: RulesScope = $derived(scopeKind === 'offers' ? { kind: 'offers', offers, from: offerFrom, first: null } : { kind: scopeKind, first });
	const scopeText = (kind: RulesScope['kind']) => (kind !== 'offers' ? t(R + 'scope_' + kind)
		: offers.length === 1 ? t(R + 'scope_offersOne') : fmt(R + 'scope_offers', offers.length));

	/* the pages the scope covers, one group per block in page order, with their labels now and after the rules */
	const preview = $derived.by(() => {
		const covered = inScope(scope);
		const indexes = streams(pages, draft).list
			.flatMap(stream => stream.parts.filter((part: StreamPart) => covered(stream, part)).flatMap((part: StreamPart) => part.pages)).sort((a, b) => a - b);
		const groups = previewGroups(pages, simulateRules(pages, draft, scope), indexes);
		return { groups, changed: groups.reduce((sum, group) => sum + group.changed, 0) };
	});

	const applyText = $derived(scopeKind === 'none' || preview.changed === 0 ? t(R + 'apply')
		: fmt(R + (preview.changed === 1 ? 'applyOverwriteOne' : 'applyOverwrite'), preview.changed));


	// a type that is not listed keeps the labels of its blocks (or the parent's stream)
	function presetsOf() {
		const options = PRESETS.map(value => ({ value, label: t(R + 'preset_' + PRESET_KEYS[value]) }));
		options.push({ value: 'custom', label: t(R + 'custom') });
		return options;
	}

	const setRow = (key: string, change: Partial<RuleRow>) => (rows = { ...rows, [key]: { ...rows[key], ...change } });
</script>

{#snippet ruleRowView(entry: Entry, fromConfiguration: boolean)}
	<tr data-rule-row={entry.key} data-rule-removed={entry.removed || undefined} class={added.includes(entry.key) ? 'is-new' : undefined}>
		<td class={entry.removed ? 'text-muted' : undefined}><span class={entry.removed ? 'text-decoration-line-through' : undefined}>{entry.label}</span></td>
		<td>
			{#if entry.removed}
				<span class="small text-muted">{t(R + 'noRule')}</span>
			{:else}
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
					<Check class="mt-1" id="{id}-continue-{entry.key}" data-rule-continue checked={!!entry.continueInParent}
						onchange={e => setRow(entry.key, { continueInParent: e.currentTarget.checked })}>
						{t(R + 'continue')}
					</Check>
				{/if}
			{/if}
			{#if fromConfiguration && differs(entry)}
				<div class="form-text mt-1" data-rule-configured>{configuredHint(entry.key)}</div>
			{/if}
		</td>
		<td class="text-end text-nowrap">
			{#if fromConfiguration && differs(entry)}
				<Button size="sm" data-rule-restore title={t(R + 'restore')} aria-label="{t(R + 'restore')}: {entry.label}" onclick={() => restoreRule(entry.key)}>
					<Icon name="arrow-back-up" />
				</Button>
			{/if}
			{#if !entry.removed}
				<Button size="sm" data-rule-remove title={t(R + 'remove')} aria-label="{t(R + 'remove')}: {entry.label}" onclick={() => removeRule(entry.key)}>
					<Icon name="x" />
				</Button>
			{/if}
		</td>
	</tr>
{/snippet}

<Modal title={t(R + 'title')} size="xl" data-pagination-dialog="true" onclose={oncancel}>
	<!-- rules and preview side by side, stacked on small screens -->
	<div bind:this={body} class="row g-4">
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
					<tbody data-rule-group="configured">
						<tr class="table-light" data-rule-group-header>
							<th colspan="3" scope="rowgroup"><Icon name="settings" class="me-1" />{t(R + 'groupConfigured')}</th>
						</tr>
						{#each configuredRows as entry (entry.key)}{@render ruleRowView(entry, true)}{/each}
					</tbody>
					<tbody data-rule-group="session">
						<tr class="table-light" data-rule-group-header>
							<th colspan="3" scope="rowgroup"><Icon name="pencil" class="me-1" />{t(R + 'groupSession')}</th>
						</tr>
						{#each sessionRows as entry (entry.key)}{@render ruleRowView(entry, false)}{:else}
							<tr><td colspan="3" class="small text-muted">{t(R + 'sessionNone')}</td></tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td colspan="3" class="border-bottom-0">
								<div class="d-flex flex-wrap gap-2 align-items-center">
									{#if addable.length > 0}
										<div bind:this={menu} class="position-relative" role="presentation" onkeydown={onmenukeydown} onfocusout={onmenufocusout}>
											<Button size="sm" icon="plus" class="dropdown-toggle" data-rule-add aria-expanded={menuOpen ? 'true' : 'false'}
												onclick={() => (menuOpen = !menuOpen)}>{t(R + 'add')}</Button>
											{#if menuOpen}
												<ul {@attach (element: HTMLElement) => element.querySelector<HTMLElement>('button.dropdown-item')?.focus()}
													class="dropdown-menu show" tabindex="-1" data-rule-add-menu aria-label={t(R + 'addSelect')} style="position: absolute; left: 0; top: 100%;">
													{#each addGroups as group (group.header)}
														<li><h6 class="dropdown-header">{group.header}</h6></li>
														{#each group.entries as entry (entry.key)}
															<li><button type="button" class="dropdown-item" data-rule-add-item={entry.key} onclick={() => addRule(entry.key)}>{entry.label}</button></li>
														{/each}
													{/each}
													{#if addLoose}
														{#if addGroups.length > 0}<li><hr class="dropdown-divider" /></li>{/if}
														<li><button type="button" class="dropdown-item" data-rule-add-item={LOOSE} onclick={() => addRule(LOOSE)}>{addLoose.label}</button></li>
													{/if}
												</ul>
											{/if}
										</div>
									{/if}
									{#if configuredDiffer}
										<Button size="sm" icon="arrow-back-up" class="ms-auto" data-rules-reset onclick={resetConfigured}>{t(R + 'resetConfigured')}</Button>
									{/if}
								</div>
							</td>
						</tr>
					</tfoot>
				</table>
				<Check id="{id}-automatic" data-automatic checked={automatic} onchange={e => (automatic = e.currentTarget.checked)}>{t(R + 'automatic')}</Check>
			</fieldset>
			<fieldset data-counting-group aria-describedby={scopeKind === 'offers' ? `${id}-counting-locked` : undefined}>
				<legend class="fs-6 fw-bold">{t(R + 'counting')}</legend>
				<Check type="radio" name="{id}-counting" id="{id}-counting-block" data-counting="block" checked={!countThroughVolume} disabled={scopeKind === 'offers'}
					onchange={() => (countChoice = false)}>{t(R + 'counting_block')}</Check>
				<Check type="radio" name="{id}-counting" id="{id}-counting-volume" data-counting="volume" checked={countThroughVolume} disabled={scopeKind === 'offers'}
					onchange={() => (countChoice = true)}>{t(R + 'counting_volume')}</Check>
				<!-- ruling R13: applying the offers is a confirm action, not a change of the counting -->
				{#if scopeKind === 'offers'}<div class="form-text" id="{id}-counting-locked" data-counting-locked>{t(R + 'counting_locked')}</div>{/if}
			</fieldset>
			<fieldset>
				<legend class="fs-6 fw-bold">{t(R + 'overwrite')}</legend>
				{#each scopeKinds as kind (kind)}
					<Check type="radio" name="{id}-scope" id="{id}-scope-{kind}" data-scope={kind} value={kind} checked={scopeKind === kind} onchange={() => (scopeKind = kind)}>
						{scopeText(kind)}
					</Check>
				{/each}
				<div class="form-text">{t(R + 'untyped')}</div>
			</fieldset>
		</div>
		<div class="col-12 col-lg-6">
			<PaginationPreview {pages} {preview} {scopeKind} />
		</div>
	</div>
	{#snippet footer()}
		<Button data-cancel onclick={oncancel}>{t('abbrechen')}</Button>
		<Button variant="success" data-apply onclick={() => onapply(draft, scope)}>{applyText}</Button>
	{/snippet}
</Modal>
