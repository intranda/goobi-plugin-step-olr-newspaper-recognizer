import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// icons.ts imports the SVG files through Vite (?raw), which node cannot load: its keys are read as text
const listed = new Set([...readFileSync(new URL('./icons.ts', import.meta.url), 'utf8').matchAll(/^\t'([a-z0-9-]+)':/gm)].map(match => match[1]));

const sources = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
	const path = join(dir, entry.name);
	return entry.isDirectory() ? sources(path) : /\.svelte$/.test(entry.name) ? [path] : [];
});

/* the icon names written out in the markup: <Icon name="x" />, icon="x" and icon={cond ? 'x' : 'y'} */
function used(file) {
	const text = readFileSync(file, 'utf8');
	const names = [];
	for (const match of text.matchAll(/(?:<Icon\s+name|\bicon)=(?:"([^"{}]+)"|\{([^}]*)\})/g)) {
		if (match[1]) {
			names.push(match[1]);
		} else {
			names.push(...[...match[2].matchAll(/'([a-z0-9-]+)'/g)].map(quoted => quoted[1]));
		}
	}
	return names;
}

test('every icon used in a component is in the icon map', () => {
	const missing = sources(new URL('../..', import.meta.url).pathname)
		.flatMap(file => used(file).filter(name => !listed.has(name)).map(name => `${name} (${file})`));
	assert.deepEqual(missing, []);
});

test('the icon map has no entry that no component uses', () => {
	const all = new Set(sources(new URL('../..', import.meta.url).pathname).flatMap(used));
	assert.deepEqual([...listed].filter(name => !all.has(name)), []);
});
