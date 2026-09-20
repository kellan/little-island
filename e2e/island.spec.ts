/**
 * Playing the island in a real browser.
 *
 * These are the checks a unit test cannot make: that the page boots at all, that
 * a click lands on the tree you aimed at, and that the renderer still speaks the
 * simulation's vocabulary. A rename inside `src/sim` once left the browser
 * quietly broken with every other test passing, which is why this exists.
 */
import { expect, test, type Page } from '@playwright/test';

/** The handle `src/game.ts` hangs on the window for exactly this purpose. */
declare global {
  interface Window {
    island: {
      sim: { world: any; rulebook: { id: string } };
      view: { treeGroups: Map<number, any>; camera: any; pick(x: number, y: number): number | null; workBadge(): { progress: number } | null };
    };
  }
}

async function openIsland(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.island, null, { timeout: 30_000 });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.island, null, { timeout: 30_000 });
  await page.evaluate(() => document.querySelector<HTMLDialogElement>('#help-dialog')?.close());
  return problems;
}

/** Where a tree is on screen right now, found the way the game finds it. */
async function treeAt(page: Page, id: number) {
  return page.evaluate((treeId) => {
    const group = window.island.view.treeGroups.get(treeId);
    const point = group.position.clone();
    point.y += 1.6 * group.scale.x;
    point.project(window.island.view.camera);
    return { x: (point.x * .5 + .5) * innerWidth, y: (-point.y * .5 + .5) * innerHeight };
  }, id);
}

