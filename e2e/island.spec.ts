/**
 * Playing the island in a real browser.
 *
 * These are the checks a unit test cannot make: that the page boots at all, that
 * a click lands on the tree you aimed at, and that the renderer still speaks the
 * simulation's vocabulary. A rename inside `src/sim` once left the browser
 * quietly broken with every other test passing, which is why this exists.
 */
import { expect, test } from '@playwright/test';
import { clickAt, hurry, logsHome, openIsland, visibleTrees } from './harness.ts';

test('the island opens, and Robin is alive in it', async ({ page, baseURL }) => {
  const problems = await openIsland(page, baseURL);
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

test('the island still opens when the font CDN is unreachable', async ({ page, baseURL }) => {
  // Every test here runs with third-party requests blocked; this is the one that
  // says why. The fonts used to be an @import inside the bundled CSS, so when the
  // CDN was blocked Vite's stylesheet preload rejected, the dynamic import of the
  // game never resolved, and the page stayed blank. Typography now degrades to
  // system fonts and nothing else goes with it.
  const problems = await openIsland(page, baseURL);
  await expect(page.locator('#world')).toBeVisible();
  await expect(page.locator('.brand')).toContainText('LITTLE ISLAND');
  expect(await page.evaluate(() => window.island.sim.world.villagers.length)).toBe(1);
  expect(problems).toEqual([]);
});
