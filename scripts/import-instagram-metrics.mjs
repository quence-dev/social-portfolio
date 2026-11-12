import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvLine, parseCsv } from './csv.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'data/posts.csv');
const inputIndex = process.argv.indexOf('--input');
const inputPath = inputIndex === -1 ? null : process.argv[inputIndex + 1];

if (!inputPath) {
  throw new Error('Usage: npm run metrics:instagram -- --input /absolute/path/to/reel-scraper.json');
}

function shortcode(url) {
  return url.match(/instagram\.com\/(?:reel|reels|p)\/([^/?#]+)/)?.[1] || null;
}

function metric(value) {
  return Number.isFinite(value) && value >= 0 ? String(value) : '';
}

const rows = parseCsv(await fs.readFile(sourcePath, 'utf8'));
const [headers, ...posts] = rows;
const columns = new Map(headers.map((header, index) => [header, index]));
for (const required of ['post_id', 'url', 'publish_date', 'include', 'views', 'likes']) {
  if (!columns.has(required)) throw new Error(`posts.csv is missing ${required}.`);
}

const records = JSON.parse(await fs.readFile(inputPath, 'utf8'));
if (!Array.isArray(records)) throw new Error('Expected the API file to contain a JSON array.');

const apiByCode = new Map();
for (const record of records) {
  if (!record.shortCode) throw new Error(`Metric record is missing a shortcode: ${record.inputUrl || 'unknown'}.`);
  if (apiByCode.has(record.shortCode)) throw new Error(`Duplicate API record: ${record.shortCode}.`);
  apiByCode.set(record.shortCode, record);
}

const matchedCodes = new Set();
let updated = 0;
for (const post of posts) {
  if (post[columns.get('include')].toLowerCase() !== 'true') continue;
  const code = shortcode(post[columns.get('url')]);
  if (!code) continue;
  const record = apiByCode.get(code);
  if (!record) continue;
  if (record.timestamp) post[columns.get('publish_date')] = record.timestamp;
  const views = metric(record.videoPlayCount);
  const likes = metric(record.likesCount);
  if (views) post[columns.get('views')] = views;
  if (likes) post[columns.get('likes')] = likes;
  matchedCodes.add(code);
  updated += 1;
}

const unmatchedApiCodes = [...apiByCode.keys()].filter((code) => !matchedCodes.has(code));
if (!updated) throw new Error('No included Instagram posts matched this API export.');

await fs.writeFile(sourcePath, `${[headers, ...posts].map(csvLine).join('\n')}\n`);
console.log(`Updated publish date, views, and likes for ${updated} Instagram posts. Ignored ${unmatchedApiCodes.length} unmatched API records.`);
