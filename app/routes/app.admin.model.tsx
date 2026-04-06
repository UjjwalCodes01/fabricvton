/**
 * Super Admin - Model Management
 *
 * Configure active model version and platform settings.
 */

import type { HeadersFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation, useActionData, useRouteError } from "react-router";
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
  Select,
  TextField,
  Checkbox,
  Banner,
  Divider,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticateAdminRequest } from "../lib/shopify-auth.server";
import { requireSuperAdmin } from "../lib/super-admin.server";
import { getPlatformSettings, updatePlatformSettings, MODEL_VERSIONS } from "../lib/platform.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  requireSuperAdmin(session.onlineAccessInfo?.associated_user?.email);

  const settings = await getPlatformSettings();

  return { settings, modelVersions: MODEL_VERSIONS };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  requireSuperAdmin(session.onlineAccessInfo?.associated_user?.email);

  const formData = await request.formData();

  await updatePlatformSettings({
    activeModelVersion: formData.get("activeModel") as string,
    fallbackModelVersion: formData.get("fallbackModel") as string || undefined,
    maintenanceMode: formData.get("maintenanceMode") === "true",
    maxTrialTryOns: parseInt(formData.get("maxTrialTryOns") as string) || 50,
    pricePerTryOn: parseFloat(formData.get("pricePerTryOn") as string) || 0.10,
  });

  return { success: true };
};

export default function ModelManagementPage() {
  const { settings, modelVersions } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [activeModel, setActiveModel] = useState(settings.activeModelVersion);
  const [fallbackModel, setFallbackModel] = useState(settings.fallbackModelVersion || "");
  const [maintenanceMode, setMaintenanceMode] = useState(settings.maintenanceMode);
  const [maxTrialTryOns, setMaxTrialTryOns] = useState(settings.maxTrialTryOns.toString());
  const [pricePerTryOn, setPricePerTryOn] = useState(settings.pricePerTryOn.toString());

  const handleSave = () => {
    submit(
      {
        activeModel,
        fallbackModel,
        maintenanceMode: maintenanceMode.toString(),
        maxTrialTryOns,
        pricePerTryOn,
      },
      { method: "post" }
    );
  };

  const handleActiveModelChange = useCallback((value: string) => setActiveModel(value), []);
  const handleFallbackModelChange = useCallback((value: string) => setFallbackModel(value), []);
  const handleMaintenanceChange = useCallback((checked: boolean) => setMaintenanceMode(checked), []);
  const handleTrialChange = useCallback((value: string) => setMaxTrialTryOns(value), []);
  const handlePriceChange = useCallback((value: string) => setPricePerTryOn(value), []);

  return (
    <Page
      title="Model Management"
      backAction={{ content: "Admin", url: "/app/admin" }}
      primaryAction={{
        content: "Save Changes",
        onAction: handleSave,
        loading: isSubmitting,
      }}
    >
      <Layout>
        {actionData?.success && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => {}}>
              Settings saved successfully!
            </Banner>
          </Layout.Section>
        )}

        {/* Maintenance Mode Warning */}
        {maintenanceMode && (
          <Layout.Section>
            <Banner tone="warning">
              Maintenance mode is enabled. All try-on requests will be rejected.
            </Banner>
          </Layout.Section>
        )}

        {/* Model Selection */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Model Configuration</Text>
              <Divider />

              <Select
                label="Active Model"
                options={modelVersions.map((m) => ({
                  label: `${m.label} - ${m.description}`,
                  value: m.value,
                }))}
                value={activeModel}
                onChange={handleActiveModelChange}
                helpText="The model used for all try-on requests"
              />

              <Select
                label="Fallback Model"
                options={[
                  { label: "None", value: "" },
                  ...modelVersions.map((m) => ({
                    label: `${m.label} - ${m.description}`,
                    value: m.value,
                  })),
                ]}
                value={fallbackModel}
                onChange={handleFallbackModelChange}
                helpText="Used if the active model fails"
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Platform Settings */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Platform Settings</Text>
              <Divider />

              <Checkbox
                label="Maintenance Mode"
                helpText="Enable to reject all incoming try-on requests"
                checked={maintenanceMode}
                onChange={handleMaintenanceChange}
              />

              <TextField
                label="Max Trial Try-Ons"
                type="number"
                value={maxTrialTryOns}
                onChange={handleTrialChange}
                autoComplete="off"
                helpText="Number of free try-ons in trial period"
              />

              <TextField
                label="Price per Try-On ($)"
                type="number"
                value={pricePerTryOn}
                onChange={handlePriceChange}
                autoComplete="off"
                helpText="Usage-based pricing per successful try-on"
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Current Status */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Current Status</Text>
              <Divider />
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="span">Active Model</Text>
                  <Badge tone="info">{settings.activeModelVersion}</Badge>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span">Fallback Model</Text>
                  <Badge>{settings.fallbackModelVersion || "None"}</Badge>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span">Maintenance Mode</Text>
                  <Badge tone={settings.maintenanceMode ? "critical" : "success"}>
                    {settings.maintenanceMode ? "Enabled" : "Disabled"}
                  </Badge>
                </InlineStack>
                <InlineStack align="space-between">
                  <Text as="span">Last Updated</Text>
                  <Text as="span" tone="subdued">
                    {new Date(settings.updatedAt).toLocaleString()}
                  </Text>
                </InlineStack>
              </BlockStack>
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
