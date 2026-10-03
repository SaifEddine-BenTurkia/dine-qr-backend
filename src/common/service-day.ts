/**
 * A service day runs from 05:00 to 05:00 in Tunis (04:00 UTC, no DST): a café
 * open until 2 a.m. keeps the same day for its order numbers, its closing and
 * its "sell by tonight" stock.
 */
export function serviceDay(now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(4, 0, 0, 0);
  if (start > now) start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { key: start.toISOString().slice(0, 10), start, end };
}

/** Hours since the service day started (0 at 05:00 Tunis, 23 at 04:00). */
export function serviceHour(now = new Date()) {
  return (now.getUTCHours() + 20) % 24;
}
