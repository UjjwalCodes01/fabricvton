/**
 * Analytics Functions for Dashboards
 *
 * Provides data aggregation for charts and reports.
 */

import prisma from "../db.server";

interface DailyStats {
  date: string;
  total: number;
  successful: number;
  failed: number;
}

interface ProductStats {
  productId: string;
  productImageUrl: string;
  totalTryOns: number;
  successRate: number;
}

/**
 * Get daily try-on stats for a shop (for line charts)
 */
export async function getDailyTryOnStats(
  shopDomain: string,
  daysBack: number = 30
): Promise<DailyStats[]> {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) return [];

  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  since.setHours(0, 0, 0, 0);

  const events = await prisma.tryOnEvent.findMany({
    where: {
      shopId: shop.id,
      createdAt: { gte: since },
    },
    select: {
      success: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by day
  const byDay: Record<string, { total: number; successful: number; failed: number }> = {};

  // Initialize all days
  for (let i = 0; i < daysBack; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    byDay[key] = { total: 0, successful: 0, failed: 0 };
  }

  // Fill in actual data
  for (const event of events) {
    const day = event.createdAt.toISOString().split("T")[0];
    if (!byDay[day]) byDay[day] = { total: 0, successful: 0, failed: 0 };
    byDay[day].total++;
    if (event.success) {
      byDay[day].successful++;
    } else {
      byDay[day].failed++;
    }
  }

  return Object.entries(byDay)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get top performing products by try-on count
 */
export async function getTopProducts(
  shopDomain: string,
  limit: number = 10
): Promise<ProductStats[]> {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) return [];

  const events = await prisma.tryOnEvent.groupBy({
    by: ["productImageUrl"],
    where: {
      shopId: shop.id,
      productImageUrl: { not: "" },
    },
    _count: true,
    orderBy: { _count: { id: "desc" } },
    take: limit,
  });

  // Get success counts separately
  const results: ProductStats[] = [];
  for (const event of events) {
    const totalTryOns = event._count ?? 0;
    const successCount = await prisma.tryOnEvent.count({
      where: {
        shopId: shop.id,
        productImageUrl: event.productImageUrl,
        success: true,
      },
    });

    results.push({
      productId: event.productImageUrl.split("/").pop() || "unknown",
      productImageUrl: event.productImageUrl,
      totalTryOns,
      successRate: totalTryOns > 0 ? (successCount / totalTryOns) * 100 : 0,
    });
  }

  return results;
}

/**
 * Get global platform stats (for super admin)
 */
export async function getGlobalStats(daysBack: number = 30) {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const [totalShops, activeShops, totalEvents, successfulEvents, failedEvents] = await Promise.all([
    prisma.shop.count(),
    prisma.shop.count({ where: { isActive: true } }),
    prisma.tryOnEvent.count({ where: { createdAt: { gte: since } } }),
    prisma.tryOnEvent.count({ where: { createdAt: { gte: since }, success: true } }),
    prisma.tryOnEvent.count({ where: { createdAt: { gte: since }, success: false } }),
  ]);

  // Average duration
  const avgDuration = await prisma.tryOnEvent.aggregate({
    where: { createdAt: { gte: since }, success: true, durationMs: { not: null } },
    _avg: { durationMs: true },
  });

  // Revenue estimate (successful events * price)
  const pricePerTryOn = 0.10;
  const billedEvents = await prisma.tryOnEvent.count({
    where: { createdAt: { gte: since }, success: true, billed: true },
  });

  return {
    totalShops,
    activeShops,
    totalEvents,
    successfulEvents,
    failedEvents,
    errorRate: totalEvents > 0 ? (failedEvents / totalEvents) * 100 : 0,
    avgLatencyMs: Math.round(avgDuration._avg.durationMs || 0),
    estimatedRevenue: billedEvents * pricePerTryOn,
  };
}

/**
 * Get daily global stats (for super admin charts)
 */
export async function getGlobalDailyStats(daysBack: number = 30): Promise<DailyStats[]> {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);
  since.setHours(0, 0, 0, 0);

  const events = await prisma.tryOnEvent.findMany({
    where: { createdAt: { gte: since } },
    select: { success: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const byDay: Record<string, { total: number; successful: number; failed: number }> = {};

  for (let i = 0; i < daysBack; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    byDay[key] = { total: 0, successful: 0, failed: 0 };
  }

  for (const event of events) {
    const day = event.createdAt.toISOString().split("T")[0];
    if (!byDay[day]) byDay[day] = { total: 0, successful: 0, failed: 0 };
    byDay[day].total++;
    if (event.success) byDay[day].successful++;
    else byDay[day].failed++;
  }

  return Object.entries(byDay)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Generate CSV data for export
 */
export async function exportTryOnEventsCSV(
  shopDomain: string,
  daysBack: number = 30
): Promise<string> {
  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) return "";

  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const events = await prisma.tryOnEvent.findMany({
    where: { shopId: shop.id, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });

  const headers = ["Date", "Product URL", "Success", "Duration (ms)", "Error"];
  const rows = events.map((e) => [
    e.createdAt.toISOString(),
    e.productImageUrl,
    e.success ? "Yes" : "No",
    e.durationMs?.toString() || "",
    e.errorMessage || "",
  ]);

  return [headers.join(","), ...rows.map((r) => r.map(escapeCSV).join(","))].join("\n");
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
