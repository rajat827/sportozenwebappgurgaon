import test from 'node:test';
import assert from 'node:assert/strict';
import { spotsRemaining, spotsLabel } from './pickup-utils.mjs';

test('pickup spots show an authoritative count only when supplied', () => {
  assert.equal(spotsLabel({ spotsLeft: 3 }), '3 spots left');
  assert.equal(spotsLabel({ spotsLeft: 1 }), '1 spot left');
  assert.equal(spotsLabel({ spotsLeft: 0 }), 'Full');
  assert.equal(spotsRemaining({ spotsLeft: null }), null);
  assert.equal(spotsLabel({ spotsLeft: null }), 'Check spots on WhatsApp');
  assert.equal(spotsLabel({ spotsLeft: -1 }), 'Check spots on WhatsApp');
});
