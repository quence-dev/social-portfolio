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

async function clickForDownload(link) {
  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      link.click(),
    ]);
    return download;
  } catch (error) {
    for (const frame of page.frames()) {
      const closeAd = frame.locator('#dismiss-button');
      if (await closeAd.isVisible().catch(() => false)) {
        await closeAd.click();
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 30_000 }),
          link.click(),
        ]);
        return download;
      }
    }
    throw error;
  }
}

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

    const download = await clickForDownload(thumbnailLink);
    const failure = await download.failure();
    if (failure) throw new Error(`Thumbnail download failed: ${failure}`);
    const bytes = await fs.readFile(await download.path());
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Thumbnail download is not a JPEG.');
    await fs.writeFile(target, bytes, { flag: overwrite ? 'w' : 'wx' });
    downloaded += 1;
    console.log(`Saved ${relativePath(target)}`);
  } catch (error) {
    console.warn(`Skipped ${row.post_id}: ${error.message}`);
  }
}

await context.close();
await browser.close();
console.log(`Finished: ${downloaded} saved, ${skipped} already present.`);
