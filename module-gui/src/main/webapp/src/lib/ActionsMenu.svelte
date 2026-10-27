<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import TitleAction from './ui/TitleAction.svelte';

	/**
	 * The "more" menu of the title bar: pagination rules and the actions that start over. Closes on a click outside or Escape (see App).
	 * Keyboard: the focus moves to the first entry when the menu opens, the arrow keys move within it, Escape or leaving it with Tab closes it,
	 * and the focus returns to the button.
	 */
	const app = getApp();
	const { t } = app;
	const P = 'plugin_newspaperRecognizer_';

	let wrapper: HTMLElement | undefined = $state();

	const trigger = () => wrapper?.querySelector<HTMLElement>('[aria-haspopup]');
	const items = (menu: HTMLElement) => [...menu.querySelectorAll<HTMLElement>('button.dropdown-item')];

	const focusFirst = (menu: HTMLElement) => items(menu)[0]?.focus();

	// the focus goes back to the button first, so that a dialog the action opens returns to it when it closes
	const run = (action: () => void) => {
		trigger()?.focus();
		app.runAction(action);
	};

	function onkeydown(e: KeyboardEvent & { currentTarget: HTMLElement }) {
		if (e.key === 'Escape') {
			app.actionsOpen = false;
			trigger()?.focus();
			return;
		}
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') {
			return;
		}
		e.preventDefault();
		const entries = items(e.currentTarget);
		const at = entries.indexOf(document.activeElement as HTMLElement);
		const next = e.key === 'ArrowDown' ? (at + 1) % entries.length : (at - 1 + entries.length) % entries.length;
		entries[next]?.focus();
	}

	// Tab to something outside of the menu closes it
	function onfocusout(e: FocusEvent) {
		const target = e.relatedTarget;
		if (app.actionsOpen && target instanceof Node && !wrapper?.contains(target)) {
			app.actionsOpen = false;
		}
	}
</script>

<div bind:this={wrapper} class="position-relative me-2" {onfocusout}>
	<TitleAction class="me-0" icon="dots-vertical" disabled={app.saveInFlight} onclick={() => app.toggleActions()} title={t(P + 'actions_more')} aria-label={t(P + 'actions_more')}
		aria-haspopup="true" aria-expanded={app.actionsOpen ? 'true' : 'false'} />
	{#if app.actionsOpen}
		<!-- after the button, so that the Tab order is button, entries; Goobi's margin for a title button that is not the last child is switched off with me-0 -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions (the keys are handled for the buttons inside, which have the focus) -->
		<ul {@attach focusFirst} {onkeydown} class="dropdown-menu dropdown-menu-end show" style="position: absolute; right: 0; top: 100%;">
			{#if app.settings.enabled}
				<li><button type="button" data-action-pagination class="dropdown-item" onclick={() => run(() => app.openRulesDialog(null))}>{t(P + 'pagination_rules_menu')}</button></li>
				<li><hr class="dropdown-divider" /></li>
			{/if}
			{#if app.unsaved.labels.length > 0}
				<li><button type="button" data-action-restore class="dropdown-item" onclick={() => run(() => app.askRestoreLabels())}>{t(P + 'pagination_changed_restore')}</button></li>
			{/if}
			<li><button type="button" class="dropdown-item" onclick={() => run(() => app.askResetToAnalysis())}>{t(P + 'action_takeAnalysis')}</button></li>
			<li><button type="button" class="dropdown-item" onclick={() => run(() => app.askRemoveAllBlocks())}>{t(P + 'removeAllBlocks')}</button></li>
			<li><hr class="dropdown-divider" /></li>
			<li><button type="button" class="dropdown-item" onclick={() => run(() => app.askRecompute())}>{t(P + 'action_restartAnalysis')}</button></li>
		</ul>
	{/if}
</div>
