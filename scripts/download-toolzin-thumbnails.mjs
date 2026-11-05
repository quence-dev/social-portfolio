import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = path.join(root, 'data/posts.csv');
const thumbnailDir = path.join(root, 'public/thumbnails');
const toolUrl = 'https://toolzin.com/tools/instagram-downloader/';
const overwrite = process.argv.includes('--overwrite');
const headless = process.argv.includes('--headless');
const limitFlag = process.argv.indexOf('--limit');
const limit = limitFlag === -1 ? Infinity : Number(process.argv[limitFlag + 1]);
const limitMessage = 'You have reached the request limit.';
const limitCooldownMs = 120_000;

function parseCsv(text) {
  const records = [];
  let row = []; let cell = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell); if (row.some(Boolean)) records.push(row); row = []; cell = '';
    } else cell += char;
  }
  row.push(cell); if (row.some(Boolean)) records.push(row);
  const [headers, ...rows] = records;
  return rows.map((values) => Object.fromEntries(headers.map((key, index) => [key, values[index] || ''])));
}

const rows = parseCsv(await fs.readFile(csvPath, 'utf8'))
  .filter((row) => row.include.toLowerCase() === 'true' && row.url.includes('instagram.com'));

await fs.mkdir(thumbnailDir, { recursive: true });
const browser = await chromium.launch({ headless });
const context = await browser.newContext();
const page = await context.newPage();
context.on('page', (popup) => {
  if (popup !== page) popup.close().catch(() => {});
});
let downloaded = 0;
let skipped = 0;

for (const row of rows) {
  if (downloaded >= limit) break;
  const target = path.join(thumbnailDir, `${row.post_id}.jpg`);
  if (!overwrite) {
    try { await fs.access(target); skipped += 1; continue; } catch { /* thumbnail is missing */ }
  }

  let retriedAfterAdNavigation = false;
  let retry = true;
  while (retry) {
    retry = false;
    try {
      await page.goto(toolUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      const reelTab = page.locator('#nav-reel-tab');
      await reelTab.waitFor({ state: 'visible', timeout: 30_000 });
      await reelTab.click();

      const input = page.locator('input[name="url"]');
      await input.waitFor({ state: 'visible', timeout: 30_000 });
      await input.fill(row.url);
      await page.waitForTimeout(500);
      if (await input.inputValue() !== row.url) throw new Error('Toolzin reset the URL field while loading.');

      await page.locator('#btn_submit, button:has-text("Download Now")').first().click();
      await page.waitForTimeout(3_000);
      const saveThumbnail = page.locator('a.dl-thumbnail').first();
      const rateLimit = page.locator('#ajax_result p').filter({ hasText: limitMessage });
      const outcome = await Promise.race([
        saveThumbnail.waitFor({ state: 'visible', timeout: 90_000 }).then(() => 'thumbnail'),
        rateLimit.waitFor({ state: 'visible', timeout: 90_000 }).then(() => 'limit'),
      ]);
      if (outcome === 'limit') {
        console.warn(`Toolzin reached its request limit. Retrying ${row.post_id} in 120 seconds...`);
        await page.waitForTimeout(limitCooldownMs);
        retry = true;
        continue;
      }
      const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
      await saveThumbnail.click();
      const download = await downloadPromise;
      await download.saveAs(target);
      downloaded += 1;
      console.log(`Saved ${path.relative(root, target)}`);
    } catch (error) {
      const host = new URL(page.url()).hostname;
      if (!retriedAfterAdNavigation && !host.endsWith('toolzin.com')) {
        retriedAfterAdNavigation = true;
        retry = true;
        console.warn(`Toolzin opened an external page. Retrying ${row.post_id}...`);
        await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => null);
        continue;
      }
      console.warn(`Skipped ${row.post_id}: ${error.message}`);
    }
  }
}

await context.close();
await browser.close();
console.log(`Finished: ${downloaded} saved, ${skipped} already present.`);

// shortcut: retries explicit limits and one ad-triggered navigation; update the cooldown if Toolzin changes its reset window.
