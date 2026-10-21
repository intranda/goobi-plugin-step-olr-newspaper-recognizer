<script lang="ts">
	import type { Snippet } from 'svelte';
		interface Props {
		columns: { label: string, col?: string, th?: string }[];
		children: Snippet;
	}

	/**
	 * The table of a dialog preview. `columns` are {label, col, th}: the header text, the class of its <col> and of its <th>;
	 * the rows are the children.
	 */
	let { columns, children }: Props = $props();
</script>

<table class="table table-sm mb-0 preview-table">
	<colgroup>
		{#each columns as column (column.label)}<col class={column.col} />{/each}
	</colgroup>
	<thead>
		<tr>
			{#each columns as column (column.label)}<th scope="col" class={column.th}>{column.label}</th>{/each}
		</tr>
	</thead>
	<tbody>{@render children()}</tbody>
</table>
