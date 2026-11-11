import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  downloaderOptions, instagramRows, relativePath, thumbnailTarget,
} from './thumbnail-downloader.mjs';

const toolUrl = 'https://fastvideosave.net/photo';
const { headless, limit, overwrite } = downloaderOptions();
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
    const input = page.getByRole('textbox', { name: 'Media link' });
    await input.waitFor({ state: 'visible', timeout: 30_000 });
    await input.fill(row.url);

    const thumbnailLink = page.getByRole('link', { name: /download thumbnail/i }).first();
    try {
      await thumbnailLink.waitFor({ state: 'visible', timeout: 5_000 });
    } catch {
      await page.locator('#paste-btn').click();
      await thumbnailLink.waitFor({ state: 'visible', timeout: 60_000 });
    }

    const href = await thumbnailLink.getAttribute('href');
    if (!href) throw new Error('FastVideoSave returned a thumbnail link without an address.');
    const response = await context.request.get(new URL(href, page.url()).href);
    if (!response.ok()) throw new Error(`Thumbnail download failed (${response.status()}).`);
    if (!response.headers()['content-type']?.startsWith('image/')) throw new Error('Thumbnail link did not return an image.');
    await fs.writeFile(target, await response.body());
    downloaded += 1;
    console.log(`Saved ${relativePath(target)}`);
  } catch (error) {
    console.warn(`Skipped ${row.post_id}: ${error.message}`);
  }
}

await context.close();
await browser.close();
console.log(`Finished: ${downloaded} saved, ${skipped} already present.`);
