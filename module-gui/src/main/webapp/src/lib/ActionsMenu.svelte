<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import TitleAction from './ui/TitleAction.svelte';
	import { dismiss } from './dismiss';

	/**
	 * The "more" menu of the title bar: pagination rules and the actions that start over. Closes on a click outside or Escape.
	 * A menu in the sense of ARIA: the button opens it (also with the arrow down key), the focus moves to the first entry, the arrow keys
	 * move within it (Home and End jump to the ends), Escape or leaving it with Tab closes it, and the focus returns to the button.
	 */
	const app = getApp();
	const { t } = app;
	const P = 'plugin_newspaperRecognizer_';
	const id = $props.id();

	let wrapper: HTMLElement | undefined = $state();

	let trigger: HTMLButtonElement | null = $state(null);
	const items = (menu: HTMLElement) => [...menu.querySelectorAll<HTMLElement>('button.dropdown-item')];

	const focusFirst = (menu: HTMLElement) => items(menu)[0]?.focus();

	// the focus goes back to the button first, so that a dialog the action opens returns to it when it closes
	const run = (action: () => void) => {
		trigger?.focus();
		app.runAction(action);
	};

	function onkeydown(e: KeyboardEvent & { currentTarget: HTMLElement }) {
		if (e.key === 'Escape') {
			app.actionsOpen = false;
			trigger?.focus();
			return;
		}
		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
			return;
		}
		e.preventDefault();
		const entries = items(e.currentTarget);
		const at = entries.indexOf(document.activeElement as HTMLElement);
		const next = e.key === 'Home' ? 0
			: e.key === 'End' ? entries.length - 1
				: e.key === 'ArrowDown' ? (at + 1) % entries.length : (at - 1 + entries.length) % entries.length;
		entries[next]?.focus();
	}

	// the arrow down key on the closed button opens the menu
	function onbuttonkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown' && !app.actionsOpen && !app.saveInFlight) {
			e.preventDefault();
			app.toggleActions();
		}
	}

	// a click on the button (it toggles by itself) or in a menu or on a popup trigger elsewhere does not close it
	const closeOutside = () => dismiss(
		target => !!wrapper?.contains(target) || !(target instanceof Element) || !!target.closest('.dropdown-menu, [aria-haspopup]'),
		() => (app.actionsOpen = false),
		'click',
	);

	// Tab to something outside of the menu closes it
	function onfocusout(e: FocusEvent) {
		const target = e.relatedTarget;
		if (app.actionsOpen && target instanceof Node && !wrapper?.contains(target)) {
			app.actionsOpen = false;
		}
	}
</script>

<div bind:this={wrapper} class="position-relative" {onfocusout}>
	<TitleAction bind:element={trigger} icon="dots-vertical" disabled={app.saveInFlight} onclick={() => app.toggleActions()} onkeydown={onbuttonkeydown} title={t(P + 'actions_more')} aria-label={t(P + 'actions_more')}
		aria-haspopup="menu" aria-controls="{id}-menu" aria-expanded={app.actionsOpen ? 'true' : 'false'} />
	{#if app.actionsOpen}
		<!-- after the button, so that the Tab order is button, entries; Goobi's margin for a title button that is not the last child is switched off with me-0 -->
		<ul {@attach focusFirst} {@attach closeOutside} {onkeydown} id="{id}-menu" role="menu" aria-label={t(P + 'actions_more')} class="dropdown-menu dropdown-menu-end show" style="position: absolute; right: 0; top: 100%;">
			{#if app.settings.enabled}
				<li role="none"><button type="button" role="menuitem" data-action-pagination class="dropdown-item" onclick={() => run(() => app.openRulesDialog(null))}>{t(P + 'pagination_rules_menu')}</button></li>
			{/if}
			{#if app.unsaved.labels.length > 0}
				<li role="none"><button type="button" role="menuitem" data-action-restore class="dropdown-item" onclick={() => run(() => app.askRestoreLabels())}>{t(P + 'pagination_changed_restore')}</button></li>
			{/if}
			{#if app.settings.enabled || app.unsaved.labels.length > 0}
				<li role="none"><hr class="dropdown-divider" /></li>
			{/if}
			<li role="none"><button type="button" role="menuitem" class="dropdown-item" onclick={() => run(() => app.askResetToAnalysis())}>{t(P + 'action_takeAnalysis')}</button></li>
			<li role="none"><button type="button" role="menuitem" class="dropdown-item" onclick={() => run(() => app.askRemoveAllBlocks())}>{t(P + 'removeAllBlocks')}</button></li>
			<li role="none"><hr class="dropdown-divider" /></li>
			<li role="none"><button type="button" role="menuitem" class="dropdown-item" onclick={() => run(() => app.askRecompute())}>{t(P + 'action_restartAnalysis')}</button></li>
		</ul>
	{/if}
</div>
