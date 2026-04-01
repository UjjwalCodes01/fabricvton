/**
 * Shop Configuration Management
 *
 * Manage try-on settings for individual shops.
 */

import prisma from "../db.server";

export interface ShopConfig {
  tryOnEnabled: boolean;
  buttonPosition: string;
  buttonText: string;
  allowedProductTypes: string[];
}

/**
 * Get shop configuration
 */
export async function getShopConfig(shopDomain: string): Promise<ShopConfig | null> {
  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    select: {
      tryOnEnabled: true,
      buttonPosition: true,
      buttonText: true,
      allowedProductTypes: true,
    },
  });

  if (!shop) return null;

  return {
    tryOnEnabled: shop.tryOnEnabled,
    buttonPosition: shop.buttonPosition,
    buttonText: shop.buttonText,
    allowedProductTypes: shop.allowedProductTypes
      ? JSON.parse(shop.allowedProductTypes)
      : [],
  };
}

/**
 * Update shop configuration
 */
export async function updateShopConfig(
  shopDomain: string,
  config: Partial<ShopConfig>
) {
  const data: Record<string, unknown> = {};

  if (config.tryOnEnabled !== undefined) data.tryOnEnabled = config.tryOnEnabled;
  if (config.buttonPosition !== undefined) data.buttonPosition = config.buttonPosition;
  if (config.buttonText !== undefined) data.buttonText = config.buttonText;
  if (config.allowedProductTypes !== undefined) {
    data.allowedProductTypes = JSON.stringify(config.allowedProductTypes);
  }

  return prisma.shop.update({
    where: { domain: shopDomain },
    data,
  });
}

/**
 * Get product-specific configurations for a shop
 */
export async function getProductConfigs(shopDomain: string) {
  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    select: { id: true },
  });

  if (!shop) return [];

  return prisma.productTryOnConfig.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Create or update product configuration
 */
export async function upsertProductConfig(
  shopDomain: string,
  productId: string,
  config: {
    variantId?: string;
    sku?: string;
    garmentImageUrl?: string;
    garmentCategory?: string;
    enabled?: boolean;
  }
) {
  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    select: { id: true },
  });

  if (!shop) throw new Error("Shop not found");

  return prisma.productTryOnConfig.upsert({
    where: {
      shopId_productId_variantId: {
        shopId: shop.id,
        productId,
        variantId: config.variantId || "",
      },
    },
    update: {
      sku: config.sku,
      garmentImageUrl: config.garmentImageUrl,
      garmentCategory: config.garmentCategory,
      enabled: config.enabled,
    },
    create: {
      shopId: shop.id,
      productId,
      variantId: config.variantId,
      sku: config.sku,
      garmentImageUrl: config.garmentImageUrl,
      garmentCategory: config.garmentCategory,
      enabled: config.enabled ?? true,
    },
  });
}

/**
 * Delete product configuration
 */
export async function deleteProductConfig(configId: string) {
  return prisma.productTryOnConfig.delete({
    where: { id: configId },
  });
}
