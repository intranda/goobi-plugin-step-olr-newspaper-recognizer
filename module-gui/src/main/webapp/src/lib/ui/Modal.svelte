<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { getApp } from '../recognizer.svelte';

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

	// focus the dialog so that Escape works and screen readers announce it
	const focus = (element: HTMLElement) => element.focus();
</script>

<div {@attach focus} class="modal fade show d-block" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="{id}-title"
	onkeydown={e => e.key === 'Escape' && onclose()} {...rest}>
	<div class={['modal-dialog modal-dialog-scrollable', size && `modal-${size}`]} role="document">
		<div class="modal-content">
			<div class="modal-header bg-primary text-white">
				<h4 class="modal-title" id="{id}-title">{title}</h4>
				<button type="button" class="btn text-white" title={t('cancel')} aria-label={t('cancel')} onclick={onclose}>
					<span aria-hidden="true" class="icon-wrapper"><svg><use href={GoobiIcons.iconHref('x')} /></svg></span>
				</button>
			</div>
			<div class="modal-body">{@render children()}</div>
			<div class="modal-footer">{@render footer?.()}</div>
		</div>
	</div>
</div>
<div class="modal-backdrop fade show"></div>
