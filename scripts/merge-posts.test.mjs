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

test('skips an existing URL even when its incoming ID is different or missing', () => {
  const incoming = `${header}\nvideo-1,new-id,https://instagram.com/reel/one,A,1/1/2026,editor,,TRUE,,,\nvideo-1,,https://instagram.com/reel/one,A,1/1/2026,editor,,TRUE,,,\nvideo-2,new-id,https://instagram.com/reel/two,B,2/1/2026,editor,,TRUE,,,\n`;
  const { additions, output } = mergePosts(existing, incoming);
  assert.equal(additions.length, 1);
  assert.match(output, /instagram-one,[^\n]*,50,5/);
  assert.match(output, /new-id,https:\/\/instagram\.com\/reel\/two/);
});

test('recognizes equivalent Instagram and YouTube URL forms', () => {
  const source = `${existing}video-2,youtube-AbCd,https://youtu.be/AbCd,A,1/1/2026,editor,,TRUE,,,\n`;
  const incoming = `${header}\nvideo-1,instagram-one,https://www.instagram.com/reels/one/?utm_source=share,A,1/1/2026,editor,,TRUE,,,\nvideo-2,youtube-AbCd,https://youtube.com/shorts/AbCd?feature=share,A,1/1/2026,editor,,TRUE,,,\n`;
  assert.equal(mergePosts(source, incoming).additions.length, 0);
  const differentCase = `${header}\nvideo-2,youtube-AbCd,https://youtube.com/shorts/abcd,A,1/1/2026,editor,,TRUE,,,\n`;
  assert.throws(() => mergePosts(source, differentCase), /Conflicting existing post/);
});

test('recognizes equivalent TikTok, X, and LinkedIn post links', () => {
  const cases = [
    ['tiktok-123', 'https://www.tiktok.com/@old/video/123', 'https://tiktok.com/@new/video/123/?share=1'],
    ['twitter-456', 'https://twitter.com/person/status/456', 'https://x.com/i/web/status/456?s=20'],
    ['linkedin-789', 'https://www.linkedin.com/posts/person_topic-ugcPost-789-abc', 'https://linkedin.com/feed/update/urn:li:ugcPost:789/?tracking=1'],
  ];
  for (const [id, original, alternate] of cases) {
    const source = `${header}\nvideo-1,${id},${original},A,1/1/2026,editor,,TRUE,,,\n`;
    const incoming = `${header}\nvideo-1,${id},${alternate},A,1/1/2026,editor,,TRUE,,,\n`;
    assert.equal(mergePosts(source, incoming).additions.length, 0);
    const different = incoming.replace(alternate, alternate.replace(/123|456|789/, '999'));
    assert.throws(() => mergePosts(source, different), /Conflicting existing post/);
  }
});
