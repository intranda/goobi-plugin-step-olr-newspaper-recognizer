<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import TitleAction from './ui/TitleAction.svelte';

	/** The "more" menu of the title bar: pagination rules and the actions that start over. Closes on a click outside or Escape (see App). */
	const app = getApp();
	const { t } = app;
	const P = 'plugin_newspaperRecognizer_';
</script>

<!-- the menu comes first: the button must stay the last child, else Goobi's :not(:last-child) margin moves it -->
<div class="position-relative me-2">
	{#if app.actionsOpen}
		<ul class="dropdown-menu dropdown-menu-end show" style="position: absolute; right: 0; top: 100%;">
			{#if app.settings.enabled}
				<li><button type="button" data-action-pagination class="dropdown-item" onclick={() => app.runAction(() => app.openRulesDialog(null))}>{t(P + 'pagination_rules_menu')}</button></li>
				<li><hr class="dropdown-divider" /></li>
			{/if}
			<li><button type="button" class="dropdown-item" onclick={() => app.runAction(() => app.askResetToAnalysis())}>{t(P + 'action_takeAnalysis')}</button></li>
			<li><button type="button" class="dropdown-item" onclick={() => app.runAction(() => app.askRemoveAllBlocks())}>{t(P + 'removeAllBlocks')}</button></li>
			<li><hr class="dropdown-divider" /></li>
			<li><button type="button" class="dropdown-item" onclick={() => app.runAction(() => app.askRecompute())}>{t(P + 'action_restartAnalysis')}</button></li>
		</ul>
	{/if}
	<TitleAction icon="dots-vertical" disabled={app.saveInFlight} onclick={() => app.toggleActions()} title={t(P + 'actions_more')} aria-label={t(P + 'actions_more')}
		aria-haspopup="true" aria-expanded={app.actionsOpen ? 'true' : 'false'} />
</div>
