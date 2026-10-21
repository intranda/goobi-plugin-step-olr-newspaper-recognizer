<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from './Icon.svelte';

	interface Props {
		id: string;
		label: string;
		icon?: string | null;
		color?: string | null;
		invalid?: boolean;
		errors?: (string | false | null | undefined)[];
		children: Snippet;
	}

	/**
	 * A labelled field of a block: icon (or colour dot) and label in front of the control, validation messages below.
	 * `errors` lists the messages; the row is marked as invalid as soon as there is one or `invalid` is set.
	 * All labels get the same width, so the fields of a block line up.
	 */
	let { id, label, icon = null, color = null, invalid = false, errors = [], children }: Props = $props();

	const messages = $derived(errors.filter(Boolean));
</script>

<div class={['form-group p-0 m-0', (invalid || messages.length > 0) && 'has-validation-error']}>
	<div class="input-group flex-nowrap">
		<label class="input-group-text" style="min-width: 6.5rem;" for={id}>
			{#if color}
				<span aria-hidden="true" class="me-2" style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: {color};"></span>
			{:else if icon}
				<Icon name={icon} class="me-2" />
			{/if}
			{label}
		</label>
		{@render children()}
	</div>
	{#each messages as message (message)}
		<span class="help-inline text-danger">{message}</span>
	{/each}
</div>
