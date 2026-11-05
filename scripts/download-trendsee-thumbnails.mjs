import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = path.join(root, 'data/posts.csv');
const thumbnailDir = path.join(root, 'public/thumbnails');
const toolUrl = 'https://tools.trendsee.io/instagram-thumbnail-downloader';
const overwrite = process.argv.includes('--overwrite');
const headless = process.argv.includes('--headless');
const limitFlag = process.argv.indexOf('--limit');
const limit = limitFlag === -1 ? Infinity : Number(process.argv[limitFlag + 1]);

function parseCsv(text) {
  const records = [];
  let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
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
const page = await browser.newPage();
let downloaded = 0;
let skipped = 0;

for (const row of rows) {
  const target = path.join(thumbnailDir, `${row.post_id}.jpg`);
  if (!overwrite) {
    try { await fs.access(target); skipped += 1; continue; } catch { /* thumbnail is missing */ }
  }

  try {
    await page.goto(toolUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.getByLabel('Instagram URL').fill(row.url);
    await page.getByRole('button', { name: 'Download' }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('a')].some((link) =>
      /download thumbnail/i.test(link.textContent || '') || /cdninstagram\.com|fbcdn\.net/.test(link.href),
    ), undefined, { timeout: 90_000 });
    const imageUrl = await page.evaluate(() => [...document.querySelectorAll('a')]
      .find((link) => /download thumbnail/i.test(link.textContent || '') || /cdninstagram\.com|fbcdn\.net/.test(link.href))
      ?.href);
    if (!imageUrl) throw new Error('Trendsee did not return an image URL.');
    const response = await page.request.get(imageUrl);
    if (!response.ok()) throw new Error(`Image request failed (${response.status()}).`);
    await fs.writeFile(target, await response.body());
    downloaded += 1;
    console.log(`Saved ${path.relative(root, target)}`);
  } catch (error) {
    console.warn(`Skipped ${row.post_id}: ${error.message}`);
  }
}

await browser.close();
console.log(`Finished: ${downloaded} saved, ${skipped} already present.`);

// shortcut: runs one request at a time to avoid hammering the public service; use a provider API if this becomes a recurring large import.
