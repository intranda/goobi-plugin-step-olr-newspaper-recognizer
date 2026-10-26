<script module lang="ts">
	/** What the control(s) of the row take over, so that a screen reader connects them with the messages: spread it on them. */
	export interface ControlAria {
		'aria-invalid'?: 'true';
		'aria-describedby'?: string;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	interface Props {
		id: string;
		label: string;
		icon?: string | null;
		color?: string | null;
		invalid?: boolean;
		unsaved?: boolean;
		errors?: (string | false | null | undefined)[];
		children: Snippet<[ControlAria]>;
	}

	/**
	 * A labelled field of a block: icon (or colour dot) and label in front of the control, validation messages below.
	 * `unsaved` marks a value that differs from the last saved state (orange, bold, bar at the left).
	 * `errors` lists the messages; the row is marked as invalid as soon as there is one or `invalid` is set.
	 * All labels get the same width, so the fields of a block line up.
	 * The content is a snippet that receives the ARIA attributes for its controls (`aria-invalid`, `aria-describedby` for the messages).
	 */
	let { id, label, icon = null, color = null, invalid = false, unsaved = false, errors = [], children }: Props = $props();

	const messages = $derived(errors.filter(Boolean));
	const marked = $derived(invalid || messages.length > 0);
	const aria: ControlAria = $derived({
		'aria-invalid': marked ? 'true' : undefined,
		'aria-describedby': messages.length > 0 ? messages.map((_, i) => `${id}-error-${i}`).join(' ') : undefined,
	});
</script>

<div class={['form-group p-0 m-0', marked && 'has-validation-error']}>
	<div class={['input-group flex-nowrap', unsaved && 'is-unsaved']}>
		<label class="input-group-text" style="min-width: 6.5rem;" for={id}>
			{#if color}
				<span aria-hidden="true" class="me-2" style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: {color};"></span>
			{:else if icon}
				<Icon name={icon} class="me-2" />
			{/if}
			{label}
		</label>
		{@render children(aria)}
	</div>
	{#each messages as message, i (message)}
		<span class="help-inline text-danger" id="{id}-error-{i}">{message}</span>
	{/each}
</div>
