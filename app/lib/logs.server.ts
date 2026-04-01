/**
 * API Logs and Monitoring
 *
 * Track API calls for debugging and monitoring.
 */

import prisma from "../db.server";

interface LogEntry {
  shopDomain?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs?: number;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  productId?: string;
  modelVersion?: string;
}

/**
 * Log an API call
 */
export async function logApiCall(entry: LogEntry) {
  let shopId: string | undefined;

  if (entry.shopDomain) {
    const shop = await prisma.shop.findUnique({
      where: { domain: entry.shopDomain },
      select: { id: true },
    });
    shopId = shop?.id;
  }

  return prisma.apiLog.create({
    data: {
      shopId,
      shopDomain: entry.shopDomain,
      endpoint: entry.endpoint,
      method: entry.method,
      statusCode: entry.statusCode,
      durationMs: entry.durationMs,
      success: entry.success,
      errorType: entry.errorType,
      errorMessage: entry.errorMessage,
      productId: entry.productId,
      modelVersion: entry.modelVersion,
    },
  });
}

/**
 * Get recent API logs (for super admin)
 */
export async function getRecentLogs(options: {
  limit?: number;
  shopDomain?: string;
  successOnly?: boolean;
  errorsOnly?: boolean;
  since?: Date;
}) {
  const { limit = 100, shopDomain, successOnly, errorsOnly, since } = options;

  const where: Record<string, unknown> = {};

  if (shopDomain) where.shopDomain = shopDomain;
  if (successOnly) where.success = true;
  if (errorsOnly) where.success = false;
  if (since) where.createdAt = { gte: since };

  return prisma.apiLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Get error summary (grouped by error type)
 */
export async function getErrorSummary(daysBack: number = 7) {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const errors = await prisma.apiLog.groupBy({
    by: ["errorType"],
    where: {
      success: false,
      createdAt: { gte: since },
      errorType: { not: null },
    },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  return errors.map((e) => ({
    errorType: e.errorType || "Unknown",
    count: e._count.id,
  }));
}

/**
 * Get latency percentiles
 */
export async function getLatencyStats(daysBack: number = 7) {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const logs = await prisma.apiLog.findMany({
    where: {
      success: true,
      durationMs: { not: null },
      createdAt: { gte: since },
    },
    select: { durationMs: true },
    orderBy: { durationMs: "asc" },
  });

  if (logs.length === 0) {
    return { p50: 0, p95: 0, p99: 0, avg: 0 };
  }

  const durations = logs.map((l) => l.durationMs!);
  const sum = durations.reduce((a, b) => a + b, 0);

  return {
    p50: durations[Math.floor(durations.length * 0.5)] || 0,
    p95: durations[Math.floor(durations.length * 0.95)] || 0,
    p99: durations[Math.floor(durations.length * 0.99)] || 0,
    avg: Math.round(sum / durations.length),
  };
}

/**
 * Clean up old logs (retention policy)
 */
export async function cleanupOldLogs(daysToKeep: number = 30) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysToKeep);

  const result = await prisma.apiLog.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return result.count;
}
