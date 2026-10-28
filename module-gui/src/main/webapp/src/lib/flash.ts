/**
 * Plays a CSS animation again, also on an element that still carries its class: the class comes off, the browser lays the page out
 * once (reading offsetWidth forces that, without it the class would go back on unnoticed) and the class goes back on.
 * Several elements share the one layout.
 */
export function flash(elements: Element | null | undefined | (Element | null | undefined)[], className = 'newspaper-flash') {
	const list = (Array.isArray(elements) ? elements : [elements]).filter((element): element is Element => !!element);
	for (const element of list) {
		element.classList.remove(className);
	}
	void document.body.offsetWidth;
	for (const element of list) {
		element.classList.add(className);
	}
}
