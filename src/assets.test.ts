import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const sheets = { 'style.css': read('style.css'), 'stress.css': read('stress.css') };
const indexHtml = read('../index.html');

describe('page assets', () => {
  // A stylesheet @import is a hard dependency: Chromium fires `error` on a sheet
  // whose import fails, Vite's CSS preload rejects, and the page renders nothing.
  it('never blocks a stylesheet on a third-party @import', () => {
    for (const [name, css] of Object.entries(sheets)) {
      expect(css, `${name} imports a remote stylesheet`).not.toMatch(/@import\s+url\(\s*['"]?https?:/i);
    }
  });
  it('loads webfonts from the document, where a failure degrades to the fallback', () => {
    expect(indexHtml).toMatch(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com/);
    expect(indexHtml).toMatch(/rel="preconnect"/);
  });
  it('declares a local fallback for every webfont family', () => {
    for (const [name, css] of Object.entries(sheets)) {
      expect(css, name).toMatch(/font-family:'DM Sans',sans-serif/);
      for (const rule of css.match(/font:[^;}]*'Libre Caslon Display'[^;}]*/g) ?? [])
        expect(rule, `${name}: ${rule}`).toMatch(/Georgia|serif/);
    }
  });
});
