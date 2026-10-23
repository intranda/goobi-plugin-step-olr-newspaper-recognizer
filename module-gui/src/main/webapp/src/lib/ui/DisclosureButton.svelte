<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		expanded: boolean;
		/** the id (or ids) of what the button shows and hides; set on the button only while that is shown */
		controls: string;
		/** what the button shows, for screen readers and as tooltip, e.g. "Seiten zeigen: Morgenausgabe" */
		label: string;
		onclick: () => void;
	}

	/** The chevron that opens and closes a row of a preview, like the caret of Goobi's collapse toggles (right: closed, down: open). */
	let { expanded, controls, label, onclick }: Props = $props();
</script>

<button type="button" class="btn btn-blank btn-sm newspaper-disclosure" aria-expanded={expanded ? 'true' : 'false'} aria-controls={expanded ? controls : undefined}
	aria-label={label} title={label} {onclick}>
	<Icon name={expanded ? 'chevron-down' : 'chevron-right'} />
</button>
