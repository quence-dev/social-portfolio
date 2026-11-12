import fs from 'node:fs/promises';

const gallery = JSON.parse(await fs.readFile(new URL('../src/data/gallery.generated.json', import.meta.url), 'utf8'));
const posts = gallery.videos.flatMap((video) => video.posts);
const missing = posts.map((post) => {
  const fields = [];
  if (!post.thumbnail) fields.push('thumbnail');
  if (!post.publishDate) fields.push('publish date');
  if (post.views === null) fields.push('views');
  if (post.likes === null) fields.push('likes');
  return { post, fields };
}).filter(({ fields }) => fields.length);

console.log(`\n${posts.length} included posts; ${missing.length} have missing data.`);
for (const { post, fields } of missing) {
  console.log(`\n${post.postId}: ${fields.join(', ')}\n  ${post.url}`);
}
if (missing.length) {
  console.log('\nThumbnails: add <post_id>.jpg to public/thumbnails/.');
  console.log('Metrics: npm run metrics:instagram -- --input "/path/to/export.json"');
  console.log('Run npm run posts:status again after changes. Some posts do not expose likes.');
}
