import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const gallery = JSON.parse(await fs.readFile(new URL('../src/data/gallery.generated.json', import.meta.url), 'utf8'));

function total(posts, field) {
  const values = posts.map((post) => post[field]).filter((value) => value !== null);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

test('keeps post IDs unique and video metrics aggregated from uploads', () => {
  const postIds = gallery.videos.flatMap((video) => video.posts.map((post) => post.postId));
  assert.equal(new Set(postIds).size, postIds.length);

  for (const video of gallery.videos) {
    assert.ok(video.posts.every((post) => post.videoId === video.videoId));
    assert.equal(video.views, total(video.posts, 'views'));
    assert.equal(video.likes, total(video.posts, 'likes'));
  }
});
