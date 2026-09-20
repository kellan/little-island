/**
 * Shared machinery for the browser suite: opening the island offline, finding a
 * tree on screen, and waiting for work to finish. Playwright will not let one
 * spec import another, and this is nicer than duplicating it anyway.
 */
import { expect, type Page } from '@playwright/test';

/** The handle `src/game.ts` hangs on the window for exactly this purpose. */
declare global {
  interface Window {
    island: {
      sim: { world: any; rulebook: { id: string } };
      view: { treeGroups: Map<number, any>; camera: any; pick(x: number, y: number): number | null; workBadge(): { progress: number } | null };
    };
  }
}

/**
 * Every test runs offline. Anything off-origin is treated as unreachable, so the
 * suite never depends on a font host being up and never silently starts to.
 */
export async function blockThirdParty(page: Page, origin: string) {
  await page.route('**', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
}

export async function openIsland(page: Page, baseURL?: string) {
  const problems: string[] = [];
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
  await blockThirdParty(page, new URL(baseURL ?? 'http://localhost:4173/').origin);
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.island, null, { timeout: 30_000 });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.island, null, { timeout: 30_000 });
  await page.evaluate(() => document.querySelector<HTMLDialogElement>('#help-dialog')?.close());
  return problems;
}

/** Where a tree is on screen right now, found the way the game finds it. */
export async function treeAt(page: Page, id: number) {
  return page.evaluate((treeId) => {
    const group = window.island.view.treeGroups.get(treeId);
    const point = group.position.clone();
    point.y += 1.6 * group.scale.x;
    point.project(window.island.view.camera);
    return { x: (point.x * .5 + .5) * innerWidth, y: (-point.y * .5 + .5) * innerHeight };
  }, id);
}

/** Trees comfortably inside the viewport, so a click cannot miss. */
export async function visibleTrees(page: Page, count: number) {
  const ids = await page.evaluate(() => window.island.sim.world.trees.map((tree: any) => tree.id));
  const found: { id: number; x: number; y: number }[] = [];
  for (const id of ids) {
    const at = await treeAt(page, id);
    if (at.x > 150 && at.x < 1130 && at.y > 160 && at.y < 640) found.push({ id, ...at });
    if (found.length >= count) break;
  }
  expect(found.length, 'enough trees on screen to click').toBeGreaterThanOrEqual(count);
  return found;
}

export const clickAt = async (page: Page, at: { x: number; y: number }) => {
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.up();
};

export const logsHome = (page: Page, count: number) =>
  page.waitForFunction(n => window.island.sim.world.stockpile.stock.log >= n, count, { timeout: 60_000 });

/** 3x, so the slow software renderer in CI does not make us wait in real time. */
export const hurry = async (page: Page) => { await page.click('#speed'); await page.click('#speed'); };

