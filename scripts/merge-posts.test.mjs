import assert from 'node:assert/strict';
import test from 'node:test';
import { mergePosts } from './merge-posts.mjs';

const header = 'video_id,post_id,url,creator,shoot_date,roles,publish_date,include,sponsors,views,likes';
const existing = `${header}\nvideo-1,instagram-one,https://instagram.com/reel/one,A,1/1/2026,editor,2026-01-02,TRUE,,50,5\n`;

test('appends only new posts without changing existing metrics', () => {
  const incomingHeader = 'video_id,post_id,url,creator,shoot_date,roles,include,sponsors';
  const incoming = `${incomingHeader}\nvideo-1,instagram-one,https://instagram.com/reel/one,A,1/1/2026,editor,TRUE,\nvideo-2,instagram-two,https://instagram.com/reel/two,B,2/1/2026,videographer,TRUE,\n`;
  const { additions, output } = mergePosts(existing, incoming);
  assert.equal(additions.length, 1);
  assert.match(output, /instagram-one,[^\n]*,50,5/);
  assert.match(output, /instagram-two/);
});

test('rejects a row whose ID and URL disagree with the existing catalog', () => {
  const incoming = `${header}\nvideo-2,instagram-one,https://instagram.com/reel/two,B,2/1/2026,videographer,,TRUE,,,\n`;
  assert.throws(() => mergePosts(existing, incoming), /Conflicting existing post/);
});
