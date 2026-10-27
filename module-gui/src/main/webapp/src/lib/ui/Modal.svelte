<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { getApp } from '../recognizer.svelte';
	import Icon from './Icon.svelte';

	interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'children'> {
		title: string;
		size?: string;
		onclose: () => void;
		children: Snippet;
		footer?: Snippet;
	}

	/** The modal markup Goobi uses (e.g. institution_edit.xhtml): Bootstrap modal, primary header, footer buttons. */
	let { title, size = '', onclose, children, footer, ...rest }: Props = $props();

	const { t } = getApp();
	const id = $props.id();

	const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

	// focus the dialog so that Escape works and screen readers announce it; on closing the focus goes back to where it was
	const focus = (element: HTMLElement) => {
		const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		element.focus();
		return () => {
			if (opener?.isConnected) {
				opener.focus({ preventScroll: true });
			}
		};
	};

	/* Escape closes; Tab and Shift+Tab stay within the dialog (the page behind it is not reachable) */
	function onkeydown(e: KeyboardEvent & { currentTarget: HTMLElement }) {
		if (e.key === 'Escape') {
			onclose();
			return;
		}
		if (e.key !== 'Tab') {
			return;
		}
		const dialog = e.currentTarget;
		const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => !el.matches(':disabled') && el.getClientRects().length > 0);
		if (items.length === 0) {
			e.preventDefault();
			return;
		}
		const first = items[0];
		const last = items[items.length - 1];
		const active = document.activeElement;
		if (e.shiftKey && (active === first || active === dialog || !dialog.contains(active))) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
			e.preventDefault();
			first.focus();
		}
	}
</script>

<div {@attach focus} class="modal fade show d-block" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="{id}-title"
	{onkeydown} {...rest}>
	<div class={['modal-dialog modal-dialog-scrollable', size && `modal-${size}`]} role="document">
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
</div>
<div class="modal-backdrop fade show"></div>
