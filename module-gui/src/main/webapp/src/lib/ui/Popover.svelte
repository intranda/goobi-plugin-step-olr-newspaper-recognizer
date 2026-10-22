<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		align?: 'start' | 'end';
		onclose: () => void;
		children: Snippet;
	}

	/**
	 * The popover markup Goobi uses (Bootstrap popover, styled by Goobi's _tooltip-custom.scss), placed below its trigger.
	 * It closes like Goobi's popovers: Escape or a click outside (the trigger next to it toggles by itself).
	 */
	let { title, align = 'end', onclose, children }: Props = $props();

	const closeOutside = (popover: HTMLElement) => {
		// the positioned container holds the trigger too
		const area = popover.closest('.position-relative, .newspaper-field') || (popover.parentElement as HTMLElement);
		const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onclose();
		const onPointerDown = (e: MouseEvent) => area.contains((e.target as Node)) || onclose();
		document.addEventListener('keydown', onKeyDown);
		document.addEventListener('mousedown', onPointerDown);
		return () => {
			document.removeEventListener('keydown', onKeyDown);
			document.removeEventListener('mousedown', onPointerDown);
		};
	};
</script>

<div {@attach closeOutside} class="popover bs-popover-bottom newspaper-popover newspaper-popover--{align === 'start' ? 'start' : 'end'}" role="dialog" aria-label={title}>
	<div class="popover-arrow"></div>
	<h3 class="popover-header">{title}</h3>
	<div class="popover-body">{@render children()}</div>
</div>