/** Trees comfortably inside the viewport, so a click cannot miss. */
async function visibleTrees(page: Page, count: number) {
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

const clickAt = async (page: Page, at: { x: number; y: number }) => {
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.up();
};

const logsHome = (page: Page, count: number) =>
  page.waitForFunction(n => window.island.sim.world.stockpile.stock.log >= n, count, { timeout: 60_000 });

/** 3x, so the slow software renderer in CI does not make us wait in real time. */
const hurry = async (page: Page) => { await page.click('#speed'); await page.click('#speed'); };

test('the island opens, and Robin is alive in it', async ({ page }) => {
  const problems = await openIsland(page);
  await expect(page.locator('#world')).toBeVisible();
  const state = await page.evaluate(() => ({
    rulebook: window.island.sim.rulebook.id,
    villagers: window.island.sim.world.villagers.length,
    trees: window.island.sim.world.trees.length,
  }));
  expect(state.rulebook, 'the browser runs the settlement rules').toBe('settlement');
  expect(state.villagers).toBe(1);
  expect(state.trees).toBeGreaterThan(20);

  // Left alone, the villager putters about rather than standing still.
  const first = await page.evaluate(() => ({ ...window.island.sim.world.villagers[0] }));
  await page.waitForTimeout(4000);
  const later = await page.evaluate(() => ({ ...window.island.sim.world.villagers[0] }));
  expect(later.x !== first.x || later.z !== first.z, 'the villager has moved').toBe(true);
  expect(problems).toEqual([]);
});

test('clicking a tree sends Robin to fell it and brings the log home', async ({ page }) => {
  const problems = await openIsland(page);
  await hurry(page);
  const [tree] = await visibleTrees(page, 1);

  await page.mouse.move(tree.x, tree.y);
  await expect(page.locator('#tooltip')).toBeVisible();
  await expect(page.locator('#tooltip-text')).toHaveText('Select to gather');
  await expect(page.locator('#world')).toHaveCSS('cursor', 'pointer');

  await clickAt(page, tree);
  await page.waitForFunction(id => window.island.sim.world.jobs.some((job: any) => job.treeId === id && job.state === 'assigned'), tree.id);

  // The renderer has to keep up with the simulation's own words for all this.
  await page.waitForFunction(() => window.island.sim.world.villagers[0].activity.kind === 'chop', null, { timeout: 60_000 });
  await expect(page.locator('#work-progress')).toBeVisible();
  expect(await page.evaluate(() => window.island.view.workBadge()?.progress)).toBeGreaterThanOrEqual(0);
  await expect(page.locator('#status')).toHaveText('Chop, chop. Making progress.');

  await page.waitForFunction(() => !!window.island.sim.world.villagers[0].carrying, null, { timeout: 60_000 });
  await expect(page.locator('#status')).toHaveText('Bringing a log home');

  await logsHome(page, 1);
  await expect(page.locator('#log-count')).toHaveText('1');
  await expect(page.locator('#toast')).toContainText('Your first log');
  expect(await page.evaluate(id => window.island.sim.world.trees.find((t: any) => t.id === id).state, tree.id)).toBe('felled');
  expect(problems).toEqual([]);
});

test('orders queue up, and a marked tree can be called off', async ({ page }) => {
  await openIsland(page);
  const trees = await visibleTrees(page, 3);
  for (const tree of trees) await clickAt(page, tree);
  await expect(page.locator('#objective-text')).toContainText('more trees on the list');
  expect(await page.evaluate(() => window.island.sim.world.jobs.length)).toBe(3);

  // Clicking a marked tree is the undo.
  const last = trees[2];
  await page.mouse.move(last.x, last.y);
  await expect(page.locator('#tooltip-text')).toHaveText('Click to call it off');
  await clickAt(page, last);
  await expect(page.locator('#toast')).toContainText('Called off');
  await page.waitForFunction(id => !window.island.sim.world.jobs.some((job: any) => job.treeId === id && job.state !== 'cancelled'), last.id);
});

test('the work list survives a reload', async ({ page }) => {
  await openIsland(page);
  await hurry(page);
  const trees = await visibleTrees(page, 2);
  for (const tree of trees) await clickAt(page, tree);
  await logsHome(page, 1);

  const before = await page.evaluate(() => ({
    logs: window.island.sim.world.stockpile.stock.log,
    felled: window.island.sim.world.stats.treesFelled,
  }));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!window.island, null, { timeout: 30_000 });
  await page.evaluate(() => document.querySelector<HTMLDialogElement>('#help-dialog')?.close());

  const after = await page.evaluate(() => ({
    logs: window.island.sim.world.stockpile.stock.log,
    felled: window.island.sim.world.stats.treesFelled,
    jobs: window.island.sim.world.jobs.length,
  }));
  expect(after.logs).toBe(before.logs);
  expect(after.felled).toBeGreaterThanOrEqual(before.felled);
  expect(after.jobs, 'the unfinished order came back too').toBeGreaterThan(0);

  await hurry(page);
  await logsHome(page, 2);
});

test('the camera is steady under a drag and a zoom', async ({ page }) => {
  const problems = await openIsland(page);
  const start = await page.evaluate(() => ({ ...window.island.view.camera.position }));
  await page.mouse.move(640, 400);
  await page.mouse.down();
  for (let step = 1; step <= 20; step++) await page.mouse.move(640 + step * 12, 400 - step * 3);
  await page.mouse.up();
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(1000);

  const moved = await page.evaluate(() => ({ ...window.island.view.camera.position }));
  expect(moved.x !== start.x || moved.z !== start.z, 'the camera responded').toBe(true);
  expect([moved.x, moved.y, moved.z].every(Number.isFinite)).toBe(true);
  expect(problems).toEqual([]);
});

test('the island still opens when the font CDN is unreachable', async ({ page }) => {
  // The fonts used to be an @import inside the bundled CSS. When the CDN was
  // blocked, Vite's stylesheet preload rejected, the dynamic import of the game
  // never resolved, and the page stayed blank. Never again.
  await page.route('**fonts.googleapis.com/**', route => route.abort());
  await page.route('**fonts.gstatic.com/**', route => route.abort());
  const problems = await openIsland(page);
  await expect(page.locator('#world')).toBeVisible();
  await expect(page.locator('.brand')).toContainText('LITTLE ISLAND');
  expect(await page.evaluate(() => window.island.sim.world.villagers.length)).toBe(1);
  expect(problems).toEqual([]);
});
