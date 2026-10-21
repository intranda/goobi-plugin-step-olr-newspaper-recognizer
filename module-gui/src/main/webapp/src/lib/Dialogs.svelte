<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import TypePatternDialog from './dialogs/TypePatternDialog.svelte';
	import ContinueDialog from './dialogs/ContinueDialog.svelte';
	import PaginationDialog from './dialogs/PaginationDialog.svelte';
	import ConflictDialog from './dialogs/ConflictDialog.svelte';
	import Modal from './ui/Modal.svelte';
	import Button from './ui/Button.svelte';
	import Icon from './ui/Icon.svelte';
	import type { Page, PaginationSettings, RulesScope } from '../types';

	/** Whatever modal is open: the dialogs of a block or of the volume, the question about additional data, the confirmation of a destructive action. */
	const app = getApp();
	const { t } = app;
	const dialog = $derived(app.dialog);
	const cancel = () => app.closeDialog();
</script>

{#if dialog?.kind === 'pattern'}
	<TypePatternDialog pages={app.pages} startRef={dialog.ref} typeOptions={dialog.typeOptions} oncancel={cancel} onapply={(pattern: string[]) => app.applyPattern(pattern)} />
{:else if dialog?.kind === 'continue'}
	<ContinueDialog pages={app.pages} startRef={dialog.ref} typeOptions={dialog.typeOptions} oncancel={cancel} onapply={(pages: Page[]) => app.applyGenerated(pages)} />
{:else if dialog?.kind === 'rules'}
	<PaginationDialog pages={app.pages} settings={app.settings} types={dialog.types} first={dialog.first} oncancel={cancel}
		onapply={(settings: PaginationSettings, scope: RulesScope) => app.applyRules(settings, scope)} />
{/if}

{#if app.pendingChange}
	<ConflictDialog conflicts={app.pendingChange.conflicts} total={app.pendingChange.options.total} oncancel={() => app.cancelConflicts()}
		onconfirm={(choices: Record<string, string>) => app.resolveConflicts(choices)} />
{/if}

{#if app.confirmation}
	{@const confirmation = app.confirmation}
	<Modal title={t(confirmation.title)} onclose={() => app.cancelConfirmation()}>
		<p class="mb-0">{t(confirmation.text)}</p>
		{#snippet footer()}
			<Button onclick={() => app.cancelConfirmation()}>{t('abbrechen')}</Button>
			<Button variant="danger" onclick={() => app.runConfirmation()}>
				{#if confirmation.icon}<Icon name={confirmation.icon} class="me-2" />{/if}
				<span>{t(confirmation.button)}</span>
			</Button>
		{/snippet}
	</Modal>
{/if}
