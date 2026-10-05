import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEndTime, composeMessage } from './booking-utils.mjs';

test('start and duration calculate the end time, including overnight', () => {
  assert.deepEqual(calculateEndTime('19:00', 60), { time: '20:00', nextDay: false });
  assert.deepEqual(calculateEndTime('23:30', 60), { time: '00:30', nextDay: true });
});

test('WhatsApp enquiry carries both start and end times', () => {
  const message = composeMessage(
    { id: 'spada-sector43', name: 'SPADA Arenas', locality: 'Sector 43' },
    { sport: 'Football', preferredDate: '2026-10-07', preferredStartTime: '19:00', preferredEndTime: '20:00', endNextDay: false, durationMinutes: 60 },
    'ENQ-123'
  );
  assert.match(message, /Start time: 19:00/);
  assert.match(message, /End time: 20:00/);
  assert.match(message, /Enquiry reference: ENQ-123/);
  assert.match(message, /not a confirmed booking/);
});
