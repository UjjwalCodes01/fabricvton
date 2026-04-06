/**
 * Merchant Dashboard - Overview Page
 *
 * Main dashboard showing usage stats, billing, and quick actions.
 */

import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Box,
  Divider,
  Banner,
} from "@shopify/polaris";
import { authenticateAdminRequest } from "../lib/shopify-auth.server";
import { getOrCreateShop, getShopBillingInfo, BILLING_CONFIG } from "../lib/billing.server";
import { getShopEventStats } from "../lib/events.server";
import { getShopConfig } from "../lib/config.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  const shopDomain = session.shop;

  // Ensure a shop row exists before dashboard queries run.
  await getOrCreateShop(shopDomain);

  const [billing, stats, config] = await Promise.all([
    getShopBillingInfo(shopDomain),
    getShopEventStats(shopDomain),
    getShopConfig(shopDomain),
  ]);

  return {
    shopDomain,
    billing,
    stats,
    config,
    billingConfig: BILLING_CONFIG,
  };
};

export default function MerchantDashboard() {
  const { shopDomain, billing, stats, config, billingConfig } = useLoaderData<typeof loader>();

  const getBillingBadge = () => {
    switch (billing.status) {
      case "active":
        return <Badge tone="success">Active Subscription</Badge>;
      case "trial":
        return <Badge tone="info">Trial</Badge>;
      case "expired":
        return <Badge tone="warning">Trial Expired</Badge>;
      default:
        return <Badge tone="attention">Not Subscribed</Badge>;
    }
  };

  return (
    <Page title="Dashboard">
      <Layout>
        {/* Billing Alert */}
        {!billing.canUseTryOn && (
          <Layout.Section>
            <Banner
              title="Action Required"
              tone="warning"
              action={{ content: "Manage Billing", url: "/app/billing" }}
            >
              <p>{billing.message}</p>
            </Banner>
          </Layout.Section>
        )}

        {/* Quick Stats */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Plan Status</Text>
                {getBillingBadge()}
                <Text as="p" variant="bodySm" tone="subdued">
                  {billing.message}
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Usage This Period</Text>
                <Text as="p" variant="headingLg">{billing.usageThisMonth}</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  {billing.status === "trial"
                    ? `${billingConfig.TRIAL_TRYONS - billing.usageThisMonth} remaining in trial`
                    : "try-ons"}
                </Text>
              </BlockStack>
            </Card>

            {stats && (
              <>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Success Rate</Text>
                    <Text as="p" variant="headingLg">{stats.successRate.toFixed(1)}%</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Last 30 days
                    </Text>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Avg. Duration</Text>
                    <Text as="p" variant="headingLg">{(stats.avgDurationMs / 1000).toFixed(1)}s</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Per try-on
                    </Text>
                  </BlockStack>
                </Card>
              </>
            )}
          </InlineStack>
        </Layout.Section>

        {/* Configuration Status */}
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Try-On Configuration</Text>
                <Button url="/app/settings" variant="plain">Edit Settings</Button>
              </InlineStack>
              <Divider />
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="span">Try-On Button</Text>
                  {config?.tryOnEnabled
                    ? <Badge tone="success">Enabled</Badge>
                    : <Badge tone="critical">Disabled</Badge>
                  }
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span">Button Position</Text>
                  <Text as="span" tone="subdued">{config?.buttonPosition || "Default"}</Text>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span">Button Text</Text>
                  <Text as="span" tone="subdued">{config?.buttonText || "Try It On"}</Text>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Quick Actions */}
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Quick Actions</Text>
              <Divider />
              <BlockStack gap="300">
                <Button url="/app/analytics" fullWidth>View Analytics</Button>
                <Button url="/app/products" fullWidth>Manage Products</Button>
                <Button url="/app/billing" fullWidth>Billing & Plans</Button>
                <Button url="/app/support" fullWidth variant="plain">Get Support</Button>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Recent Activity */}
        {stats && stats.total > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">Recent Activity (30 Days)</Text>
                  <Button url="/app/analytics" variant="plain">View All</Button>
                </InlineStack>
                <Divider />
                <InlineStack gap="800">
                  <BlockStack gap="100">
                    <Text as="p" variant="headingLg">{stats.total}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Total Try-Ons</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="p" variant="headingLg">{stats.successful}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Successful</Text>
                  </BlockStack>
                  <BlockStack gap="100">
                    <Text as="p" variant="headingLg">{stats.failed}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">Failed</Text>
                  </BlockStack>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
