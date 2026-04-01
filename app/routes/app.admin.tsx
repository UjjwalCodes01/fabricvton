/**
 * Super Admin Dashboard - Overview
 *
 * Platform-wide statistics and management.
 */

import type { HeadersFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, Link } from "react-router";
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
  DataTable,
  Tabs,
  Box,
  Divider,
  Banner,
} from "@shopify/polaris";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useState } from "react";
import { authenticateAdminRequest } from "../lib/shopify-auth.server";
import { requireSuperAdmin } from "../lib/super-admin.server";
import { getGlobalStats, getGlobalDailyStats } from "../lib/analytics.server";
import { getAllShopsExtended, getPlatformSettings, suspendShop, reactivateShop } from "../lib/platform.server";
import { BILLING_CONFIG } from "../lib/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  requireSuperAdmin(session.onlineAccessInfo?.associated_user?.email);

  const [stats, dailyStats, shops, settings] = await Promise.all([
    getGlobalStats(30),
    getGlobalDailyStats(30),
    getAllShopsExtended(),
    getPlatformSettings(),
  ]);

  return {
    stats,
    dailyStats,
    shops,
    settings,
    billingConfig: BILLING_CONFIG,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  requireSuperAdmin(session.onlineAccessInfo?.associated_user?.email);

  const formData = await request.formData();
  const intent = formData.get("intent");
  const shopDomain = formData.get("shopDomain") as string;

  if (intent === "suspend" && shopDomain) {
    await suspendShop(shopDomain);
    return { success: true, action: "suspended" };
  }

  if (intent === "reactivate" && shopDomain) {
    await reactivateShop(shopDomain);
    return { success: true, action: "reactivated" };
  }

  return null;
};

export default function SuperAdminDashboard() {
  const { stats, dailyStats, shops, settings, billingConfig } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [selectedTab, setSelectedTab] = useState(0);

  const handleSuspend = (domain: string) => {
    if (confirm(`Suspend shop ${domain}?`)) {
      submit({ intent: "suspend", shopDomain: domain }, { method: "post" });
    }
  };

  const handleReactivate = (domain: string) => {
    submit({ intent: "reactivate", shopDomain: domain }, { method: "post" });
  };

  // Format chart data
  const chartData = dailyStats.map((d) => ({
    ...d,
    date: d.date.split("-").slice(1).join("/"),
  }));

  const tabs = [
    { id: "overview", content: "Overview" },
    { id: "shops", content: "Shops" },
  ];

  return (
    <Page title="Super Admin Dashboard">
      <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab}>
        {selectedTab === 0 && (
          <Layout>
            {/* Global Stats */}
            <Layout.Section>
              <InlineStack gap="400" wrap={false}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Total Shops</Text>
                    <Text as="p" variant="headingLg">{stats.totalShops}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {stats.activeShops} active
                    </Text>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Try-Ons (30d)</Text>
                    <Text as="p" variant="headingLg">{stats.totalEvents}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {stats.successfulEvents} successful
                    </Text>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Error Rate</Text>
                    <Text as="p" variant="headingLg">{stats.errorRate.toFixed(1)}%</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {stats.failedEvents} failed
                    </Text>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Avg Latency</Text>
                    <Text as="p" variant="headingLg">{(stats.avgLatencyMs / 1000).toFixed(1)}s</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      per request
                    </Text>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">Est. Revenue</Text>
                    <Text as="p" variant="headingLg">${stats.estimatedRevenue.toFixed(2)}</Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      this period
                    </Text>
                  </BlockStack>
                </Card>
              </InlineStack>
            </Layout.Section>

            {/* Usage Chart */}
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Platform Usage (30 Days)</Text>
                  <Box minHeight="300px">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="total"
                          stroke="#5C6AC4"
                          name="Total"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="successful"
                          stroke="#008060"
                          name="Successful"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="failed"
                          stroke="#D82C0D"
                          name="Failed"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Quick Links */}
            <Layout.Section variant="oneHalf">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Quick Actions</Text>
                  <Divider />
                  <BlockStack gap="200">
                    <Button url="/app/admin/logs" fullWidth>View Logs</Button>
                    <Button url="/app/admin/model" fullWidth>Model Settings</Button>
                    <Button url="/app/admin/tickets" fullWidth>Support Tickets</Button>
                  </BlockStack>
                </BlockStack>
              </Card>
            </Layout.Section>

            {/* Platform Settings */}
            <Layout.Section variant="oneHalf">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Platform Configuration</Text>
                  <Divider />
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span">Active Model</Text>
                      <Badge>{settings.activeModelVersion}</Badge>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span">Maintenance Mode</Text>
                      <Badge tone={settings.maintenanceMode ? "warning" : "success"}>
                        {settings.maintenanceMode ? "ON" : "OFF"}
                      </Badge>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span">Price per Try-On</Text>
                      <Text as="span">${billingConfig.PRICE_PER_TRYON.toFixed(2)}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span">Trial Try-Ons</Text>
                      <Text as="span">{billingConfig.TRIAL_TRYONS}</Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        )}

        {selectedTab === 1 && (
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">All Shops ({shops.length})</Text>
                  </InlineStack>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "numeric", "numeric", "text"]}
                    headings={["Domain", "Name", "Status", "Usage", "Tickets", "Actions"]}
                    rows={shops.map((shop) => [
                      shop.domain,
                      shop.name || "—",
                      <Badge
                        key={shop.id}
                        tone={
                          !shop.isActive
                            ? "critical"
                            : shop.billingStatus === "active"
                              ? "success"
                              : shop.billingStatus === "trial"
                                ? "info"
                                : "attention"
                        }
                      >
                        {!shop.isActive ? "Suspended" : shop.billingStatus}
                      </Badge>,
                      shop.usageThisMonth,
                      shop._count.supportTickets,
                      shop.isActive ? (
                        <Button
                          key={`suspend-${shop.id}`}
                          size="slim"
                          tone="critical"
                          onClick={() => handleSuspend(shop.domain)}
                        >
                          Suspend
                        </Button>
                      ) : (
                        <Button
                          key={`reactivate-${shop.id}`}
                          size="slim"
                          onClick={() => handleReactivate(shop.domain)}
                        >
                          Reactivate
                        </Button>
                      ),
                    ])}
                  />
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        )}
      </Tabs>
    </Page>
  );
}

export function ErrorBoundary() {
  return boundary.error(null);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
