import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESETS,
  WARNING_MINUTES_BEFORE,
  calculateExpiryTimestamp,
  getRemainingMs,
  formatRemainingTime,
  getNotificationDue,
} from '../lib/session-logic.js';

test('calculateExpiryTimestamp: blue zone adds 120 minutes', () => {
  const start = 1000000;
  const expiry = calculateExpiryTimestamp(PRESETS.BLUE_ZONE, null, start);
  assert.equal(expiry, start + 120 * 60 * 1000);
});

test('calculateExpiryTimestamp: none returns null', () => {
  assert.equal(calculateExpiryTimestamp(PRESETS.NONE, null, 1000000), null);
});

test('calculateExpiryTimestamp: paid uses customMinutes', () => {
  const start = 1000000;
  const expiry = calculateExpiryTimestamp(PRESETS.PAID, 45, start);
  assert.equal(expiry, start + 45 * 60 * 1000);
});

test('calculateExpiryTimestamp: paid without valid customMinutes throws', () => {
  assert.throws(() => calculateExpiryTimestamp(PRESETS.PAID, 0, 1000000));
  assert.throws(() => calculateExpiryTimestamp(PRESETS.PAID, NaN, 1000000));
});

test('calculateExpiryTimestamp: unknown preset throws', () => {
  assert.throws(() => calculateExpiryTimestamp('bogus', null, 1000000));
});

test('getRemainingMs: null expiry returns null', () => {
  assert.equal(getRemainingMs(null, 1000000), null);
});

test('getRemainingMs: computes difference', () => {
  assert.equal(getRemainingMs(5000, 2000), 3000);
});

test('formatRemainingTime: no limit', () => {
  assert.equal(formatRemainingTime(null), 'Geen limiet');
});

test('formatRemainingTime: expired', () => {
  assert.equal(formatRemainingTime(-1), 'Verlopen');
  assert.equal(formatRemainingTime(0), 'Verlopen');
});

test('formatRemainingTime: minutes only', () => {
  assert.equal(formatRemainingTime(25 * 60 * 1000), '25m resterend');
});

test('formatRemainingTime: hours and minutes', () => {
  assert.equal(formatRemainingTime(125 * 60 * 1000), '2u 5m resterend');
});

test('getNotificationDue: warning fires at 10 min before expiry', () => {
  const expiryTimestamp = 1000000;
  const session = { expiryTimestamp, notified10min: false, notifiedExpiry: false };
  const now = expiryTimestamp - WARNING_MINUTES_BEFORE * 60 * 1000;
  assert.equal(getNotificationDue(session, now), 'warning');
});

test('getNotificationDue: expiry takes priority over warning when both due', () => {
  const expiryTimestamp = 1000000;
  const session = { expiryTimestamp, notified10min: false, notifiedExpiry: false };
  assert.equal(getNotificationDue(session, expiryTimestamp), 'expiry');
});

test('getNotificationDue: nothing due before warning window', () => {
  const expiryTimestamp = 1000000;
  const session = { expiryTimestamp, notified10min: false, notifiedExpiry: false };
  const now = expiryTimestamp - 20 * 60 * 1000;
  assert.equal(getNotificationDue(session, now), null);
});

test('getNotificationDue: null when already notified and nothing further due', () => {
  const expiryTimestamp = 1000000;
  const session = { expiryTimestamp, notified10min: true, notifiedExpiry: false };
  const now = expiryTimestamp - WARNING_MINUTES_BEFORE * 60 * 1000;
  assert.equal(getNotificationDue(session, now), null);
});

test('getNotificationDue: no-limit session never due', () => {
  const session = { expiryTimestamp: null, notified10min: false, notifiedExpiry: false };
  assert.equal(getNotificationDue(session, Date.now()), null);
});

test('getNotificationDue: does not fall through to warning after expiry has fired (short paid session)', () => {
  // Regression for: a paid session shorter than the 10-minute warning window never
  // schedules a warning timer, so notified10min stays false forever while notifiedExpiry
  // becomes true. Once expiry has passed, this must return null, never 'warning'.
  const expiryTimestamp = 1000000;
  const session = { expiryTimestamp, notified10min: false, notifiedExpiry: true };
  const now = expiryTimestamp + 60 * 60 * 1000; // well past expiry
  assert.equal(getNotificationDue(session, now), null);
});
