import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ServiceRequestStatus,
  ServiceRequestType,
  type DiningTable,
  type ServiceRequest,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RestaurantAccessService } from '../restaurant/restaurant-access.service';
import { ServiceHub } from './service-hub';

/** One request per table and type every 2 minutes (P1-05). */
export const SERVICE_COOLDOWN_MS = 2 * 60 * 1000;

const ACTIVE: ServiceRequestStatus[] = ['OPEN', 'ACKNOWLEDGED'];

type WithTable = ServiceRequest & {
  table: Pick<DiningTable, 'label' | 'zone'>;
};

export function toRequestView(request: WithTable) {
  return {
    id: request.id,
    type: request.type,
    status: request.status,
    table: request.table.label,
    zone: request.table.zone,
    createdAt: request.createdAt,
    acknowledgedAt: request.acknowledgedAt,
    resolvedAt: request.resolvedAt,
  };
}

export interface GuestTableRef {
  tableToken?: string;
  tableLabel?: string;
}

@Injectable()
export class ServiceRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: RestaurantAccessService,
    private readonly hub: ServiceHub,
  ) {}

  /**
   * The table a guest is sitting at: from the QR token, or from the number
   * they picked when the QR has none (the restaurant-wide QR still works).
   */
  async resolveTable(restaurantId: string, ref: GuestTableRef) {
    if (ref.tableToken) {
      const table = await this.prisma.diningTable.findFirst({
        where: { token: ref.tableToken, restaurantId, active: true },
      });
      if (table) return table;
    }
    if (ref.tableLabel) {
      const table = await this.prisma.diningTable.findFirst({
        where: { label: ref.tableLabel, restaurantId, active: true },
      });
      if (table) return table;
    }
    return null;
  }

  async createFromGuest(
    restaurantId: string,
    sessionId: string,
    type: ServiceRequestType,
    ref: GuestTableRef,
  ) {
    const table = await this.resolveTable(restaurantId, ref);
    if (!table) {
      throw new BadRequestException('Choisissez votre table');
    }
    // Cooldown: a second tap (or another phone at the same table) within two
    // minutes gets the existing request instead of a new one.
    const recent = await this.prisma.serviceRequest.findFirst({
      where: {
        tableId: table.id,
        type,
        status: { in: ACTIVE },
        createdAt: { gte: new Date(Date.now() - SERVICE_COOLDOWN_MS) },
      },
      include: { table: true },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) return toRequestView(recent);

    const request = await this.prisma.serviceRequest.create({
      data: { restaurantId, tableId: table.id, sessionId, type },
      include: { table: true },
    });
    await this.prisma.event.create({
      data: {
        restaurantId,
        type: 'service_requested',
        tableId: table.id,
        sessionId,
        props: { requestType: type },
      },
    });
    this.hub.publish(restaurantId, {
      kind: 'request',
      id: request.id,
      type,
      table: table.label,
    });
    return toRequestView(request);
  }

  async guestStatus(restaurantId: string, id: string, sessionId: string) {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { id, restaurantId },
      include: { table: true },
    });
    if (!request) throw new NotFoundException();
    if (request.sessionId !== sessionId) throw new ForbiddenException();
    return toRequestView(request);
  }

  async cancelFromGuest(restaurantId: string, id: string, sessionId: string) {
    const request = await this.guestStatus(restaurantId, id, sessionId);
    if (!ACTIVE.includes(request.status)) return request;
    return this.setStatus(restaurantId, id, 'CANCELLED');
  }

  async listActive(userId: string) {
    const restaurantId = await this.access.restaurantIdOrNull(userId);
    if (!restaurantId) return [];
    const requests = await this.prisma.serviceRequest.findMany({
      where: { restaurantId, status: { in: ACTIVE } },
      include: { table: true },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return requests.map(toRequestView);
  }

  async acknowledge(userId: string, id: string) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    return this.setStatus(restaurantId, id, 'ACKNOWLEDGED');
  }

  async done(userId: string, id: string) {
    const restaurantId = await this.access.restaurantIdFor(userId);
    return this.setStatus(restaurantId, id, 'DONE');
  }

  /** Requests and average response time (request → "J'arrive") per day. */
  async stats(userId: string, days: number) {
    const restaurantId = await this.access.restaurantIdOrNull(userId);
    if (!restaurantId) return [];
    return this.prisma.$queryRaw<
      { date: string; requests: number; avgResponseSeconds: number | null }[]
    >(Prisma.sql`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Tunis')::date, 'YYYY-MM-DD') AS date,
             count(*)::int AS requests,
             round(avg(extract(epoch FROM ("acknowledgedAt" - "createdAt"))))::int AS "avgResponseSeconds"
      FROM "ServiceRequest"
      WHERE "restaurantId" = ${restaurantId}
        AND "createdAt" >= now() - (${days}::int * interval '1 day')
      GROUP BY 1
      ORDER BY 1`);
  }

  private async setStatus(
    restaurantId: string,
    id: string,
    status: ServiceRequestStatus,
  ) {
    const existing = await this.prisma.serviceRequest.findFirst({
      where: { id, restaurantId },
    });
    if (!existing) throw new NotFoundException('Demande introuvable');
    const now = new Date();
    const request = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        status,
        ...(status === 'ACKNOWLEDGED' && { acknowledgedAt: now }),
        ...((status === 'DONE' || status === 'CANCELLED') && {
          resolvedAt: now,
          acknowledgedAt:
            existing.acknowledgedAt ?? (status === 'DONE' ? now : null),
        }),
      },
      include: { table: true },
    });
    const eventType =
      status === 'ACKNOWLEDGED'
        ? 'service_acknowledged'
        : status === 'DONE'
          ? 'service_resolved'
          : 'service_cancelled';
    await this.prisma.event.create({
      data: {
        restaurantId,
        type: eventType,
        tableId: request.tableId,
        props: { requestType: request.type },
      },
    });
    this.hub.publish(restaurantId, { kind: 'update', id, status });
    return toRequestView(request);
  }
}
