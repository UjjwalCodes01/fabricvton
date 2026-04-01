/**
 * Platform Settings Management (Super Admin)
 */

import prisma from "../db.server";

export const MODEL_VERSIONS = [
  { value: "genlook_v1", label: "GenLook API v1", description: "Production model" },
  { value: "genlook_v2", label: "GenLook API v2", description: "Beta model with improved quality" },
  { value: "mock", label: "Mock Mode", description: "Returns placeholder images (for testing)" },
] as const;

export type ModelVersion = typeof MODEL_VERSIONS[number]["value"];

/**
 * Get platform settings
 */
export async function getPlatformSettings() {
  let settings = await prisma.platformSettings.findUnique({
    where: { id: "default" },
  });

  if (!settings) {
    settings = await prisma.platformSettings.create({
      data: { id: "default" },
    });
  }

  return settings;
}

/**
 * Update platform settings
 */
export async function updatePlatformSettings(data: {
  activeModelVersion?: string;
  fallbackModelVersion?: string;
  maintenanceMode?: boolean;
  maxTrialTryOns?: number;
  pricePerTryOn?: number;
}) {
  return prisma.platformSettings.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });
}

/**
 * Suspend a shop
 */
export async function suspendShop(shopDomain: string, reason?: string) {
  return prisma.shop.update({
    where: { domain: shopDomain },
    data: {
      isActive: false,
      suspendedAt: new Date(),
    },
  });
}

/**
 * Reactivate a shop
 */
export async function reactivateShop(shopDomain: string) {
  return prisma.shop.update({
    where: { domain: shopDomain },
    data: {
      isActive: true,
      suspendedAt: null,
    },
  });
}

/**
 * Get detailed shop info for admin
 */
export async function getShopDetails(shopDomain: string) {
  return prisma.shop.findUnique({
    where: { domain: shopDomain },
    include: {
      _count: {
        select: {
          tryOnEvents: true,
          productConfigs: true,
          supportTickets: true,
        },
      },
    },
  });
}

/**
 * Get all shops with extended info
 */
export async function getAllShopsExtended() {
  return prisma.shop.findMany({
    include: {
      _count: {
        select: {
          tryOnEvents: true,
          supportTickets: { where: { status: "open" } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
