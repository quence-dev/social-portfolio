import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { csvRecords } from './csv.mjs';
import { thumbnailFileName } from './thumbnail-file.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = path.join(root, 'data/posts.csv');
const thumbnailDir = path.join(root, 'public/thumbnails');
const toolUrl = 'https://ig.snaplytics.io/instagram-thumbnail-downloader/';
const overwrite = process.argv.includes('--overwrite');
const headless = process.argv.includes('--headless');
const limitFlag = process.argv.indexOf('--limit');
const limit = limitFlag === -1 ? Infinity : Number(process.argv[limitFlag + 1]);

async function imageFrom(context, page, link) {
  const href = await link.getAttribute('href');
  if (!href) throw new Error('Snaplytics returned a thumbnail link without an address.');
  const response = await context.request.get(new URL(href, page.url()).href);
  if (!response.ok()) throw new Error(`Thumbnail download failed (${response.status()}).`);
  if (!response.headers()['content-type']?.startsWith('image/')) throw new Error('Thumbnail link did not return an image.');
  return response.body();
}

const rows = csvRecords(await fs.readFile(csvPath, 'utf8'))
  .filter((row) => row.include.toLowerCase() === 'true' && row.url.includes('instagram.com'));

await fs.mkdir(thumbnailDir, { recursive: true });
const browser = await chromium.launch({ headless });
const context = await browser.newContext();
const page = await context.newPage();
let downloaded = 0;
let skipped = 0;

for (const row of rows) {
  if (downloaded >= limit) break;
  const target = path.join(thumbnailDir, thumbnailFileName(row.post_id));
  if (!overwrite) {
    try { await fs.access(target); skipped += 1; continue; } catch { /* thumbnail is missing */ }
  }

  try {
    await page.goto(toolUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const input = page.locator('#instagramInput');
    await input.waitFor({ state: 'visible', timeout: 30_000 });
    await input.fill(row.url);
    await page.locator('#downloadButton').click();

    const faster = page.locator('#downloadPostImageFaster');
    const direct = page.locator('#downloadPostImageStream');
    await Promise.all([
      faster.waitFor({ state: 'visible', timeout: 90_000 }),
      direct.waitFor({ state: 'visible', timeout: 90_000 }),
    ]);
    let image;
    try {
      image = await imageFrom(context, page, faster);
    } catch {
      console.warn(`Faster link failed for ${row.post_id}; trying direct link.`);
      image = await imageFrom(context, page, direct);
    }
    await fs.writeFile(target, image);
    downloaded += 1;
    console.log(`Saved ${path.relative(root, target)}`);
  } catch (error) {
    console.warn(`Skipped ${row.post_id}: ${error.message}`);
  }
}

await context.close();
await browser.close();
console.log(`Finished: ${downloaded} saved, ${skipped} already present.`);
