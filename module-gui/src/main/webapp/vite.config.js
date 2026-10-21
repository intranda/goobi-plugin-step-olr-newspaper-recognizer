import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/* One ES module for the plugin page (plugin_newspaperRecognizer.xhtml): everything, including the CSS, is in app.js; importing it
   registers <goobi-plugin-step-newspaper-recognizer> */
export default defineConfig({
	plugins: [
		svelte(), // see svelte.config.js
	],
	define: { 'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production') },
	build: {
		outDir: 'resources/dist/intranda_step_newspaperRecognizer/js',
		emptyOutDir: true,
		// the library mode of vite leaves the whitespace of an ES bundle alone, this is the final bundle
		minify: 'terser',
		lib: {
			entry: 'src/main.ts',
			formats: ['es'],
			fileName: () => 'app.js',
		},
	},
});
