import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  downloaderOptions, instagramRows, relativePath, thumbnailTarget,
} from './thumbnail-downloader.mjs';

const toolUrl = 'https://ig.snaplytics.io/instagram-thumbnail-downloader/';
const { headless, limit, overwrite } = downloaderOptions();

async function imageFrom(context, page, link) {
  const href = await link.getAttribute('href');
  if (!href) throw new Error('Snaplytics returned a thumbnail link without an address.');
  const response = await context.request.get(new URL(href, page.url()).href);
  if (!response.ok()) throw new Error(`Thumbnail download failed (${response.status()}).`);
  if (!response.headers()['content-type']?.startsWith('image/')) throw new Error('Thumbnail link did not return an image.');
  return response.body();
}

const rows = await instagramRows();
const browser = await chromium.launch({ headless });
const context = await browser.newContext();
const page = await context.newPage();
let downloaded = 0;
let skipped = 0;

for (const row of rows) {
  if (downloaded >= limit) break;
  const target = await thumbnailTarget(row.post_id, overwrite);
  if (!target) { skipped += 1; continue; }

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
    console.log(`Saved ${relativePath(target)}`);
  } catch (error) {
    console.warn(`Skipped ${row.post_id}: ${error.message}`);
  }
}

await context.close();
await browser.close();
console.log(`Finished: ${downloaded} saved, ${skipped} already present.`);
