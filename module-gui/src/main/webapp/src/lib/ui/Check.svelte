<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'type' | 'id' | 'checked' | 'onchange' | 'class' | 'children'> {
		type?: 'checkbox' | 'radio';
		id: string;
		checked: boolean;
		onchange: (e: Event & { currentTarget: HTMLInputElement }) => void;
		class?: string;
		children: Snippet;
	}

	/** A radio button or check box with its label (Bootstrap form-check). Extra attributes go to the input. */
	let { type = 'checkbox', id, checked, onchange, class: className = '', children, ...rest }: Props = $props();
</script>

<div class={['form-check', className]}>
	<input {type} class="form-check-input" {id} {checked} {onchange} {...rest} />
	<label class="form-check-label" for={id}>{@render children?.()}</label>
</div>
