<script lang="ts">
	interface Props {
		small: string;
		large: string;
		width: number;
		height: number;
		text?: string | null;
		size?: number;
		bg?: string | null;
		preloadLarge?: boolean;
		title?: string;
	}

	/**
	 * A page thumbnail on a canvas. With Shift (or Caps Lock) held the mouse shows a section of the large image at the pointer.
	 * `text` draws a numbered badge in the lower right corner, `bg` is its colour.
	 */
	let { small, large, width, height, text = null, size = 24, bg = null, preloadLarge = false, title = '' }: Props = $props();

	// set by the attachment
	let canvas: HTMLCanvasElement;
	let drawn = $state(false);
	let smallImage: HTMLImageElement | null = null;
	let largeImage: HTMLImageElement | null = null;
	let zooming = false;

	const cached = (url: string) => window.npImages?.[url] ?? null;

	function load(url: string, done: (image: HTMLImageElement) => void) {
		const image = new Image();
		image.onload = () => done(image);
		image.src = url;
	}

	function drawSmall() {
		const image = smallImage;
		const ctx = canvas.getContext('2d');
		if (!image || !ctx) {
			return;
		}
		let scale = width / image.width;
		if (scale * image.height > height) {
			scale = height / image.height;
		}
		canvas.width = image.width * scale;
		canvas.height = image.height * scale;
		ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
		drawn = true;
		if (text) {
			const centerX = canvas.width - size / 1.5 - 2;
			const centerY = canvas.height - size / 1.5 - 2;
			ctx.beginPath();
			ctx.arc(centerX, centerY, size / 2 + 4, 0, 2 * Math.PI, false);
			ctx.fillStyle = bg ?? '';
			ctx.fill();
			ctx.fillStyle = 'white';
			ctx.font = `bold ${size}px arial`;
			ctx.fillText(text, canvas.width - size, canvas.height - (size - 13), size / 2);
		}
	}

	// (re)draws whenever the image, the size or the badge changes; a changed image is looked up again
	const draw = (element: HTMLCanvasElement) => {
		canvas = element;
		const url = small;
		void [width, height, text, size, bg]; // tracked although the drawing may wait for the image
		let cancelled = false;
		if (smallImage?.src !== url && !(smallImage && cached(url) === smallImage)) {
			smallImage = cached(url);
			largeImage = null;
		}
		if (smallImage) {
			drawSmall();
		} else {
			load(url, image => {
				if (!cancelled) {
					smallImage = image;
					drawSmall();
				}
			});
		}
		return () => { cancelled = true; };
	};

	$effect(() => {
		if (preloadLarge) {
			load(large, image => { largeImage = image; });
		}
	});

	function onmousemove(event: MouseEvent) {
		if (!event.shiftKey && !event.getModifierState('CapsLock')) {
			if (zooming) {
				zooming = false;
				drawSmall();
			}
			return;
		}
		zooming = true;
		if (largeImage) {
			drawLarge(event);
		} else {
			load(large, image => {
				largeImage = image;
				drawLarge(event);
			});
		}
	}

	function onmouseout() {
		zooming = false;
		if (smallImage) {
			drawSmall();
		}
	}

	/* the section of the large image around the pointer, as large as the thumbnail is in pixels */
	function drawLarge(event: MouseEvent) {
		if (!zooming || !smallImage || !largeImage) {
			return;
		}
		const rect = canvas.getBoundingClientRect();
		const relX = (event.clientX - rect.left) / canvas.offsetWidth;
		const relY = (event.clientY - rect.top) / canvas.offsetHeight;
		const sourceWidth = smallImage.naturalWidth;
		const sourceHeight = smallImage.naturalHeight;
		const clamp = (start: number, source: number, total: number) => (source > total || start < 0 ? 0 : start + source > total ? total - source : start);
		const sourceX = clamp(largeImage.naturalWidth * relX - sourceWidth / 2, sourceWidth, largeImage.naturalWidth);
		const sourceY = clamp(largeImage.naturalHeight * relY - sourceHeight / 2, sourceHeight, largeImage.naturalHeight);
		canvas.getContext('2d')?.drawImage(largeImage, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
	}
</script>

<!-- the zoom is a mouse feature (the key is Shift or Caps Lock), there is nothing to do on focus -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div class="observable" {title}>
	{#if !drawn}<img src="newspaper_placeholder2.png" alt="" />{/if}
	<canvas class="thumb-canvas" {@attach draw} {onmousemove} {onmouseout}></canvas>
</div>
