<script lang="ts">
	import { shortcutSection } from './lib/shortcutSection';
	import { Recognizer, setApp } from './lib/recognizer.svelte';
	import BoxTitle from './lib/ui/BoxTitle.svelte';
	import TitleAction from './lib/ui/TitleAction.svelte';
	import HelpBar from './lib/HelpBar.svelte';
	import ActionsMenu from './lib/ActionsMenu.svelte';
	import Notices from './lib/Notices.svelte';
	import BlockRow from './lib/BlockRow.svelte';
	import LooseRow from './lib/LooseRow.svelte';
	import Dialogs from './lib/Dialogs.svelte';
	import type { PluginProps } from './types';

	interface Props {
		config: PluginProps;
	}

	/**
	 * The plugin page: a Goobi box with the title bar actions, the notices and the grid of blocks and pages.
	 * The configuration is taken over once, when the page is built; a later change of it is not followed.
	 */
	let { config }: Props = $props();

	// svelte-ignore state_referenced_locally
	const app = new Recognizer(config);
	setApp(app);
	const { t } = app;
	const P = 'plugin_newspaperRecognizer_';

	// the page is built in the browser only: no mount hook needed, the request starts with the component
	app.listenToFaces();
	app.loadMessages();

	// the usage hints are a section of goobi's shortcuts dialog; the effect follows the language of the loaded messages
	$effect(() => {
		const section = shortcutSection(t);
		const sections = (window.goobiShortcutSections ??= []);
		sections.push(section);
		return () => {
			const i = sections.indexOf(section);
			if (i >= 0) sections.splice(i, 1);
		};
	});

	const onpointerend = () => {
		// after the click, which follows the pointerup in the same task
		setTimeout(() => {
			app.pointerDown = false;
			app.commitDeferredEdit();
		}, 0);
	};

	// close the actions menu on a click outside of it or on Escape
	function onclick(e: MouseEvent) {
		const target = (e.target as Element);
		if (app.actionsOpen && !target.closest('.dropdown-menu') && !target.closest('[aria-haspopup]')) {
			app.actionsOpen = false;
		}
	}
</script>

<!-- an edited label field loses its focus on mousedown; its edit is committed with the click, not before, because a re-render
	between mousedown and mouseup makes the browser drop the click -->
<svelte:document
	onpointerdowncapture={() => (app.pointerDown = true)}
	onpointerupcapture={onpointerend}
	onpointercancelcapture={onpointerend}
	onclickcapture={() => app.commitDeferredEdit()}
	{onclick}
	onkeydown={e => app.actionsOpen && e.key === 'Escape' && (app.actionsOpen = false)} />

<div {@attach el => { app.root = el; }} aria-busy={!app.msgsLoaded || app.ajaxBusy ? 'true' : 'false'}>
	{#if !app.msgsLoaded}
		<div class="box box--neutral section">
			<div class="box__content">
				<BoxTitle title={app.title} icon="puzzle" />
				<div class="section-body-padded" style="background-color:#eee;">
					<div class="text-center">
						<img src="template/img/goobi/ajaxloader2.gif" alt="" style="max-height: 140px;" />
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="box box--neutral section">
			<div class="box__content">
				<BoxTitle title={app.title} icon="puzzle">
					{#if app.ajaxBusy}
						<span class="me-2"><img src="template/img/goobi/ajaxloader2.gif" alt="" style="height: 20px;" /></span>
					{/if}
					<ActionsMenu />
					<TitleAction icon="x" disabled={app.saveInFlight} onclick={() => app.exit()} title={t('pluginLeave')} data-bs-toggle="tooltip" />
					<TitleAction icon="device-floppy" disabled={app.saveInFlight || !app.hasUnsaved} dot={app.hasUnsaved} onclick={() => app.save()} title={t('save')}
						aria-label={app.hasUnsaved ? `${t('save')} (${t('plugin_newspaperRecognizer_unsaved_save')})` : t('save')} data-bs-toggle="tooltip" />
					<TitleAction icon="logout" disabled={app.saveInFlight || !app.hasUnsaved} onclick={() => app.saveAndExit()} title={t('pluginSaveAndLeave')} data-bs-toggle="tooltip" />
				</BoxTitle>

				<HelpBar />

				<div>
					<Notices />

					<div class="section-body">
						<div class="issues">
							{#each app.rows as row (row.key)}
								{#if row.loose}<LooseRow {row} />{:else}<BlockRow {row} />{/if}
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<Dialogs />

	<!-- the spinner of a running request is an image without text; this tells a screen reader that something is going on -->
	<div class="visually-hidden" role="status">{#if app.msgsLoaded && app.ajaxBusy}{t(P + 'busy')}{/if}</div>
</div>
