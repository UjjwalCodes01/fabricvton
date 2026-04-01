/**
 * Shopify Billing API Integration
 *
 * Implements usage-based billing with a free trial:
 * - 7-day free trial with 50 try-ons
 * - After trial: $0.10 per try-on (usage-based)
 * - Capped usage amount for predictability
 */

import prisma from "../db.server";

// Billing configuration
export const BILLING_CONFIG = {
  TRIAL_DAYS: 7,
  TRIAL_TRYONS: 50,
  PRICE_PER_TRYON: 0.10,
  CAPPED_AMOUNT: 100.00, // Max charge per billing period
  PLAN_NAME: "FabricVTON Usage Plan",
  TERMS: "Pay-per-use virtual try-on. $0.10 per try-on after free trial.",
};

export type BillingStatus = "none" | "trial" | "active" | "cancelled" | "expired";

interface ShopBillingInfo {
  status: BillingStatus;
  subscriptionId: string | null;
  trialEndsAt: Date | null;
  usageThisMonth: number;
  canUseTryOn: boolean;
  message: string;
}

// Type for admin GraphQL client
interface AdminClient {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
}

/**
 * Get or create shop record
 */
export async function getOrCreateShop(domain: string, name?: string) {
  let shop = await prisma.shop.findUnique({ where: { domain } });

  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        domain,
        name,
        billingStatus: "none",
      },
    });
  }

  return shop;
}

/**
 * Get billing info for a shop
 */
export async function getShopBillingInfo(domain: string): Promise<ShopBillingInfo> {
  const shop = await prisma.shop.findUnique({ where: { domain } });

  if (!shop) {
    return {
      status: "none",
      subscriptionId: null,
      trialEndsAt: null,
      usageThisMonth: 0,
      canUseTryOn: false,
      message: "Shop not registered. Please install the app.",
    };
  }

  const now = new Date();

  // Check trial status
  if (shop.billingStatus === "trial") {
    if (shop.trialEndsAt && shop.trialEndsAt > now) {
      const trialUsageRemaining = BILLING_CONFIG.TRIAL_TRYONS - shop.usageThisMonth;
      if (trialUsageRemaining > 0) {
        return {
          status: "trial",
          subscriptionId: null,
          trialEndsAt: shop.trialEndsAt,
          usageThisMonth: shop.usageThisMonth,
          canUseTryOn: true,
          message: `Trial active. ${trialUsageRemaining} try-ons remaining.`,
        };
      } else {
        return {
          status: "trial",
          subscriptionId: null,
          trialEndsAt: shop.trialEndsAt,
          usageThisMonth: shop.usageThisMonth,
          canUseTryOn: false,
          message: "Trial limit reached. Please subscribe to continue.",
        };
      }
    } else {
      // Trial expired
      return {
        status: "expired",
        subscriptionId: null,
        trialEndsAt: shop.trialEndsAt,
        usageThisMonth: shop.usageThisMonth,
        canUseTryOn: false,
        message: "Trial expired. Please subscribe to continue.",
      };
    }
  }

  // Check active subscription
  if (shop.billingStatus === "active" && shop.subscriptionId) {
    return {
      status: "active",
      subscriptionId: shop.subscriptionId,
      trialEndsAt: null,
      usageThisMonth: shop.usageThisMonth,
      canUseTryOn: true,
      message: `Active subscription. ${shop.usageThisMonth} try-ons this period.`,
    };
  }

  return {
    status: shop.billingStatus as BillingStatus,
    subscriptionId: shop.subscriptionId,
    trialEndsAt: shop.trialEndsAt,
    usageThisMonth: shop.usageThisMonth,
    canUseTryOn: false,
    message: "No active subscription.",
  };
}

/**
 * Start a free trial for a shop
 */
export async function startTrial(domain: string) {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + BILLING_CONFIG.TRIAL_DAYS);

  return prisma.shop.upsert({
    where: { domain },
    update: {
      billingStatus: "trial",
      trialStartedAt: new Date(),
      trialEndsAt,
      usageThisMonth: 0,
    },
    create: {
      domain,
      billingStatus: "trial",
      trialStartedAt: new Date(),
      trialEndsAt,
      usageThisMonth: 0,
    },
  });
}

/**
 * Create a usage-based subscription via Shopify Billing API
 */
