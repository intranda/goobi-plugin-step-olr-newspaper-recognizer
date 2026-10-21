/* what the plugin page (plugin_newspaperRecognizer.xhtml) and Goobi's own scripts provide as globals */

declare const GoobiIcons: { iconHref(name: string): string };

declare const faces: {
	ajax: {
		addOnEvent(callback: (data: { status: string; source?: { id: string } }) => void): void;
		addOnError(callback: (data: { source?: { id: string } }) => void): void;
	};
};

interface Window {
	/** the thumbnails loaded up front (option loadallimages), by URL */
	npImages?: Record<string, HTMLImageElement>;
}
