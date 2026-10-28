<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLDialogAttributes } from 'svelte/elements';
	import { getApp } from '../recognizer.svelte';
	import Icon from './Icon.svelte';

	interface Props extends Omit<HTMLDialogAttributes, 'title' | 'children'> {
		title: string;
		size?: string;
		onclose: () => void;
		children: Snippet;
		footer?: Snippet;
	}

	/** The modal markup Goobi uses (e.g. institution_edit.xhtml): Bootstrap modal, primary header, footer buttons, on a native dialog. */
	let { title, size = '', onclose, children, footer, ...rest }: Props = $props();

	const { t } = getApp();
	const id = $props.id();

	// the browser makes the page behind inert and keeps Tab within the dialog; on closing the focus goes back to where it was
	const open = (dialog: HTMLDialogElement) => {
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		dialog.showModal();
		// the dialog itself, not its first control: screen readers announce the title, the first Tab leads into it
		dialog.focus();
		return () => {
			if (opener?.isConnected) {
				opener.focus({ preventScroll: true });
			}
		};
	};

	// Escape asks the dialog to cancel; whoever opened it decides (and removes it)
	function oncancel(e: Event) {
		e.preventDefault();
		onclose();
	}
</script>

<dialog {@attach open} class="modal newspaper-modal" tabindex="-1" aria-labelledby="{id}-title" {oncancel} {...rest}>
	<div class={['modal-dialog modal-dialog-scrollable', size && `modal-${size}`]}>
		<div class="modal-content">
			<div class="modal-header bg-primary text-white">
				<h4 class="modal-title" id="{id}-title">{title}</h4>
				<button type="button" class="btn text-white" title={t('cancel')} aria-label={t('cancel')} onclick={onclose}>
					<Icon name="x" />
				</button>
			</div>
			<div class="modal-body">{@render children()}</div>
			<div class="modal-footer">{@render footer?.()}</div>
		</div>
	</div>
</dialog>