export async function createSubscription(
  admin: AdminClient,
  domain: string,
  returnUrl: string,
) {
  const response = await admin.graphql(`
    mutation AppSubscriptionCreate($name: String!, $returnUrl: URL!, $lineItems: [AppSubscriptionLineItemInput!]!, $test: Boolean) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        test: $test
        lineItems: $lineItems
      ) {
        appSubscription {
          id
          status
        }
        confirmationUrl
        userErrors {
          field
          message
        }
      }
    }
  `, {
    variables: {
      name: BILLING_CONFIG.PLAN_NAME,
      returnUrl,
      test: process.env.NODE_ENV !== "production",
      lineItems: [
        {
          plan: {
            appUsagePricingDetails: {
              terms: BILLING_CONFIG.TERMS,
              cappedAmount: {
                amount: BILLING_CONFIG.CAPPED_AMOUNT,
                currencyCode: "USD",
              },
            },
          },
        },
      ],
    },
  });

  const data = await response.json();
  const result = data.data?.appSubscriptionCreate;

  if (result?.userErrors?.length > 0) {
    throw new Error(result.userErrors.map((e: { message: string }) => e.message).join(", "));
  }

  if (result?.confirmationUrl) {
    // Store subscription ID for later
    const subscriptionId = result.appSubscription?.id;
    if (subscriptionId) {
      await prisma.shop.update({
        where: { domain },
        data: { subscriptionId },
      });
    }
  }

  return {
    subscriptionId: result?.appSubscription?.id,
    confirmationUrl: result?.confirmationUrl,
  };
}

/**
 * Record usage for billing
 */
export async function recordUsage(
  admin: AdminClient,
  domain: string,
  description: string = "Virtual try-on generation",
) {
  const shop = await prisma.shop.findUnique({ where: { domain } });

  if (!shop?.subscriptionId) {
    // No subscription, just increment local counter (for trial tracking)
    await prisma.shop.update({
      where: { domain },
      data: { usageThisMonth: { increment: 1 } },
    });
    return { recorded: false, reason: "no_subscription" };
  }

  // Get the usage line item ID from the subscription
  const subResponse = await admin.graphql(`
    query GetSubscription($id: ID!) {
      node(id: $id) {
        ... on AppSubscription {
          id
          status
          lineItems {
            id
            plan {
              pricingDetails {
                __typename
              }
            }
          }
        }
      }
    }
  `, {
    variables: { id: shop.subscriptionId },
  });

  const subData = await subResponse.json();
  const subscription = subData.data?.node;

  if (subscription?.status !== "ACTIVE") {
    return { recorded: false, reason: "subscription_not_active" };
  }

  // Find the usage pricing line item
  const usageLineItem = subscription.lineItems?.find(
    (item: { plan: { pricingDetails: { __typename: string } } }) =>
      item.plan?.pricingDetails?.__typename === "AppUsagePricing"
  );

  if (!usageLineItem) {
    return { recorded: false, reason: "no_usage_line_item" };
  }

  // Record the usage
  const usageResponse = await admin.graphql(`
    mutation AppUsageRecordCreate($subscriptionLineItemId: ID!, $price: MoneyInput!, $description: String!) {
      appUsageRecordCreate(
        subscriptionLineItemId: $subscriptionLineItemId
        price: $price
        description: $description
      ) {
        appUsageRecord {
          id
        }
        userErrors {
          field
          message
        }
      }
    }
  `, {
    variables: {
      subscriptionLineItemId: usageLineItem.id,
      price: {
        amount: BILLING_CONFIG.PRICE_PER_TRYON,
        currencyCode: "USD",
      },
      description,
    },
  });

  const usageData = await usageResponse.json();
  const usageResult = usageData.data?.appUsageRecordCreate;

  if (usageResult?.userErrors?.length > 0) {
    console.error("[Billing] Usage record error:", usageResult.userErrors);
    return { recorded: false, reason: "api_error", errors: usageResult.userErrors };
  }

  // Update local counter
  await prisma.shop.update({
    where: { domain },
    data: { usageThisMonth: { increment: 1 } },
  });

  return { recorded: true, usageRecordId: usageResult?.appUsageRecord?.id };
}

/**
 * Check if subscription is active and update local status
 */
export async function syncSubscriptionStatus(
  admin: AdminClient,
  domain: string,
) {
  const shop = await prisma.shop.findUnique({ where: { domain } });

  if (!shop?.subscriptionId) {
    return null;
  }

  const response = await admin.graphql(`
    query GetSubscription($id: ID!) {
      node(id: $id) {
        ... on AppSubscription {
          id
          status
          currentPeriodEnd
        }
      }
    }
  `, {
    variables: { id: shop.subscriptionId },
  });

  const data = await response.json();
  const subscription = data.data?.node;

  if (!subscription) {
    // Subscription not found, mark as cancelled
    await prisma.shop.update({
      where: { domain },
      data: { billingStatus: "cancelled" },
    });
    return null;
  }

  const newStatus = subscription.status === "ACTIVE" ? "active" : "cancelled";

  await prisma.shop.update({
    where: { domain },
    data: {
      billingStatus: newStatus,
      currentPeriodEnd: subscription.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd)
        : null,
    },
  });

  return subscription;
}

/**
 * Check if shop can perform a try-on (billing check)
 */
export async function canPerformTryOn(domain: string): Promise<{ allowed: boolean; reason: string }> {
  const billing = await getShopBillingInfo(domain);

  if (billing.canUseTryOn) {
    return { allowed: true, reason: billing.message };
  }

  return { allowed: false, reason: billing.message };
}
