<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import Alert from './ui/Alert.svelte';
	import Button from './ui/Button.svelte';
	import NoticeRow from './ui/NoticeRow.svelte';
	import HiddenPopover from './HiddenPopover.svelte';

	/** What the user should know before saving: configuration errors, pagination hints, additional data, validation problems. */
	const app = getApp();
	const { t, fmt } = app;
	const P = 'plugin_newspaperRecognizer_';

	const jump = (count: number) => t(count > 1 ? P + 'validation_jumpNext' : P + 'validation_jump');
</script>

{#if app.configErrors.length > 0}
	<Alert type="danger">
		{t(P + 'configError')}
		<ul class="mb-0">{#each app.configErrors as error (error)}<li>{error}</li>{/each}</ul>
	</Alert>
{/if}

{#if app.showMissingBanner}
	<Alert data-banner-missing class="d-flex flex-wrap align-items-center gap-3 mb-0">
		<span>{app.missingText()}</span>
		<Button variant="primary" size="sm" class="text-nowrap" data-generate onclick={() => app.generateMissing()}>{t(P + 'pagination_missing_generate')}</Button>
		<Button size="sm" class="text-nowrap" data-decline onclick={() => app.declineMissing()}>{t(P + 'pagination_missing_decline')}</Button>
		<Button size="sm" class="text-nowrap" data-jump onclick={() => app.jumpToMissing()}>
			{t(app.missingRunList.length > 1 ? P + 'pagination_missing_jumpNext' : P + 'pagination_missing_jump')}
		</Button>
	</Alert>
{/if}

{#if app.showOffersBanner}
	<Alert data-banner-offers class="d-flex flex-wrap align-items-center gap-3 mb-0">
		<span>{fmt(P + 'pagination_offers_text', app.offers.length, app.offersPageCount)}</span>
		<Button variant="primary" size="sm" class="text-nowrap" data-offers-apply onclick={() => app.acceptAllOffers()}>
			{fmt(P + 'pagination_offers_apply', app.offersPageCount)}
		</Button>
		<Button size="sm" class="text-nowrap" data-offers-review onclick={() => app.openRulesDialog(null, 'offers')}>{t(P + 'pagination_offers_review')}</Button>
		<Button size="sm" class="text-nowrap" data-offers-jump onclick={() => app.jumpToNextOffer()}>{t(P + 'pagination_offers_jump')}</Button>
		<Button size="sm" class="text-nowrap" data-offers-hide onclick={() => app.dismissAllOffers()}>{t(P + 'pagination_offers_hide')}</Button>
	</Alert>
{/if}

{#if app.showChangedBanner}
	<Alert data-banner-changed class="d-flex flex-wrap align-items-center gap-3 mb-0">
		<span>{app.changedText()}</span>
		<Button size="sm" class="text-nowrap" data-restore onclick={() => app.restoreLabels()}>{t(P + 'pagination_changed_restore')}</Button>
	</Alert>
{/if}

{#if app.otherNotices.length > 0}
	<Alert type="warning">
		<ul class="mb-0">{#each app.otherNotices as notice (notice.key + JSON.stringify(notice.params ?? []))}<li>{app.formatNotice(notice)}</li>{/each}</ul>
	</Alert>
{/if}

{#if app.hiddenBlocks.length > 0 || app.volumeHidden.structures.length > 0}
	<Alert>
		<ul class="mb-0 list-unstyled d-flex flex-column gap-1">
			{#if app.hiddenBlocks.length > 0}
				<NoticeRow text={fmt(P + 'hidden_notice', app.hiddenBlocks.length)} button={jump(app.hiddenBlocks.length)} onclick={() => app.jumpToNextHidden()} />
			{/if}
			{#if app.volumeHidden.structures.length > 0}
				<NoticeRow text={fmt(P + 'notice_volumeHidden', app.volumeHidden.structures.length)} button={t(P + 'hidden_show')} onclick={() => app.toggleHidden('volume')}>
					{#if app.openHidden === 'volume'}
						<HiddenPopover summary={app.volumeHidden} align="left" onclose={() => app.toggleHidden('volume')} />
					{/if}
				</NoticeRow>
			{/if}
		</ul>
	</Alert>
{/if}

{#if !app.validation.valid}
	<Alert type="danger">
		{t(P + 'validation_title')}
		<ul class="mb-0 list-unstyled d-flex flex-column gap-1 mt-1">
			{#each app.validationProblems as problem (problem.name)}
				<NoticeRow text={fmt(problem.key, problem.count)} button={jump(problem.count)} onclick={() => app.jumpToProblem(problem.name)} />
			{/each}
		</ul>
	</Alert>
{/if}
