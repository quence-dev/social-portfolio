import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { thumbnailFileName } from './thumbnail-file.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = path.join(root, 'data/posts.csv');
const authDir = path.join(root, '.auth');
const storageStatePath = path.join(authDir, 'instagram.json');
const refreshPath = path.join(root, 'data/refresh.json');
const thumbnailDir = path.join(root, 'public/thumbnails');
const loginMode = process.argv.includes('--login');

function csvRows(text) {
  const records = [];
  let row = []; let cell = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i += 1; } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell); cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); if (row.some(Boolean)) records.push(row); row = []; cell = '';
    } else cell += char;
  }
  row.push(cell); if (row.some(Boolean)) records.push(row);
  const [headers, ...rows] = records;
  return rows.map((values) => Object.fromEntries(headers.map((key, index) => [key, values[index] || ''])));
}

function numberFrom(html, field) {
  const match = html.match(new RegExp(`"${field}":\\s*(\\d+)`));
  return match ? Number(match[1]) : null;
}

await fs.mkdir(authDir, { recursive: true });
if (loginMode) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://www.instagram.com/accounts/login/');
  const prompt = readline.createInterface({ input, output });
  await prompt.question('Log in to Instagram in the opened browser, then press Enter here. ');
  prompt.close();
  await page.context().storageState({ path: storageStatePath });
  await browser.close();
  console.log('Saved local Instagram session.');
  process.exit();
}

try { await fs.access(storageStatePath); } catch { throw new Error('Run `npm run refresh -- --login` once before refreshing.'); }

const rows = csvRows(await fs.readFile(csvPath, 'utf8'))
  .filter((row) => row.include.toLowerCase() === 'true' && row.url.includes('instagram.com'));
let refresh = {};
try { refresh = JSON.parse(await fs.readFile(refreshPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await fs.mkdir(thumbnailDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ storageState: storageStatePath });
for (const row of rows) {
  const fileName = thumbnailFileName(row.post_id);
  const page = await context.newPage();
  try {
    await page.goto(row.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const html = await page.content();
    const thumbnail = await page.locator('meta[property="og:image"]').getAttribute('content');
    const timestamp = numberFrom(html, 'taken_at_timestamp');
    const views = numberFrom(html, 'play_count') ?? numberFrom(html, 'video_view_count');
    const likes = numberFrom(html, 'like_count');
    const thumbnailPath = path.join(thumbnailDir, fileName);
    if (thumbnail) {
      const response = await context.request.get(thumbnail);
      if (response.ok()) await fs.writeFile(thumbnailPath, await response.body());
    }
    let imagePath = null;
    try {
      await fs.access(thumbnailPath);
      imagePath = `/thumbnails/${fileName}`;
    } catch {
      // A thumbnail is optional until a download succeeds.
    }
    refresh[row.post_id] = {
      publishDate: timestamp ? new Date(timestamp * 1000).toISOString().slice(0, 10) : null,
      thumbnail: imagePath,
      views,
      likes,
    };
    console.log(`Refreshed ${row.post_id}`);
  } catch (error) {
    console.warn(`Skipped ${row.post_id}: ${error.message}`);
  } finally {
    await page.close();
  }
}
await browser.close();
refresh.refreshedAt = new Date().toISOString();
await fs.writeFile(refreshPath, `${JSON.stringify(refresh, null, 2)}\n`);
console.log('Refresh complete. Run `npm run import` to update the gallery data.');
