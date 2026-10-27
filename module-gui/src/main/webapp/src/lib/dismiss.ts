/**
 * Closes something that floats above the page (a popover, a menu) on Escape or on a pointer press outside of it: Goobi's own popovers
 * close like this. `inside` tells whether a target belongs to the floating element (and its trigger); `pointer` is the event that
 * counts as "outside" (a popover reacts on the press, a menu on the click). Returns what removes the listeners, so it fits an `{@attach}`.
 */
export function dismiss(inside: (target: Node) => boolean, onclose: () => void, pointer: 'mousedown' | 'click' = 'mousedown') {
	const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onclose();
	const onPointer = (e: MouseEvent) => inside(e.target as Node) || onclose();
	document.addEventListener('keydown', onKeyDown);
	document.addEventListener(pointer, onPointer);
	return () => {
		document.removeEventListener('keydown', onKeyDown);
		document.removeEventListener(pointer, onPointer);
	};
}
