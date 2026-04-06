/**
 * Merchant Analytics Page
 *
 * Charts and detailed analytics for try-on performance.
 */

import type { HeadersFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Select,
  DataTable,
  Thumbnail,
  Box,
} from "@shopify/polaris";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { useState } from "react";
import { authenticateAdminRequest } from "../lib/shopify-auth.server";
import { getDailyTryOnStats, getTopProducts, exportTryOnEventsCSV } from "../lib/analytics.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  const shopDomain = session.shop;

  const url = new URL(request.url);
  const days = parseInt(url.searchParams.get("days") || "30");

  const [dailyStats, topProducts] = await Promise.all([
    getDailyTryOnStats(shopDomain, days),
    getTopProducts(shopDomain, 10),
  ]);

  return {
    shopDomain,
    dailyStats,
    topProducts,
    days,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "export") {
    const days = parseInt(formData.get("days") as string || "30");
    const csv = await exportTryOnEventsCSV(session.shop, days);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="tryon-analytics-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  }

  return null;
};

export default function AnalyticsPage() {
  const { dailyStats, topProducts, days } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [selectedDays, setSelectedDays] = useState(days.toString());

  const handleDaysChange = (value: string) => {
    setSelectedDays(value);
    window.location.href = `/app/analytics?days=${value}`;
  };

  const handleExport = () => {
    submit({ intent: "export", days: selectedDays }, { method: "post" });
  };

  // Calculate totals
  const totals = dailyStats.reduce(
    (acc, day) => ({
      total: acc.total + day.total,
      successful: acc.successful + day.successful,
      failed: acc.failed + day.failed,
    }),
    { total: 0, successful: 0, failed: 0 }
  );

  const successRate = totals.total > 0 ? (totals.successful / totals.total) * 100 : 0;

  // Format data for charts
  const chartData = dailyStats.map((d) => ({
    ...d,
    date: d.date.split("-").slice(1).join("/"), // MM/DD format
  }));

  return (
    <Page
      title="Analytics"
      primaryAction={{
        content: "Export CSV",
        onAction: handleExport,
      }}
    >
      <Layout>
        {/* Period Selector */}
        <Layout.Section>
          <Card>
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">Try-On Performance</Text>
              <Select
                label="Time Period"
                labelHidden
                options={[
                  { label: "Last 7 days", value: "7" },
                  { label: "Last 30 days", value: "30" },
                  { label: "Last 90 days", value: "90" },
                ]}
                value={selectedDays}
                onChange={handleDaysChange}
              />
            </InlineStack>
          </Card>
        </Layout.Section>

        {/* Summary Stats */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Total Try-Ons</Text>
                <Text as="p" variant="headingLg">{totals.total}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Successful</Text>
                <Text as="p" variant="headingLg">{totals.successful}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Failed</Text>
                <Text as="p" variant="headingLg">{totals.failed}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Success Rate</Text>
                <Text as="p" variant="headingLg">{successRate.toFixed(1)}%</Text>
              </BlockStack>
            </Card>
          </InlineStack>
        </Layout.Section>

        {/* Line Chart */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Try-Ons Over Time</Text>
              <Box minHeight="300px">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
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

        {/* Top Products */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Top Performing Products</Text>
              {topProducts.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "numeric"]}
                  headings={["Product", "Product ID", "Try-Ons", "Success Rate"]}
                  rows={topProducts.map((p) => [
                    <Thumbnail
                      key={p.productId}
                      source={p.productImageUrl}
                      alt={p.productId}
                      size="small"
                    />,
                    p.productId,
                    p.totalTryOns.toString(),
                    `${p.successRate.toFixed(1)}%`,
                  ])}
                />
              ) : (
                <Text as="p" tone="subdued">No product data available yet.</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
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
