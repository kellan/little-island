/**
 * The stress lab, which is a separate page with separate failure modes: it is the
 * only thing that reports whether the browser can hold a settlement at all, so a
 * lab that renders nothing or reports dashes is worth catching.
 *
 * Ported from the node:test smoke suite that arrived on main, so the repository
 * has one browser harness rather than two.
 */
import { expect, test, type Page } from '@playwright/test';
import { blockThirdParty } from './harness.ts';

async function openLab(page: Page, baseURL: string | undefined, query: string) {
  const problems: string[] = [];
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
  await blockThirdParty(page, new URL(baseURL ?? 'http://localhost:4173/').origin);
  await page.goto(`/${query}`, { waitUntil: 'load' });
  await page.waitForSelector('#lab-world', { timeout: 30_000 });
  return problems;
}

const settled = (page: Page, id: string) =>
  page.waitForFunction(selector => document.querySelector(selector)?.textContent !== '—', id, { timeout: 40_000 });

test('the lab opens with no third-party resource available', async ({ page, baseURL }) => {
  const problems = await openLab(page, baseURL, '?lab&scenario=agents');
  await expect(page.locator('.lab-header')).toContainText('TECHNICAL PROVING GROUND');
  expect(problems).toEqual([]);
});

test('it reports live frame, simulation and instancing cost', async ({ page, baseURL }) => {
  const problems = await openLab(page, baseURL, '?lab&scenario=agents&trees=200&agents=200');
  await settled(page, '#fps');
  for (const id of ['#fps', '#p95', '#sim', '#instancing', '#pick']) {
    const text = await page.locator(id).textContent();
    expect(Number.isFinite(Number(text)), `${id} should read as a number, got ${text}`).toBe(true);
  }
  await expect(page.locator('#worst')).toContainText(/WORST \d/);
  await expect(page.locator('#draws')).toHaveText('5');
  expect(problems).toEqual([]);
});

test('zero counts in the URL are taken literally, for an empty baseline', async ({ page, baseURL }) => {
  const problems = await openLab(page, baseURL, '?lab&trees=0&agents=0');
  await settled(page, '#draws');
  // Water and island only: no forest, no workers.
  await expect(page.locator('#draws')).toHaveText('2');
  await expect(page.locator('#trees')).toHaveValue('0');
  await expect(page.locator('#agents')).toHaveValue('0');
  expect(problems).toEqual([]);
});

test('saved lab state round trips exactly', async ({ page, baseURL }) => {
  await openLab(page, baseURL, '?lab&scenario=soak&trees=200&agents=300');
  await page.click('#roundtrip');
  await page.waitForFunction(() => document.querySelector('#save-size')?.textContent !== 'NOT RUN', null, { timeout: 30_000 });
  await expect(page.locator('#save-size')).toContainText(/KB · EXACT/);
  expect(Number(await page.locator('#save').textContent())).toBeLessThan(250);
});
