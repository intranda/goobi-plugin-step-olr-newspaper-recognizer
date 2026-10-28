/* what the plugin page (plugin_newspaperRecognizer.xhtml) and Goobi's own scripts provide as globals */

declare const faces: {
	ajax: {
		addOnEvent(callback: (data: { status: string; source?: { id: string } }) => void): void;
		addOnError(callback: (data: { source?: { id: string } }) => void): void;
	};
};

interface Window {
	/** the sections of goobi's shortcuts dialog; every plugin adds its own while it is on the page */
	goobiShortcutSections?: import('./lib/shortcutSection').ShortcutSection[];
}
