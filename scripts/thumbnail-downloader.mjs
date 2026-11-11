import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { csvRecords } from './csv.mjs';
import { thumbnailFileName } from './thumbnail-file.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const thumbnailDir = path.join(root, 'public/thumbnails');

export function downloaderOptions(argv = process.argv) {
  const limitFlag = argv.indexOf('--limit');
  return {
    headless: argv.includes('--headless'),
    limit: limitFlag === -1 ? Infinity : Number(argv[limitFlag + 1]),
    overwrite: argv.includes('--overwrite'),
  };
}

export async function instagramRows() {
  const csvPath = path.join(root, 'data/posts.csv');
  const rows = csvRecords(await fs.readFile(csvPath, 'utf8'))
    .filter((row) => row.include.toLowerCase() === 'true' && row.url.includes('instagram.com'));
  await fs.mkdir(thumbnailDir, { recursive: true });
  return rows;
}

export async function thumbnailTarget(postId, overwrite, directory = thumbnailDir) {
  const target = path.join(directory, thumbnailFileName(postId));
  if (overwrite) return target;
  try {
    await fs.access(target);
    return null;
  } catch {
    return target;
  }
}

export function relativePath(target) {
  return path.relative(root, target);
}
