import alertCircle from '@tabler/icons/outline/alert-circle.svg?raw';
import arrowBackUp from '@tabler/icons/outline/arrow-back-up.svg?raw';
import arrowDown from '@tabler/icons/outline/arrow-down.svg?raw';
import arrowUp from '@tabler/icons/outline/arrow-up.svg?raw';
import calendar from '@tabler/icons/outline/calendar.svg?raw';
import calendarPlus from '@tabler/icons/outline/calendar-plus.svg?raw';
import category from '@tabler/icons/outline/category.svg?raw';
import chevronDown from '@tabler/icons/outline/chevron-down.svg?raw';
import chevronRight from '@tabler/icons/outline/chevron-right.svg?raw';
import chevronsDown from '@tabler/icons/outline/chevrons-down.svg?raw';
import chevronsUp from '@tabler/icons/outline/chevrons-up.svg?raw';
import circleMinus from '@tabler/icons/outline/circle-minus.svg?raw';
import deviceFloppy from '@tabler/icons/outline/device-floppy.svg?raw';
import dotsVertical from '@tabler/icons/outline/dots-vertical.svg?raw';
import eyeOff from '@tabler/icons/outline/eye-off.svg?raw';
import gripVertical from '@tabler/icons/outline/grip-vertical.svg?raw';
import hash from '@tabler/icons/outline/hash.svg?raw';
import infoCircle from '@tabler/icons/outline/info-circle.svg?raw';
import listNumbers from '@tabler/icons/outline/list-numbers.svg?raw';
import logout from '@tabler/icons/outline/logout.svg?raw';
import pencil from '@tabler/icons/outline/pencil.svg?raw';
import plus from '@tabler/icons/outline/plus.svg?raw';
import puzzle from '@tabler/icons/outline/puzzle.svg?raw';
import refresh from '@tabler/icons/outline/refresh.svg?raw';
import repeat from '@tabler/icons/outline/repeat.svg?raw';
import settings from '@tabler/icons/outline/settings.svg?raw';
import trash from '@tabler/icons/outline/trash.svg?raw';
import x from '@tabler/icons/outline/x.svg?raw';

/** the inner markup of a 24x24 outline icon: what is inside the `<svg>` of the Tabler file */
const inner = (svg: string) => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();

/**
 * The Tabler icons (outline) the plugin uses, bundled with it. A new icon is imported above and added here; one that is not listed
 * renders nothing.
 */
export const ICONS: Record<string, string> = Object.fromEntries(Object.entries({
	'alert-circle': alertCircle,
	'arrow-back-up': arrowBackUp,
	'arrow-down': arrowDown,
	'arrow-up': arrowUp,
	'calendar': calendar,
	'calendar-plus': calendarPlus,
	'category': category,
	'chevron-down': chevronDown,
	'chevron-right': chevronRight,
	'chevrons-down': chevronsDown,
	'chevrons-up': chevronsUp,
	'circle-minus': circleMinus,
	'device-floppy': deviceFloppy,
	'dots-vertical': dotsVertical,
	'eye-off': eyeOff,
	'grip-vertical': gripVertical,
	'hash': hash,
	'info-circle': infoCircle,
	'list-numbers': listNumbers,
	'logout': logout,
	'pencil': pencil,
	'plus': plus,
	'puzzle': puzzle,
	'refresh': refresh,
	'repeat': repeat,
	'settings': settings,
	'trash': trash,
	'x': x,
}).map(([name, svg]) => [name, inner(svg)]));
