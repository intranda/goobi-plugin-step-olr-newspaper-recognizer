import * as riot from 'riot'
import App from './tags/app.riot'

import './resources/css/newspapergrid.css'

const mountApp = riot.component(App)

/* The goobiOpts look like this:
var options = {
    stepId: #{AktuelleSchritteForm.myPlugin.step.id},
    processId: #{AktuelleSchritteForm.myPlugin.step.prozess.id},
    userId: #{LoginForm.myBenutzer.id}
};
*/
const plugin_name = window["plugin_name"];
const goobi_opts = window[plugin_name];


window.mountNewspaperCorrection = (opts) => {
	const app = mountApp(
	    document.getElementById("root"),
	    opts
	)
}