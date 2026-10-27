<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import Button from './ui/Button.svelte';
	import Icon from './ui/Icon.svelte';
	import NoticeEntry from './ui/NoticeEntry.svelte';
	import HiddenPopover from './HiddenPopover.svelte';

	/**
	 * What the user may want to know before saving, gathered in one section that is collapsed by default: what blocks saving, what is
	 * waiting for a decision, and information. An entry is there exactly as long as its condition holds; the section is always shown ("keine"
	 * without entries), so that the blocks below it do not move when the first entry appears.
	 */
	const app = getApp();
	const { t, fmt } = app;
	const P = 'plugin_newspaperRecognizer_';

	const jump = (count: number) => t(count > 1 ? P + 'validation_jumpNext' : P + 'validation_jump');

	// one entry for the configuration errors (listed together), one per validation problem, per decision and per piece of information
	const blocking = $derived((app.configErrors.length > 0 ? 1 : 0) + app.validationProblems.length);
	const decide = $derived((app.showMissingBanner ? 1 : 0) + (app.showOffersBanner ? 1 : 0));
	const info = $derived((app.unsaved.any ? 1 : 0) + (app.hiddenBlocks.length > 0 ? 1 : 0) + (app.volumeHidden.structures.length > 0 ? 1 : 0)
		+ app.otherNotices.length);
	// opened without entries, the section shows nothing below its row
	const shown = $derived(app.noticesOpen && blocking + decide + info > 0);

	/** the parts of the unsaved entry that are not zero, e.g. "3 Blöcke, 4 Seitenbezeichnungen" */
	const unsavedText = $derived.by(() => {
		const { count, removed, labels, volume, pages } = app.unsaved;
		const blocks = count + removed;
		const parts = [
			blocks > 0 && (blocks === 1 ? t(P + 'unsaved_blocksOne') : fmt(P + 'unsaved_blocks', blocks)),
			pages.removed > 0 && (pages.removed === 1 ? t(P + 'unsaved_pagesDeletedOne') : fmt(P + 'unsaved_pagesDeleted', pages.removed)),
			labels.length > 0 && (labels.length === 1 ? t(P + 'unsaved_labelsOne') : fmt(P + 'unsaved_labels', labels.length)),
			volume && t(P + 'unsaved_volume'),
		].filter(Boolean);
		return fmt(P + 'unsaved_entry', parts.join(', '));
	});
</script>

