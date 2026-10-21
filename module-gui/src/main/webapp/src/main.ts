// importing the element registers it (<svelte:options customElement>)
import './PluginElement.svelte';

import css from '../resources/css/newspapergrid.css?inline';

/* the plugin page loads a single script, so the stylesheet is injected from it */
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);
