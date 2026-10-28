<script lang="ts">
	import type { Snippet } from 'svelte';
	import { dismiss } from '../dismiss';

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
		// the popover is placed below the element it is positioned against, which holds the trigger too
		const area = (popover.offsetParent ?? popover.parentElement) as HTMLElement;
		return dismiss(target => area.contains(target), onclose);
	};
</script>

<div {@attach closeOutside} class="popover bs-popover-bottom newspaper-popover newspaper-popover--{align === 'start' ? 'start' : 'end'}" role="dialog" aria-label={title}>
	<div class="popover-arrow"></div>
	<h3 class="popover-header">{title}</h3>
	<div class="popover-body">{@render children()}</div>
</div>
