import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('el HTML contiene una vez cada control que conecta el arranque del juego', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const required = [...main.matchAll(/querySelector(?:<[^>]+>)?\(['"]#([^'"]+)['"]\)/g)].map(match => match[1]);
  assert.ok(required.includes('quick-start'));
  assert.ok(required.includes('disembark'));
  const ids = [...html.matchAll(/\bid=['"]([^'"]+)['"]/g)].map(match => match[1]);
  for (const id of required) assert.equal(ids.filter(value => value === id).length, 1, `Control ausente o duplicado: #${id}`);
});
