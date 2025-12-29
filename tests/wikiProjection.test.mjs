import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeWikiRecordToEvent } from '../electron/wiki-projection.ts';

test('normalizeWikiRecordToEvent returns null for non-object / invalid shapes', () => {
  assert.equal(normalizeWikiRecordToEvent(null), null);
  assert.equal(normalizeWikiRecordToEvent(undefined), null);
  assert.equal(normalizeWikiRecordToEvent([]), null);
  assert.equal(normalizeWikiRecordToEvent({}), null);
  assert.equal(normalizeWikiRecordToEvent({ type: 'wiki-entry' }), null);
});

test('normalizeWikiRecordToEvent maps wiki-entry -> WIKI_NODE_CREATED', () => {
  const event = normalizeWikiRecordToEvent({
    type: 'wiki-entry',
    term: 'Neural Networks',
    createdAt: '2025-01-01T00:00:00.000Z',
    sourceCardId: 'card-123',
  });

  assert.ok(event);
  assert.equal(event.type, 'WIKI_NODE_CREATED');
  assert.equal(event.payload.title, 'Neural Networks');
  assert.equal(event.payload.id, 'neural-networks');
  assert.equal(event.payload.sourceCardId, 'card-123');
  assert.equal(event.payload.createdAt, '2025-01-01T00:00:00.000Z');
});

test('normalizeWikiRecordToEvent maps wiki-term-meta -> WIKI_NODE_CREATED w/ related nodes + replaceRelatedEdges', () => {
  const event = normalizeWikiRecordToEvent({
    type: 'wiki-term-meta',
    term: 'Neural Networks',
    slug: 'nn',
    definition: 'A network of neurons',
    relatedTerms: ['Deep Learning', 'Backpropagation', '', 123, null],
    updatedAt: '2025-02-01T00:00:00.000Z',
  });

  assert.ok(event);
  assert.equal(event.type, 'WIKI_NODE_CREATED');
  assert.equal(event.payload.id, 'nn');
  assert.equal(event.payload.title, 'Neural Networks');
  assert.equal(event.payload.summary, 'A network of neurons');
  assert.equal(event.payload.createdAt, '2025-02-01T00:00:00.000Z');
  assert.equal(event.payload.replaceRelatedEdges, true);

  assert.ok(Array.isArray(event.payload.relatedNodes));
  assert.deepEqual(event.payload.relatedNodes, [
    { id: 'deep-learning', title: 'Deep Learning' },
    { id: 'backpropagation', title: 'Backpropagation' },
  ]);
});
