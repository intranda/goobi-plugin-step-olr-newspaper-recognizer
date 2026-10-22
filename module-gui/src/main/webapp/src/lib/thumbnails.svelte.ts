interface Entry {
	url: string
	started: boolean
	callbacks: Set<(image: HTMLImageElement) => void>
}

/**
 * Loads the page thumbnails for the canvases: each URL once, a few at a time, in the order they are asked for (the page starts at the top, so the ones in view come first).
 * A thumbnail that fails to load counts as settled and is never drawn, so the progress always reaches its end.
 */
export class ThumbnailLoader {
	/** the thumbnails asked for so far, and how many of them are done (loaded or failed) */
	requested = $state(0)
	settled = $state(0)

	// browsers allow about six connections per host; more would only queue up there
	private readonly concurrency = 6
	private images = new Map<string, HTMLImageElement>()
	private entries = new Map<string, Entry>()
	private waiting: Entry[] = []
	private active = 0

	get busy() {
		return this.settled < this.requested
	}

	peek(url: string) {
		return this.images.get(url) ?? null
	}

	/** Calls back with the loaded image (at once if it is there already). Returns the function that withdraws the callback. */
	request(url: string, callback: (image: HTMLImageElement) => void) {
		const image = this.images.get(url)
		if (image) {
			callback(image)
			return () => {}
		}
		let entry = this.entries.get(url)
		if (!entry) {
			entry = { url, started: false, callbacks: new Set() }
			this.entries.set(url, entry)
			this.waiting.push(entry)
			this.requested++
		}
		entry.callbacks.add(callback)
		this.pump()
		return () => { entry.callbacks.delete(callback) }
	}

	private pump() {
		while (this.active < this.concurrency && this.waiting.length > 0) {
			this.start(this.waiting.shift()!)
		}
	}

	private start(entry: Entry) {
		entry.started = true
		this.active++
		const image = new Image()
		const finish = () => {
			this.active--
			this.entries.delete(entry.url)
			this.settled++
			this.pump()
		}
		image.onload = () => {
			this.images.set(entry.url, image)
			finish()
			for (const callback of entry.callbacks) {
				callback(image)
			}
		}
		image.onerror = finish
		image.src = entry.url
	}
}
