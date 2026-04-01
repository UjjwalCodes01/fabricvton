/**
 * Super Admin - API Logs
 *
 * View and filter API call logs for debugging.
 */

import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Select,
  TextField,
  DataTable,
  Button,
  Box,
  Divider,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticateAdminRequest } from "../lib/shopify-auth.server";
import { requireSuperAdmin } from "../lib/super-admin.server";
import { getRecentLogs, getErrorSummary, getLatencyStats } from "../lib/logs.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  requireSuperAdmin(session.onlineAccessInfo?.associated_user?.email);

  const url = new URL(request.url);
  const shopFilter = url.searchParams.get("shop") || undefined;
  const errorsOnly = url.searchParams.get("errors") === "true";

  const [logs, errorSummary, latencyStats] = await Promise.all([
    getRecentLogs({
      limit: 100,
      shopDomain: shopFilter,
      errorsOnly,
    }),
    getErrorSummary(7),
    getLatencyStats(7),
  ]);

  return {
    logs,
    errorSummary,
    latencyStats,
    filters: { shop: shopFilter, errorsOnly },
  };
};

export default function AdminLogsPage() {
  const { logs, errorSummary, latencyStats, filters } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [shopFilter, setShopFilter] = useState(filters.shop || "");
  const [errorsOnly, setErrorsOnly] = useState(filters.errorsOnly ? "errors" : "all");

  const handleFilter = () => {
    const params = new URLSearchParams();
    if (shopFilter) params.set("shop", shopFilter);
    if (errorsOnly === "errors") params.set("errors", "true");
    setSearchParams(params);
  };

  const handleShopChange = useCallback((value: string) => setShopFilter(value), []);
  const handleErrorsChange = useCallback((value: string) => setErrorsOnly(value), []);

  return (
    <Page
      title="API Logs"
      backAction={{ content: "Admin", url: "/app/admin" }}
    >
      <Layout>
        {/* Latency Stats */}
        <Layout.Section>
          <InlineStack gap="400" wrap={false}>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">P50 Latency</Text>
                <Text as="p" variant="headingLg">{(latencyStats.p50 / 1000).toFixed(2)}s</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">P95 Latency</Text>
                <Text as="p" variant="headingLg">{(latencyStats.p95 / 1000).toFixed(2)}s</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">P99 Latency</Text>
                <Text as="p" variant="headingLg">{(latencyStats.p99 / 1000).toFixed(2)}s</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Avg Latency</Text>
                <Text as="p" variant="headingLg">{(latencyStats.avg / 1000).toFixed(2)}s</Text>
              </BlockStack>
            </Card>
          </InlineStack>
        </Layout.Section>

        {/* Error Summary */}
        {errorSummary.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Error Summary (7 Days)</Text>
                <Divider />
                <InlineStack gap="400">
                  {errorSummary.map((e) => (
                    <Badge key={e.errorType} tone="critical">
                      {`${e.errorType}: ${e.count}`}
                    </Badge>
                  ))}
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Filters */}
        <Layout.Section>
          <Card>
            <InlineStack gap="400" align="end">
              <Box minWidth="200px">
                <TextField
                  label="Filter by Shop"
                  value={shopFilter}
                  onChange={handleShopChange}
                  autoComplete="off"
                  placeholder="shop.myshopify.com"
                />
              </Box>
              <Box minWidth="150px">
                <Select
                  label="Log Type"
                  options={[
                    { label: "All Logs", value: "all" },
                    { label: "Errors Only", value: "errors" },
                  ]}
                  value={errorsOnly}
                  onChange={handleErrorsChange}
                />
              </Box>
              <Button onClick={handleFilter}>Apply Filters</Button>
            </InlineStack>
          </Card>
        </Layout.Section>

        {/* Logs Table */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Recent API Calls ({logs.length})</Text>
              <DataTable
                columnContentTypes={["text", "text", "text", "numeric", "text", "text"]}
                headings={["Time", "Shop", "Endpoint", "Duration", "Status", "Error"]}
                rows={logs.map((log) => [
                  new Date(log.createdAt).toLocaleString(),
                  log.shopDomain || "—",
                  log.endpoint,
                  log.durationMs ? `${(log.durationMs / 1000).toFixed(2)}s` : "—",
                  <Badge
                    key={log.id}
                    tone={log.success ? "success" : "critical"}
                  >
                    {String(log.statusCode)}
                  </Badge>,
                  log.errorMessage ? (
                    <Text key={`err-${log.id}`} as="span" variant="bodySm" tone="critical">
                      {`${log.errorMessage.substring(0, 50)}...`}
                    </Text>
                  ) : (
                    "—"
                  ),
                ])}
              />
              {logs.length === 0 && (
                <Text as="p" tone="subdued">No logs found matching your criteria.</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export function ErrorBoundary() {
  return boundary.error(null);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
