/**
 * The goblin fork, in a real browser.
 *
 * The bright island's suite proves the game works. This one proves the second
 * dressing is a dressing: same simulation, same save, different world on screen
 * and different words around it. A theme that quietly failed to build its scene
 * would still pass every unit test, so the check that matters is that the island
 * boots wearing it and a tree can still be clicked.
 */
import { expect, test } from '@playwright/test';
import { clickAt, hurry, logsHome, openIsland, visibleTrees } from './harness.ts';

test('the fork opens, and it is the same island underneath', async ({ page, baseURL }) => {
  const problems = await openIsland(page, baseURL, '/?goblin');
  await expect(page.locator('#world')).toBeVisible();

  const state = await page.evaluate(() => ({
    theme: window.island.theme.id,
    rulebook: window.island.sim.rulebook.id,
    villagers: window.island.sim.world.villagers.length,
    trees: window.island.sim.world.sites.filter((site: any) => site.kind === 'tree').length,
    bogs: window.island.sim.world.sites.filter((site: any) => site.kind === 'bog').length,
  }));
  expect(state.theme).toBe('goblin');
  expect(state.rulebook, 'the fork changes the dressing, never the rules').toBe('settlement');
  expect(state.villagers).toBe(1);
  expect(state.trees).toBeGreaterThan(20);
  // The fork draws the bog and patch sites the bright island leaves undrawn.
  expect(state.bogs).toBeGreaterThan(0);

  await expect(page.locator('.brand')).toContainText('THE GOBLIN FORK');
  await expect(page.locator('.villager-name')).toContainText('Gnarlfoot');
  expect(problems).toEqual([]);
});

test('a goblin grumbles her way through a log', async ({ page }) => {
  const problems = await openIsland(page, undefined, '/?goblin');
  await hurry(page);
  const [tree] = await visibleTrees(page, 1);

  await page.mouse.move(tree.x, tree.y);
  await expect(page.locator('#tooltip-text')).toHaveText('Set her on it');
  await clickAt(page, tree);

  await page.waitForFunction(() => { const activity = window.island.sim.world.villagers[0].activity; return activity.kind === 'work' && activity.task === 'fell'; }, null, { timeout: 60_000 });
  await expect(page.locator('#work-progress')).toContainText('WEDGE & MALLET');
  await expect(page.locator('#status')).toHaveText('Wedge. Mallet. Mutter. Repeat.');

  await page.waitForFunction(() => !!window.island.sim.world.villagers[0].carrying, null, { timeout: 60_000 });
  await expect(page.locator('#status')).toContainText('awkward');

  await logsHome(page, 1);
  await expect(page.locator('#log-count')).toHaveText('1');
  await expect(page.locator('#toast')).toContainText('only one of me');
  // A worked-out tree loses its crown and grows the next crop on the stump.
  expect(await page.evaluate(id => window.island.view.treeSpent.get(id).visible, tree.id)).toBe(true);
  expect(problems).toEqual([]);
});

test('the switch changes the dressing and keeps the island', async ({ page }) => {
  await openIsland(page);
  await hurry(page);
  const trees = await visibleTrees(page, 1);
  await clickAt(page, trees[0]);
  await logsHome(page, 1);
  const before = await page.evaluate(() => window.island.sim.world.stats.treesFelled);

  await page.click('#theme');
  await page.waitForFunction(() => window.island?.theme.id === 'goblin', null, { timeout: 30_000 });
  await page.evaluate(() => document.querySelector<HTMLDialogElement>('#help-dialog')?.close());
  await expect(page.locator('#log-count')).toHaveText('1');
  expect(await page.evaluate(() => window.island.sim.world.stats.treesFelled)).toBe(before);

  // And the choice sticks, so a reload without the parameter stays in the fork.
  await page.goto('/');
  await page.waitForFunction(() => !!window.island, null, { timeout: 30_000 });
  expect(await page.evaluate(() => window.island.theme.id)).toBe('goblin');

  await page.click('#theme');
  await page.waitForFunction(() => window.island?.theme.id === 'island', null, { timeout: 30_000 });
  await expect(page.locator('.villager-name')).toContainText('Robin');
});
