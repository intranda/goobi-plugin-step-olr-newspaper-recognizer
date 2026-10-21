<script lang="ts">
	import { getApp } from './recognizer.svelte';
	import { isCounting } from '../../logic/labels.mjs';
	import type { LabelMode } from '../types';

	interface Props {
		index: number;
	}

	/**
	 * The label of a page under its thumbnail; the input is unobtrusive (border on hover and focus), see the pagination v2 design, Typing.
	 * Typing previews the follow-up labels (app.preview holds the typed text); Enter, Tab or leaving the field decides.
	 */
	let { index }: Props = $props();

	const app = getApp();
	const { t } = app;

	const page = $derived(app.pages[index]);
	const preview = $derived(app.preview?.result ?? null);
	// the text in the field is the user's, not the page's: set while this field is the one being typed in
	const typed = $derived(app.preview && app.preview.index === index ? app.preview : null);
	const own = $derived(!!app.ownFlags[index]);
	const follow = $derived(app.ownFlags[index]);
	const changed = $derived(page.label !== page.metsLabel);
	// only pages whose label really changes are highlighted
	const previewed = $derived(!typed && !!preview && preview.run.includes(index) && preview.pages[index].label !== page.label);
	const stateClasses = $derived([
		previewed && 'is-preview',
		// a page without counting label that ends a run has no own numbering to point out
		preview && preview.stop === index && isCounting(page.label) && 'is-stop',
		own && 'is-own',
		changed && 'is-changed',
	]);
	// what the field shows: the typed text, the would-be result while another page is typed, else the label
	const shown = $derived(typed ? typed.text : previewed ? preview?.pages[index].label : page.label);

	const oninput = (e: Event & { currentTarget: HTMLInputElement }) => app.previewLabelAt(index, e.currentTarget.value, 'follow');

	/* Enter: this page and the following ones that count on; Shift: this page only; Ctrl: on to the end of the stream */
	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			// Enter is a decision even without an edit (empty field: follow the page before, Ctrl: count on to the end of the stream)
			finish(e.ctrlKey || e.metaKey ? 'toEnd' : e.shiftKey ? 'single' : 'follow', true);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			app.cancelLabel();
		} else if (e.key === 'Tab') {
			finish('follow');
			// at the first and the last field the browser's own Tab goes on, so the field is no keyboard trap
			if (app.moveLabelFocus(index, e.shiftKey ? -1 : 1)) {
				e.preventDefault();
			}
		}
	}

	function onblur() {
		// a click is on its way: committing now would re-render between mousedown and mouseup and the browser would drop the
		// click; the app commits the edit when the click comes (commitDeferredEdit)
		if (typed && !app.pointerDown) {
			finish('follow');
		}
	}

	/* leaving a field without having changed its text is no edit */
	function finish(mode: LabelMode, decided = false) {
		if (typed || decided) {
			app.commitLabel(index, typed ? typed.text : (page.label ?? ''), mode);
		} else {
			app.cancelLabel();
		}
	}
</script>

<div data-label={index + 1} class={['label-input', stateClasses]}>
	<input type="text" class="form-control form-control-sm" data-label-input={index + 1} autocomplete="off" value={shown}
		placeholder={t('plugin_newspaperRecognizer_pagination_label_placeholder')}
		aria-label={app.fmt('plugin_newspaperRecognizer_pagination_label_aria', index + 1)}
		title={own ? app.fmt('plugin_newspaperRecognizer_pagination_label_own', follow) : ''}
		{oninput} {onkeydown} {onblur} />
</div>
