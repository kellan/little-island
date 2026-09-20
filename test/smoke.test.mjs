// Loads the built site in a real browser with every third-party request blocked.
// The unit tests cannot see a page that compiles and then renders nothing.
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.SMOKE_PORT ?? 4180);
const BASE = `http://127.0.0.1:${PORT}`;
let server, browser;

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { if ((await fetch(BASE + '/')).ok) return; } catch { /* not listening yet */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`preview server never answered on ${BASE}`);
};

const openPage = async path => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  // Anything off-origin is treated as unreachable: offline, blocked, or firewalled.
  await page.route('**', route => new URL(route.request().url()).origin === BASE ? route.continue() : route.abort());
  await page.goto(BASE + path, { waitUntil: 'load' });
  return { page, errors };
};

describe('built site', () => {
  before(async () => {
    server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
      { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
    await waitForServer();
    // CHROMIUM_PATH lets a sandbox with a pre-installed browser skip `playwright install`.
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });
  });
  after(async () => { await browser?.close(); server?.kill(); });

  it('renders the island when no third-party resource loads', async () => {
    const { page, errors } = await openPage('/');
    await page.waitForSelector('#world', { timeout: 20000 });
    assert.equal(await page.locator('#log-count').textContent(), '0');
    assert.match(await page.locator('.brand').textContent(), /LITTLE ISLAND/);
    assert.deepEqual(errors, []);
    await page.close();
  });

  it('renders the stress lab when no third-party resource loads', async () => {
    const { page, errors } = await openPage('/?lab&scenario=agents');
    await page.waitForSelector('#lab-world', { timeout: 20000 });
    assert.match(await page.locator('.lab-header').textContent(), /TECHNICAL PROVING GROUND/);
    assert.deepEqual(errors, []);
    await page.close();
  });

  it('reports live frame, simulation and instancing cost in the lab', async () => {
    const { page, errors } = await openPage('/?lab&scenario=agents&trees=200&agents=200');
    await page.waitForSelector('#lab-world', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('#fps').textContent !== '—', null, { timeout: 30000 });
    for (const id of ['#fps', '#p95', '#sim', '#instancing', '#pick']) {
      const value = Number(await page.locator(id).textContent());
      assert.ok(Number.isFinite(value), `${id} should read as a number, got ${await page.locator(id).textContent()}`);
    }
    assert.match(await page.locator('#worst').textContent(), /WORST \d/);
    assert.equal(await page.locator('#draws').textContent(), '5');
    assert.deepEqual(errors, []);
    await page.close();
  });

  it('takes zero counts from the URL, for an empty baseline to attribute against', async () => {
    const { page, errors } = await openPage('/?lab&trees=0&agents=0');
    await page.waitForSelector('#lab-world', { timeout: 20000 });
    await page.waitForFunction(() => document.querySelector('#draws').textContent !== '—', null, { timeout: 30000 });
    // Water and island only: no forest, no workers.
    assert.equal(await page.locator('#draws').textContent(), '2');
    assert.equal(await page.locator('#trees').inputValue(), '0');
    assert.equal(await page.locator('#agents').inputValue(), '0');
    assert.deepEqual(errors, []);
    await page.close();
  });

  it('round trips saved state exactly from the panel', async () => {
    const { page } = await openPage('/?lab&scenario=soak&trees=200&agents=300');
    await page.waitForSelector('#lab-world', { timeout: 20000 });
    await page.click('#roundtrip');
    await page.waitForFunction(() => document.querySelector('#save-size').textContent !== 'NOT RUN', null, { timeout: 20000 });
    assert.match(await page.locator('#save-size').textContent(), /KB · EXACT/);
    assert.ok(Number(await page.locator('#save').textContent()) < 250);
    await page.close();
  });

  it('walks, chops and delivers a log that survives a reload', async () => {
    const { page, errors } = await openPage('/');
    await page.waitForSelector('#world', { timeout: 20000 });
    let tree = null;
    outer: for (let y = 250; y < 700; y += 25) for (let x = 200; x < 1100; x += 25) {
      await page.mouse.move(x, y);
      if (await page.locator('#tooltip').getAttribute('hidden') === null) { tree = { x, y }; break outer; }
    }
    assert.ok(tree, 'expected to find a clickable tree');
    await page.mouse.click(tree.x, tree.y);
    await page.waitForFunction(() => document.querySelector('#log-count').textContent !== '0', null, { timeout: 90000 });
    assert.equal(await page.locator('#log-count').textContent(), '1');
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#world', { timeout: 20000 });
    assert.equal(await page.locator('#log-count').textContent(), '1');
    assert.deepEqual(errors, []);
    await page.close();
  });
});
