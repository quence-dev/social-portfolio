import assert from 'node:assert/strict';
import test from 'node:test';
import { thumbnailFileName } from './thumbnail-file.mjs';

test('creates a thumbnail filename from a safe post ID', () => {
  assert.equal(thumbnailFileName('instagram-DP1f_1CkeuD'), 'instagram-DP1f_1CkeuD.jpg');
});

test('rejects post IDs that could escape the thumbnail folder', () => {
  assert.throws(() => thumbnailFileName('../../outside'));
  assert.throws(() => thumbnailFileName('nested/file'));
});
