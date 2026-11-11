import assert from 'node:assert/strict';
import test from 'node:test';
import { csvLine, csvRecords, parseCsv } from './csv.mjs';

test('parses quoted commas, escaped quotes, and CRLF line endings', () => {
  const rows = parseCsv('creator,roles\r\nAustin,"videographer, editor"\r\n"A ""Quoted"" Name",editor\r\n');
  assert.deepEqual(rows, [
    ['creator', 'roles'],
    ['Austin', 'videographer, editor'],
    ['A "Quoted" Name', 'editor'],
  ]);
});

test('maps CSV rows to records and serializes values safely', () => {
  assert.deepEqual(csvRecords('post_id,sponsors\npost-1,"Brand, Inc."\n'), [{
    post_id: 'post-1',
    sponsors: 'Brand, Inc.',
  }]);
  assert.deepEqual(parseCsv(`${csvLine(['Brand, Inc.', 'A "Quote"'])}\n`), [['Brand, Inc.', 'A "Quote"']]);
});
