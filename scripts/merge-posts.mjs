import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { csvLine, parseCsv } from './csv.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function rowsByHeader(rows, headers) {
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, (values[index] || '').trim()])));
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
  const urls = new Set(existing.map((row) => row.url));
  const additions = [];

  for (const row of incoming) {
    if (!row.post_id || !row.url) throw new Error('Incoming rows need both post_id and url.');
    const knownPost = postIds.has(row.post_id);
    const knownUrl = urls.has(row.url);
    if (knownPost || knownUrl) {
      if (knownPost !== knownUrl) throw new Error(`Conflicting existing post: ${row.post_id}`);
      continue;
    }
    additions.push(headers.map((header) => row[header] || ''));
    postIds.add(row.post_id);
    urls.add(row.url);
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
