import { fromIso, formatByPattern, weekday } from './logic/dates.mjs';

const P = 'plugin_newspaperRecognizer_';

/** The weekdays in the order of the weekday picker; index = weekday() of lib/logic/dates.mjs (0 = Sunday). */
export const DAYS = [
	{ index: 1, key: P + 'monday' },
	{ index: 2, key: P + 'tuesday' },
	{ index: 3, key: P + 'wednesday' },
	{ index: 4, key: P + 'thursday' },
	{ index: 5, key: P + 'friday' },
	{ index: 6, key: P + 'saturday' },
	{ index: 0, key: P + 'sunday' },
];

export interface TextDay {
	date: string | null;
	dayNumber: string | null;
}

export interface TextFold {
	days: TextDay[];
	blocks: number;
}

interface Deps {
	t: (key: string) => string;
	fmt: (key: string, ...args: unknown[]) => string;
	dateFormatPattern: string;
}

/** The texts of the continue preview: how a day, a number, a day header and a folded run of days read. */
export function continueTexts({ t, fmt, dateFormatPattern }: Deps) {
	// "Fr 01.03.1912": the short weekday in front of the date
	const dayText = (iso: string) => {
		const date = fromIso(iso);
		return date ? t(DAYS.find(day => day.index === weekday(date))!.key).slice(0, 2) + ' ' + formatByPattern(date, dateFormatPattern) : iso;
	};
	const numberText = (number: string) => t(P + 'preview_number') + ' ' + number;

	// the header of a day: its date, and with the number counting per day its number
	const dayHeader = (day: TextDay, perDay: boolean) => [day.date && dayText(day.date), perDay && day.dayNumber && numberText(day.dayNumber)].filter(Boolean).join(' · ');

	// "Mo 04.03.1912 – Mi 06.03.1912 · 3 Tage, 6 Blöcke ohne Änderung": the days by their date, without dates by their number
	const foldDay = (day: TextDay) => (day.date ? dayText(day.date) : numberText(day.dayNumber || ''));
	const foldText = (fold: TextFold) => {
		const first = foldDay(fold.days[0]), last = foldDay(fold.days[fold.days.length - 1]);
		return (fold.days.length === 1 ? first : first + ' – ' + last) + ' · '
			+ (fold.days.length === 1 ? t(P + 'continue_foldDaysOne') : fmt(P + 'continue_foldDays', fold.days.length)) + ', '
			+ (fold.blocks === 1 ? t(P + 'preview_unchangedOne') : fmt(P + 'preview_unchanged', fold.blocks));
	};

	return { dayText, numberText, dayHeader, foldText };
}
