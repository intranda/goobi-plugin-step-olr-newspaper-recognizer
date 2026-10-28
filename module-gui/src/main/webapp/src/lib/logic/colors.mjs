// Colours of nested types; the bulk tools use them for the positions of a pattern, so both read the same way.
export const CHILD_COLORS = ['#146abf', '#e00404', '#6300b5', '#ba5d06', '#467021'];

/** The colour of a 0-based position, repeating after the last colour. */
export const positionColor = position => CHILD_COLORS[position % CHILD_COLORS.length];
