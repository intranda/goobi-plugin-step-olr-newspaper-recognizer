/** The usage hints of the plugin as a section of goobi's shortcuts dialog (window.goobiShortcutSections), without the colon the texts end with. */
export interface ShortcutSection {
	id: string
	title: string
	entries: { how: string; what: string }[]
}

const P = 'plugin_newspaperRecognizer_'

export function shortcutSection(t: (key: string) => string): ShortcutSection {
	const hint = (name: string) => ({
		how: t(P + 'pagination_help_' + name).replace(/:\s*$/, ''),
		what: t(P + 'pagination_help_' + name + 'Text'),
	})
	return {
		id: 'newspaperRecognizer',
		title: t(P + 'shortcuts_section'),
		entries: ['small', 'big', 'supplement', 'zoom'].map(hint),
	}
}
