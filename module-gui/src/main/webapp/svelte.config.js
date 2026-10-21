/* read by vite-plugin-svelte (build) and svelte-check */
export default {
	compilerOptions: { css: 'injected' },
	vitePlugin: {
		// only the root is a custom element, everything below it is an ordinary component
		dynamicCompileOptions: ({ filename }) => (filename.endsWith('/PluginElement.svelte') ? { customElement: true } : undefined),
	},
};
