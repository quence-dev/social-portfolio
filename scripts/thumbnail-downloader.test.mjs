import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { downloaderOptions, thumbnailTarget } from './thumbnail-downloader.mjs';

test('reads downloader options', () => {
  assert.deepEqual(downloaderOptions(['node', 'script']), {
    headless: false,
    limit: Infinity,
    overwrite: false,
  });
  assert.deepEqual(downloaderOptions(['node', 'script', '--headless', '--overwrite', '--limit', '2']), {
    headless: true,
    limit: 2,
    overwrite: true,
  });
});

test('skips existing thumbnails unless overwrite is requested', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'social-portfolio-'));
  const postId = 'instagram-DP1f_1CkeuD';
  const target = path.join(directory, `${postId}.jpg`);
  try {
    assert.equal(await thumbnailTarget(postId, false, directory), target);
    await fs.writeFile(target, 'thumbnail');
    assert.equal(await thumbnailTarget(postId, false, directory), null);
    assert.equal(await thumbnailTarget(postId, true, directory), target);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