<div class="border-bottom" data-notices>
	<button type="button" class="btn btn-blank w-100 text-start d-flex flex-wrap align-items-center justify-content-start gap-2 px-3 py-2 rounded-0"
		aria-expanded={app.noticesOpen ? 'true' : 'false'} aria-controls={shown ? 'newspaper-notices' : undefined} data-notices-toggle
		onclick={() => (app.noticesOpen = !app.noticesOpen)}>
		<Icon name={app.noticesOpen ? 'chevron-down' : 'chevron-right'} />
		<b>{t(P + 'notices_title')}</b>
		{#if blocking > 0}<span class="text-danger">· {blocking === 1 ? t(P + 'notices_blockingOne') : fmt(P + 'notices_blocking', blocking)}</span>{/if}
		{#if decide > 0}<span class="text-muted">· {fmt(P + 'notices_decide', decide)}</span>{/if}
		{#if info > 0}<span class="text-muted">· {fmt(P + 'notices_info', info)}</span>{/if}
		{#if blocking + decide + info === 0}<span class="text-muted">· {t(P + 'notices_none')}</span>{/if}
	</button>

	{#if shown}
		<div id="newspaper-notices" class="px-3 pb-3 d-flex flex-column gap-3">
			{#if blocking > 0}
				<div class="d-flex flex-column gap-2" data-notices-group="blocking">
					<div class="notices-group text-danger">{t(P + 'notices_groupBlocking')}</div>
					{#if app.configErrors.length > 0}
						<NoticeEntry icon="alert-circle" tone="text-danger">
							{t(P + 'configError')}
							<ul class="mb-0">{#each app.configErrors as error (error)}<li>{error}</li>{/each}</ul>
						</NoticeEntry>
					{/if}
					{#each app.validationProblems as problem (problem.name)}
						<NoticeEntry icon="alert-circle" tone="text-danger">
							{fmt(problem.key, problem.count)}
							{#snippet actions()}
								<Button size="sm" data-jump-problem={problem.name} onclick={() => app.jumpToProblem(problem.name)}>{jump(problem.count)}</Button>
							{/snippet}
						</NoticeEntry>
					{/each}
				</div>
			{/if}

			{#if decide > 0}
				<div class="d-flex flex-column gap-2" data-notices-group="decide">
					<div class="notices-group text-primary">{t(P + 'notices_groupDecide')}</div>
					{#if app.showMissingBanner}
						<NoticeEntry icon="list-numbers" tone="text-primary" data-notice-missing>
							{app.missingText()}
							{#snippet actions()}
								<Button variant="primary" size="sm" class="text-nowrap" data-generate onclick={() => app.generateMissing()}>{t(P + 'pagination_missing_generate')}</Button>
								<Button size="sm" class="text-nowrap" data-jump onclick={() => app.jumpToMissing()}>
									{t(app.missingRunList.length > 1 ? P + 'pagination_missing_jumpNext' : P + 'pagination_missing_jump')}
								</Button>
								<Button size="sm" class="text-nowrap" data-decline onclick={() => app.declineMissing()}>{t(P + 'pagination_missing_decline')}</Button>
							{/snippet}
						</NoticeEntry>
					{/if}
					{#if app.showOffersBanner}
						<NoticeEntry icon="list-numbers" tone="text-primary" data-notice-offers>
							{fmt(P + 'pagination_offers_text', app.offers.length, app.offersPageCount)}
							{#snippet actions()}
								<Button variant="primary" size="sm" class="text-nowrap" data-offers-apply onclick={() => app.acceptAllOffers()}>
									{fmt(P + 'pagination_offers_apply', app.offersPageCount)}
								</Button>
								<Button size="sm" class="text-nowrap" data-offers-review onclick={() => app.openRulesDialog(null, 'offers')}>{t(P + 'pagination_offers_review')}</Button>
								<Button size="sm" class="text-nowrap" data-offers-jump onclick={() => app.jumpToNextOffer()}>{t(P + 'pagination_offers_jump')}</Button>
								<Button size="sm" class="text-nowrap" data-offers-hide onclick={() => app.dismissAllOffers()}>{t(P + 'pagination_offers_hide')}</Button>
							{/snippet}
						</NoticeEntry>
					{/if}
				</div>
			{/if}

			{#if info > 0}
				<div class="d-flex flex-column gap-2" data-notices-group="info">
					<div class="notices-group text-muted">{t(P + 'notices_groupInfo')}</div>
					{#if app.unsaved.any}
						<NoticeEntry icon="pencil" tone="text-muted" data-notice-unsaved>
							{unsavedText}
							{#snippet actions()}
								{#if app.unsavedTargets.length > 0}
									<Button size="sm" class="text-nowrap" data-unsaved-next onclick={() => app.jumpToNextUnsaved()}>{t(P + 'unsaved_next')}</Button>
								{/if}
							{/snippet}
						</NoticeEntry>
					{/if}
					{#if app.hiddenBlocks.length > 0}
						<NoticeEntry icon="info-circle" tone="text-muted" data-notice-hidden>
							{fmt(P + 'hidden_notice', app.hiddenBlocks.length)}
							{#snippet actions()}
								<Button size="sm" class="text-nowrap" data-jump-hidden onclick={() => app.jumpToNextHidden()}>{jump(app.hiddenBlocks.length)}</Button>
							{/snippet}
						</NoticeEntry>
					{/if}
					{#if app.volumeHidden.structures.length > 0}
						<NoticeEntry icon="info-circle" tone="text-muted" data-notice-volume-hidden>
							{fmt(P + 'notice_volumeHidden', app.volumeHidden.structures.length)}
							{#snippet actions()}
								<Button size="sm" class="text-nowrap" onclick={() => app.toggleHidden('volume')}>{t(P + 'hidden_show')}</Button>
								{#if app.openHidden === 'volume'}
									<HiddenPopover summary={app.volumeHidden} align="left" onclose={() => app.toggleHidden('volume')} />
								{/if}
							{/snippet}
						</NoticeEntry>
					{/if}
					{#each app.otherNotices as notice (notice.key + JSON.stringify(notice.params ?? []))}
						<NoticeEntry icon="info-circle" tone="text-muted">{app.formatNotice(notice)}</NoticeEntry>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
