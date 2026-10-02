import { Injectable } from '@nestjs/common';
import { Observable, Subject, filter, interval, map, merge } from 'rxjs';

export type HubEvent =
  | { kind: 'request'; id: string; type: string; table: string }
  | { kind: 'update'; id: string; status: string }
  | {
      kind: 'feedback';
      id: string;
      rating: number;
      table: string | null;
      comment: string | null;
    }
  | { kind: 'menu'; dishId: string };

interface Envelope {
  restaurantId: string;
  event: HubEvent;
}

const HEARTBEAT_MS = 25_000;

/**
 * In-process fan-out of live events to staff screens (PLAN section 6,
 * realtime). One API container runs today; with several, this becomes a
 * PostgreSQL LISTEN/NOTIFY bridge. Clients also poll as a fallback.
 */
@Injectable()
export class ServiceHub {
  private readonly events = new Subject<Envelope>();

  publish(restaurantId: string, event: HubEvent) {
    this.events.next({ restaurantId, event });
  }

  /** Server-Sent Events for one restaurant, with a heartbeat every 25 s so
   * nginx and Cloudflare keep the connection open. */
  stream(restaurantId: string): Observable<{ data: unknown; type?: string }> {
    return merge(
      this.events.pipe(
        filter((envelope) => envelope.restaurantId === restaurantId),
        map((envelope) => ({ data: envelope.event })),
      ),
      interval(HEARTBEAT_MS).pipe(map(() => ({ type: 'ping', data: {} }))),
    );
  }
}
