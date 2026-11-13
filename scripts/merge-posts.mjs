import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { csvLine, parseCsv } from './csv.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function rowsByHeader(rows, headers) {
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, (values[index] || '').trim()])));
}

function urlKey(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const instagram = host === 'instagram.com' && url.pathname.match(/^\/(?:reel|reels|p)\/([^/]+)/);
    if (instagram) return `instagram:${instagram[1]}`;
    const youtube = host === 'youtu.be' ? url.pathname.match(/^\/([^/]+)/)?.[1]
      : host === 'youtube.com' ? url.pathname.match(/^\/shorts\/([^/]+)/)?.[1] || (url.pathname === '/watch' ? url.searchParams.get('v') : null) : null;
    if (youtube) return `youtube:${youtube}`;
    url.hostname = host;
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    url.hash = '';
    return url.href;
  } catch {
    return value;
  }
}

export function mergePosts(sourceText, incomingText) {
  const [headers, ...sourceRows] = parseCsv(sourceText);
  const [incomingHeaders, ...incomingRows] = parseCsv(incomingText);
  if (!headers?.length || !incomingHeaders?.length) throw new Error('Both CSV files need a header row.');
  for (const required of ['post_id', 'url']) {
    if (!headers.includes(required) || !incomingHeaders.includes(required)) {
      throw new Error(`Both CSV files need a ${required} column.`);
    }
  }
  const existing = rowsByHeader(sourceRows, headers);
  const incoming = rowsByHeader(incomingRows, incomingHeaders);
  const postIds = new Set(existing.map((row) => row.post_id));
  const urls = new Set(existing.map((row) => urlKey(row.url)));
  const additions = [];

  for (const row of incoming) {
    if (row.url && urls.has(urlKey(row.url))) continue;
    if (!row.post_id || !row.url) throw new Error('Incoming rows need both post_id and url.');
    if (postIds.has(row.post_id)) throw new Error(`Conflicting existing post: ${row.post_id}`);
    additions.push(headers.map((header) => row[header] || ''));
    postIds.add(row.post_id);
    urls.add(urlKey(row.url));
  }

  return { additions, output: `${[headers, ...sourceRows, ...additions].map(csvLine).join('\n')}\n` };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputIndex = process.argv.indexOf('--input');
  const inputPath = inputIndex === -1 ? null : process.argv[inputIndex + 1];
  if (!inputPath) throw new Error('Usage: npm run posts:merge -- --input /absolute/path/to/posts.csv');

  const sourcePath = path.join(root, 'data/posts.csv');
  const result = mergePosts(await fs.readFile(sourcePath, 'utf8'), await fs.readFile(inputPath, 'utf8'));
  if (!result.additions.length) {
    console.log('No new posts found.');
  } else {
    await fs.writeFile(sourcePath, result.output);
    console.log(`Added ${result.additions.length} new post${result.additions.length === 1 ? '' : 's'} to data/posts.csv.`);
  }
}
