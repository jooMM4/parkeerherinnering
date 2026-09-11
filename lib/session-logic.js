export const PRESETS = {
  BLUE_ZONE: 'blue-zone',
  PAID: 'paid',
  NONE: 'none',
};

export const BLUE_ZONE_MINUTES = 120;
export const WARNING_MINUTES_BEFORE = 10;

export function calculateExpiryTimestamp(presetType, customMinutes, startTimestamp) {
  if (presetType === PRESETS.NONE) return null;
  if (presetType === PRESETS.BLUE_ZONE) return startTimestamp + BLUE_ZONE_MINUTES * 60 * 1000;
  if (presetType === PRESETS.PAID) {
    if (!Number.isFinite(customMinutes) || customMinutes <= 0) {
      throw new Error('customMinutes must be a positive number for the paid preset');
    }
    return startTimestamp + customMinutes * 60 * 1000;
  }
  throw new Error(`Unknown presetType: ${presetType}`);
}

export function getRemainingMs(expiryTimestamp, now) {
  if (expiryTimestamp === null || expiryTimestamp === undefined) return null;
  return expiryTimestamp - now;
}

export function formatRemainingTime(remainingMs) {
  if (remainingMs === null || remainingMs === undefined) return 'Geen limiet';
  if (remainingMs <= 0) return 'Verlopen';
  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}u ${minutes}m resterend`;
  return `${minutes}m resterend`;
}

export function getNotificationDue(session, now) {
  if (session.expiryTimestamp === null || session.expiryTimestamp === undefined) return null;
  if (now >= session.expiryTimestamp) return session.notifiedExpiry ? null : 'expiry';
  const warningAt = session.expiryTimestamp - WARNING_MINUTES_BEFORE * 60 * 1000;
  if (!session.notified10min && now >= warningAt) return 'warning';
  return null;
}
