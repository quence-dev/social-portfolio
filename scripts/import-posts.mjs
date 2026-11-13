import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.mjs';
import { thumbnailFileName } from './thumbnail-file.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'data/posts.csv');
const refreshPath = path.join(root, 'data/refresh.json');
const outputPath = path.join(root, 'src/data/gallery.generated.json');
const checkOnly = process.argv.includes('--check');

const requiredColumns = ['video_id', 'post_id', 'url', 'creator', 'shoot_date', 'roles', 'publish_date', 'include', 'sponsors', 'views', 'likes'];

function asDate(value) {
  if (!value) return null;
  const parts = value.split('/').map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    return new Date(Date.UTC(parts[2], parts[0] - 1, parts[1])).toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10);
}

function platformFor(url) {
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes('instagram.com')) return 'instagram';
  if (host.includes('youtu')) return 'youtube';
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com') || host === 'lnkd.in') return 'linkedin';
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  if (['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'].includes(host)) return 'twitter';
  return 'other';
}

function list(value) {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
}

function metric(value) {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function unique(values) {
  return [...new Set(values)];
}

function dateValue(post) {
  return post.publishDate || post.shootDate || '';
}

const csvRows = parseCsv(await fs.readFile(sourcePath, 'utf8'));
if (!csvRows.length) throw new Error('posts.csv is empty.');
const headers = csvRows[0].map((header) => header.trim());
const missingColumns = requiredColumns.filter((column) => !headers.includes(column));
if (missingColumns.length) throw new Error(`Missing columns: ${missingColumns.join(', ')}`);

let refresh = {};
try {
  refresh = JSON.parse(await fs.readFile(refreshPath, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const seenPosts = new Set();
const seenUrls = new Set();
const posts = [];

for (const [index, values] of csvRows.slice(1).entries()) {
  const raw = Object.fromEntries(headers.map((header, column) => [header, (values[column] || '').trim()]));
  if (raw.include.toLowerCase() !== 'true') continue;
  const rowNumber = index + 2;
  for (const key of ['video_id', 'post_id', 'url', 'creator', 'roles']) {
    if (!raw[key]) throw new Error(`Row ${rowNumber}: ${key} is required for included posts.`);
  }
  if (!/^https?:\/\//.test(raw.url)) throw new Error(`Row ${rowNumber}: invalid URL.`);
  if (seenPosts.has(raw.post_id)) throw new Error(`Duplicate post_id: ${raw.post_id}`);
  if (seenUrls.has(raw.url)) throw new Error(`Duplicate URL: ${raw.url}`);
  seenPosts.add(raw.post_id);
  seenUrls.add(raw.url);

  const cached = refresh[raw.post_id] || {};
  const fileName = thumbnailFileName(raw.post_id);
  let thumbnail = null;
  try {
    await fs.access(path.join(root, 'public/thumbnails', fileName));
    thumbnail = `/thumbnails/${fileName}`;
  } catch {
    // A thumbnail is optional until it is downloaded.
  }
  posts.push({
    videoId: raw.video_id,
    postId: raw.post_id,
    url: raw.url,
    platform: platformFor(raw.url),
    creator: raw.creator,
    shootDate: asDate(raw.shoot_date),
    publishDate: cached.publishDate || asDate(raw.publish_date),
    roles: list(raw.roles),
    sponsors: list(raw.sponsors),
    thumbnail,
    views: metric(cached.views) ?? metric(raw.views),
    likes: metric(cached.likes) ?? metric(raw.likes),
  });
}

const videosById = new Map();
for (const post of posts) {
  const group = videosById.get(post.videoId) || [];
  group.push(post);
  videosById.set(post.videoId, group);
}

const videos = [...videosById.entries()].map(([videoId, group]) => {
  const ordered = [...group].sort((a, b) => {
    const views = (b.views || 0) - (a.views || 0);
    return views || dateValue(b).localeCompare(dateValue(a));
  });
  const primary = ordered[0];
  const values = (field) => group.map((post) => post[field]).filter((value) => value !== null);
  const sum = (field) => {
    const metricValues = values(field);
    return metricValues.length ? metricValues.reduce((total, value) => total + value, 0) : null;
  };
  return {
    videoId,
    posts: ordered,
    creator: primary.creator,
    roles: unique(group.flatMap((post) => post.roles)),
    sponsors: unique(group.flatMap((post) => post.sponsors)),
    thumbnail: primary.thumbnail,
    publishDate: ordered.map(dateValue).find(Boolean) || null,
    shootDate: primary.shootDate,
    views: sum('views'),
    likes: sum('likes'),
  };
});

videos.sort((a, b) => (b.publishDate || '').localeCompare(a.publishDate || ''));
const viewPosts = posts.filter((post) => post.views !== null).length;
const likePosts = posts.filter((post) => post.likes !== null).length;
const gallery = {
  refreshedAt: refresh.refreshedAt || null,
  postCount: posts.length,
  metricCoverage: { views: viewPosts, likes: likePosts },
  videos,
};

console.log(`Validated ${posts.length} included posts across ${videos.length} videos.`);
if (!checkOnly) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(gallery, null, 2)}\n`);
  console.log(`Wrote ${path.relative(root, outputPath)}.`);
}
