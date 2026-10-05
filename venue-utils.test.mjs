import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedRating, venueOffer } from './venue-utils.mjs';

test('only supplied ratings with reviews and labeled offers are displayed', () => {
  assert.deepEqual(verifiedRating({ rating: { value: 4.7, count: 32 } }), { value: 4.7, count: 32 });
  assert.equal(verifiedRating({ rating: null }), null);
  assert.equal(verifiedRating({ rating: { value: 4.9, count: 0 } }), null);
  assert.equal(verifiedRating({ rating: { value: 9, count: 12 } }), null);
  assert.equal(venueOffer({ offer: { label: ' ', terms: 'Example' } }), null);
  assert.equal(venueOffer({ offer: { label: 'Evening deal', terms: 'Example' } }).label, 'Evening deal');
});
