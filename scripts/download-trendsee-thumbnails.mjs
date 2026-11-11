import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import {
  downloaderOptions, instagramRows, relativePath, thumbnailTarget,
} from './thumbnail-downloader.mjs';

const toolUrl = 'https://tools.trendsee.io/instagram-thumbnail-downloader';
const { headless, limit, overwrite } = downloaderOptions();

const rows = (await instagramRows()).slice(0, limit);

const browser = await chromium.launch({ headless });
const context = await browser.newContext();
const page = await context.newPage();
let downloaded = 0;
let skipped = 0;
let stopRequested = false;
const canListenForEscape = process.stdin.isTTY && typeof process.stdin.setRawMode === 'function';
const onStdinData = (data) => {
  if (!data.toString().includes('\u001b')) return;
  stopRequested = true;
  console.log('\nStopping after the current request...');
  browser.close().catch(() => {});
};

if (canListenForEscape) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', onStdinData);
  console.log('Press Escape to stop.');
}

for (const row of rows) {
  if (stopRequested) break;
  const target = await thumbnailTarget(row.post_id, overwrite);
  if (!target) { skipped += 1; continue; }

  try {
    await page.goto(toolUrl, { waitUntil: 'networkidle', timeout: 60_000 });
    const input = page.locator('input[aria-label="Instagram URL"][placeholder*="instagram.com/reel/"]').first();
    await input.waitFor({ state: 'visible', timeout: 30_000 });
    let retained = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await input.fill(row.url);
      await page.waitForTimeout(1_000);
      if (await input.inputValue() === row.url) {
        retained = true;
        break;
      }
    }
    if (!retained) throw new Error('Trendsee reset the URL field while loading.');
    await page.locator('button:has(span:text-is("Download"))').first().click();
    await page.waitForFunction(() => [...document.querySelectorAll('a')].some((link) => /download thumbnail/i.test(link.textContent || '') || /cdninstagram\.com|fbcdn\.net/.test(link.href)), undefined, { timeout: 90_000 });
    const imageUrl = await page.evaluate(() => [...document.querySelectorAll('a')]
      .find((link) => /download thumbnail/i.test(link.textContent || '') || /cdninstagram\.com|fbcdn\.net/.test(link.href))
      ?.href);
    if (!imageUrl) throw new Error('Trendsee did not return an image URL.');
    const response = await page.request.get(imageUrl);
    if (!response.ok()) throw new Error(`Image request failed (${response.status()}).`);
    await fs.writeFile(target, await response.body());
    downloaded += 1;
    console.log(`Saved ${relativePath(target)}`);
  } catch (error) {
    if (stopRequested) break;
    console.warn(`Skipped ${row.post_id}: ${error.message}`);
  }
}

if (canListenForEscape) {
  process.stdin.off('data', onStdinData);
  process.stdin.setRawMode(false);
  process.stdin.pause();
}
await context.close().catch(() => {});
await browser.close().catch(() => {});
console.log(`Finished: ${downloaded} saved, ${skipped} already present.`);

// shortcut: runs one request at a time to avoid hammering the public service.
// Use a provider API if this becomes a recurring large import.
