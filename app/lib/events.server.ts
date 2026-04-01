/**
 * Event Tracking for Try-On Analytics
 *
 * Logs try-on events to the database for analytics, debugging, and billing.
 */

import prisma from "../db.server";
import { getOrCreateShop } from "./billing.server";

export interface TryOnEventData {
  shopDomain: string;
  productImageUrl: string;
  productId?: string | null;
  success: boolean;
  errorMessage?: string | null;
  durationMs?: number | null;
}

/**
 * Log a try-on event to the database
 */
export async function logTryOnEvent(data: TryOnEventData) {
  const shop = await getOrCreateShop(data.shopDomain);

  const event = await prisma.tryOnEvent.create({
    data: {
      shopId: shop.id,
      productImageUrl: data.productImageUrl,
      productId: data.productId,
      success: data.success,
      errorMessage: data.errorMessage,
      durationMs: data.durationMs,
    },
  });

  return event;
}

/**
 * Mark an event as billed
 */
export async function markEventBilled(eventId: string) {
  return prisma.tryOnEvent.update({
    where: { id: eventId },
    data: {
      billed: true,
      billedAt: new Date(),
    },
  });
}

/**
 * Get unbilled events for a shop (for batch billing)
 */
export async function getUnbilledEvents(shopDomain: string, limit = 100) {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) return [];

  return prisma.tryOnEvent.findMany({
    where: {
      shopId: shop.id,
      success: true,
      billed: false,
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

/**
 * Get event stats for a shop
 */
export async function getShopEventStats(shopDomain: string, daysBack = 30) {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) return null;

  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const events = await prisma.tryOnEvent.findMany({
    where: {
      shopId: shop.id,
      createdAt: { gte: since },
    },
    select: {
      success: true,
      durationMs: true,
      createdAt: true,
    },
  });

  const total = events.length;
  const successful = events.filter((e) => e.success).length;
  const failed = total - successful;
  const avgDuration = events.reduce((acc, e) => acc + (e.durationMs || 0), 0) / (successful || 1);

  // Group by day
  const byDay = events.reduce((acc, e) => {
    const day = e.createdAt.toISOString().split("T")[0];
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    total,
    successful,
    failed,
    successRate: total > 0 ? (successful / total) * 100 : 0,
    avgDurationMs: Math.round(avgDuration),
    byDay,
  };
}

/**
 * Get all shops stats for admin dashboard
 */
export async function getAllShopsStats() {
  const shops = await prisma.shop.findMany({
    include: {
      _count: {
        select: { tryOnEvents: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return shops.map((shop) => ({
    id: shop.id,
    domain: shop.domain,
    name: shop.name,
    billingStatus: shop.billingStatus,
    usageThisMonth: shop.usageThisMonth,
    totalEvents: shop._count.tryOnEvents,
    trialEndsAt: shop.trialEndsAt,
    createdAt: shop.createdAt,
  }));
}
