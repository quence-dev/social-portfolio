import { chromium } from 'playwright';
import {
  downloaderOptions, instagramRows, relativePath, thumbnailTarget,
} from './thumbnail-downloader.mjs';

const toolUrl = 'https://toolzin.com/tools/instagram-downloader/';
const { headless, limit, overwrite } = downloaderOptions();
const limitMessage = 'You have reached the request limit.';
const limitCooldownMs = 120_000;

const rows = await instagramRows();
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
  const target = await thumbnailTarget(row.post_id, overwrite);
  if (!target) { skipped += 1; continue; }

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
      console.log(`Saved ${relativePath(target)}`);
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

// shortcut: retries explicit limits and one ad-triggered navigation.
// Update the cooldown if Toolzin changes its reset window.
