import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

/**
 * Verifies a `Paddle-Signature` header (`ts=...;h1=...`).
 *
 * Paddle signs `${ts}:${rawBody}` with HMAC-SHA256 using the notification
 * destination's secret. Several h1 values can be present while a secret is
 * being rotated; any match is accepted. Old timestamps are refused so a
 * captured request cannot be replayed later.
 */
export function verifyPaddleSignature(
  header: string | undefined,
  rawBody: Buffer,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || !secret) return false;

  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of header.split(';')) {
    const [key, value] = part.split('=', 2);
    if (key === 'ts') timestamp = value;
    if (key === 'h1' && value) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return false;

  const ts = Number(timestamp);
  if (
    !Number.isInteger(ts) ||
    Math.abs(nowSeconds - ts) > SIGNATURE_TOLERANCE_SECONDS
  ) {
    return false;
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}:`)
    .update(rawBody)
    .digest();

  return signatures.some((signature) => {
    const given = Buffer.from(signature, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export interface PaddleSubscriptionEvent {
  event_id: string;
  event_type: string;
  occurred_at: string;
  data: {
    id: string;
    status: 'active' | 'trialing' | 'past_due' | 'paused' | 'canceled';
    customer_id: string;
    updated_at?: string;
    custom_data?: { userId?: string } | null;
    current_billing_period?: { starts_at: string; ends_at: string } | null;
    scheduled_change?: { action: string; effective_at: string } | null;
  };
}
