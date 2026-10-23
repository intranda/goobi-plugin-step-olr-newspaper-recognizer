const R = 'plugin_newspaperRecognizer_pagination_rules_';

/** The rules offered as presets (besides "custom"), with the key of their text. */
export const PRESET_KEYS: Record<string, string> = { '1': 'arabic', 'i': 'roman', 'I': 'romanUpper', '[1]': 'fictitious', '– 1': 'firstNone', '–': 'none' };

/** How a rule reads: the name of its preset or the text itself; "no rule" when it has none. */
export function ruleText(beginsWith: string[] | undefined, t: (key: string) => string) {
	if (!beginsWith || beginsWith.length === 0) {
		return t(R + 'ruleNone');
	}
	const text = beginsWith.join(' ');
	return text in PRESET_KEYS ? t(R + 'preset_' + PRESET_KEYS[text]) : text;
}
