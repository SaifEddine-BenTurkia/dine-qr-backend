import type { Request } from 'express';

/**
 * The real visitor address.
 *
 * Traffic reaches the API through Cloudflare and then nginx, so `req.ip` is our
 * own proxy for every request. Cloudflare's `CF-Connecting-IP` is the client;
 * it is only trustworthy because the VPS firewall accepts 80/443 from
 * Cloudflare's ranges alone. `X-Forwarded-For` (left-most entry) covers local
 * setups without Cloudflare.
 */
export function clientIp(req: Request): string {
  const cloudflareIp = req.headers['cf-connecting-ip'];
  if (typeof cloudflareIp === 'string' && cloudflareIp.length > 0) {
    return cloudflareIp;
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }

  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}
