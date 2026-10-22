<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import Icon from './ui/Icon.svelte';

	/** The sticky line below the title with the mouse and keyboard hints; can be hidden. */
	const app = getApp();
	const { t } = app;
	const P = 'plugin_newspaperRecognizer_pagination_help_';
	const hints = ['small', 'big', 'supplement', 'zoom'];
</script>

<div data-help class="newspaper-help">
	{#if !app.helpHidden}
		<div data-help-hints class="newspaper-help__hints">
			<Icon name="hand-click" />
			{#each hints as hint (hint)}
				<span><b class="me-1">{t(P + hint)}</b> {t(P + hint + 'Text')}</span>
			{/each}
			<button type="button" data-help-close class="btn btn-blank btn-sm ms-auto p-0 px-1" onclick={() => app.hideHelp()}
				title={t(P + 'hide')} aria-label={t(P + 'hide')}>
				<Icon name="x" />
			</button>
		</div>
	{/if}

	<!-- out of the flow, so that neither its appearing nor its going shifts the blocks below -->
	{#if app.thumbnails.busy}
		<progress class="newspaper-help__progress" max={app.thumbnails.requested} value={app.thumbnails.settled}
			title="{t('plugin_newspaperRecognizer_loadingImages')}..." aria-label={t('plugin_newspaperRecognizer_loadingImages')}></progress>
	{/if}
</div>
