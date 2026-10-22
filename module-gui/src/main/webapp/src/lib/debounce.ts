import type { HTMLInputAttributes } from 'svelte/elements';

/**
 * Input handlers that apply the value of a text field only once the user pauses, so that validation messages do not flash up while
 * someone who knows what belongs where is still typing. Leaving the field (or Enter) applies a pending value at once; a field that was
 * not edited applies nothing. `key` tells the fields apart. `onedit` is called with every input, before the value is applied.
 */
export class DebouncedEdits {
	private pending = new Map<string, { timer: ReturnType<typeof setTimeout>, apply: () => void }>();

	constructor(private readonly onedit: () => void, private readonly delay = 700) {}

	/** the handlers of one field, to spread on its input: `apply` gets the current value */
	field(key: string, apply: (value: string) => void): Pick<HTMLInputAttributes, 'oninput' | 'onblur' | 'onkeydown'> {
		return {
			oninput: e => {
				this.onedit();
				this.schedule(key, () => apply(e.currentTarget.value));
			},
			onblur: () => this.flush(key),
			onkeydown: e => e.key === 'Enter' && this.flush(key),
		};
	}

	/** applies what is waiting for the key now */
	flush(key: string) {
		const entry = this.pending.get(key);
		if (entry) {
			clearTimeout(entry.timer);
			this.pending.delete(key);
			entry.apply();
		}
	}

	/** drops what is waiting, e.g. because the fields are gone */
	cancelAll() {
		for (const { timer } of this.pending.values()) {
			clearTimeout(timer);
		}
		this.pending.clear();
	}

	private schedule(key: string, apply: () => void) {
		clearTimeout(this.pending.get(key)?.timer);
		const timer = setTimeout(() => this.flush(key), this.delay);
		this.pending.set(key, { timer, apply });
	}
}
