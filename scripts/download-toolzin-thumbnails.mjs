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
  .filter((row) => row.include.toLowerCase() === 'true' && row.url.includes('instagram.com'))
  .slice(0, limit);

await fs.mkdir(thumbnailDir, { recursive: true });
const browser = await chromium.launch({ headless });
const context = await browser.newContext();
const page = await context.newPage();
let downloaded = 0;
let skipped = 0;

for (const row of rows) {
  const target = path.join(thumbnailDir, `${row.post_id}.jpg`);
  if (!overwrite) {
    try { await fs.access(target); skipped += 1; continue; } catch { /* thumbnail is missing */ }
  }

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
    const saveThumbnail = page.locator('a.dl-thumbnail').first();
    await saveThumbnail.waitFor({ state: 'visible', timeout: 90_000 });
    const imageUrl = await saveThumbnail.evaluate((link) => link.href);
    if (!imageUrl || imageUrl.startsWith('javascript:')) {
      throw new Error('Toolzin returned a Save Thumbnail link without a direct image URL.');
    }

    const response = await context.request.get(imageUrl);
    const contentType = response.headers()['content-type'] || '';
    if (!response.ok() || !contentType.startsWith('image/')) {
      throw new Error(`Thumbnail request failed (${response.status()} ${contentType || 'unknown type'}).`);
    }
    await fs.writeFile(target, await response.body());
    downloaded += 1;
    console.log(`Saved ${path.relative(root, target)}`);
  } catch (error) {
    console.warn(`Skipped ${row.post_id}: ${error.message}`);
  }
}

await context.close();
await browser.close();
console.log(`Finished: ${downloaded} saved, ${skipped} already present.`);

// shortcut: runs one request at a time; stop and wait if Toolzin signals a limit instead of rotating around it.
