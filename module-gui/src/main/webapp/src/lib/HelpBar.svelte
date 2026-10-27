<script lang="ts">
	import { getApp } from './recognizer.svelte';

	/** The sticky element below the title: only the thumbnail loading progress is shown (the usage hints are in goobi's shortcuts dialog). */
	const app = getApp();
	const { t } = app;
</script>

<div data-help class="newspaper-help">
	<!-- out of the flow, so that neither its appearing nor its going shifts the blocks below -->
	{#if app.thumbnails.busy}
		<progress class="newspaper-help__progress" max={app.thumbnails.requested} value={app.thumbnails.settled}
			title="{t('plugin_newspaperRecognizer_loadingImages')}..." aria-label={t('plugin_newspaperRecognizer_loadingImages')}></progress>
	{/if}
</div>
