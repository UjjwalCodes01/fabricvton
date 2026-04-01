/**
 * Merchant Products Page
 *
 * Manage product-specific try-on configurations.
 */

import type { HeadersFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  TextField,
  Select,
  Badge,
  DataTable,
  Modal,
  Thumbnail,
  EmptyState,
  Banner,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticateAdminRequest } from "../lib/shopify-auth.server";
import { getProductConfigs, upsertProductConfig, deleteProductConfig } from "../lib/config.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  const configs = await getProductConfigs(session.shop);

  return { configs };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create" || intent === "update") {
    await upsertProductConfig(session.shop, formData.get("productId") as string, {
      sku: formData.get("sku") as string || undefined,
      garmentImageUrl: formData.get("garmentImageUrl") as string || undefined,
      garmentCategory: formData.get("garmentCategory") as string || undefined,
      enabled: formData.get("enabled") === "true",
    });
    return { success: true };
  }

  if (intent === "delete") {
    await deleteProductConfig(formData.get("configId") as string);
    return { success: true, deleted: true };
  }

  return null;
};

const GARMENT_CATEGORIES = [
  { label: "Tops", value: "tops" },
  { label: "Bottoms", value: "bottoms" },
  { label: "Dresses", value: "dresses" },
  { label: "Outerwear", value: "outerwear" },
  { label: "Accessories", value: "accessories" },
  { label: "Other", value: "other" },
];

export default function ProductsPage() {
  const { configs } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<typeof configs[0] | null>(null);

  // Form state
  const [productId, setProductId] = useState("");
  const [sku, setSku] = useState("");
  const [garmentImageUrl, setGarmentImageUrl] = useState("");
  const [garmentCategory, setGarmentCategory] = useState("tops");
  const [enabled, setEnabled] = useState(true);

  const openCreateModal = () => {
    setEditingConfig(null);
    setProductId("");
    setSku("");
    setGarmentImageUrl("");
    setGarmentCategory("tops");
    setEnabled(true);
    setModalOpen(true);
  };

  const openEditModal = (config: typeof configs[0]) => {
    setEditingConfig(config);
    setProductId(config.productId);
    setSku(config.sku || "");
    setGarmentImageUrl(config.garmentImageUrl || "");
    setGarmentCategory(config.garmentCategory || "tops");
    setEnabled(config.enabled);
    setModalOpen(true);
  };

  const handleSave = () => {
    submit(
      {
        intent: editingConfig ? "update" : "create",
        productId,
        sku,
        garmentImageUrl,
        garmentCategory,
        enabled: enabled.toString(),
      },
      { method: "post" }
    );
    setModalOpen(false);
  };

  const handleDelete = (configId: string) => {
    if (confirm("Delete this product configuration?")) {
      submit({ intent: "delete", configId }, { method: "post" });
    }
  };

  const handleProductIdChange = useCallback((value: string) => setProductId(value), []);
  const handleSkuChange = useCallback((value: string) => setSku(value), []);
  const handleImageUrlChange = useCallback((value: string) => setGarmentImageUrl(value), []);
  const handleCategoryChange = useCallback((value: string) => setGarmentCategory(value), []);

  return (
    <Page
      title="Product Configurations"
      primaryAction={{
        content: "Add Product",
        onAction: openCreateModal,
      }}
    >
      <Layout>
        {actionData?.success && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => {}}>
              {actionData.deleted ? "Configuration deleted." : "Configuration saved."}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Product-Specific Settings ({configs.length})
              </Text>

              {configs.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                  headings={["Product ID", "SKU", "Category", "Custom Image", "Status", "Actions"]}
                  rows={configs.map((config) => [
                    config.productId,
                    config.sku || "—",
                    config.garmentCategory || "—",
                    config.garmentImageUrl ? (
                      <Thumbnail
                        key={config.id}
                        source={config.garmentImageUrl}
                        alt="Garment"
                        size="small"
                      />
                    ) : (
                      "Default"
                    ),
                    <Badge
                      key={`status-${config.id}`}
                      tone={config.enabled ? "success" : "critical"}
                    >
                      {config.enabled ? "Enabled" : "Disabled"}
                    </Badge>,
                    <InlineStack key={`actions-${config.id}`} gap="200">
                      <Button size="slim" onClick={() => openEditModal(config)}>
                        Edit
                      </Button>
                      <Button
                        size="slim"
                        tone="critical"
                        onClick={() => handleDelete(config.id)}
                      >
                        Delete
                      </Button>
                    </InlineStack>,
                  ])}
                />
              ) : (
                <EmptyState
                  heading="No product configurations"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  action={{ content: "Add Product", onAction: openCreateModal }}
                >
                  <p>
                    Add product-specific settings like custom garment images
                    or category mappings.
                  </p>
                </EmptyState>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">How It Works</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Product configurations let you customize how virtual try-on works
                for specific products. You can:
              </Text>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm">
                  • Upload custom garment images for better try-on results
                </Text>
                <Text as="p" variant="bodySm">
                  • Categorize products (tops, bottoms, dresses) for model optimization
                </Text>
                <Text as="p" variant="bodySm">
                  • Enable/disable try-on for specific products
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingConfig ? "Edit Product Configuration" : "Add Product Configuration"}
        primaryAction={{
          content: "Save",
          onAction: handleSave,
          loading: isSubmitting,
        }}
        secondaryActions={[
          { content: "Cancel", onAction: () => setModalOpen(false) },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <TextField
              label="Product ID"
              value={productId}
              onChange={handleProductIdChange}
              autoComplete="off"
              helpText="Shopify product ID (from URL or API)"
              disabled={!!editingConfig}
            />

            <TextField
              label="SKU (Optional)"
              value={sku}
              onChange={handleSkuChange}
              autoComplete="off"
            />

            <Select
              label="Garment Category"
              options={GARMENT_CATEGORIES}
              value={garmentCategory}
              onChange={handleCategoryChange}
              helpText="Helps optimize the try-on model"
            />

            <TextField
              label="Custom Garment Image URL (Optional)"
              value={garmentImageUrl}
              onChange={handleImageUrlChange}
              autoComplete="off"
              helpText="Override the product image for try-on"
            />

            {garmentImageUrl && (
              <Thumbnail
                source={garmentImageUrl}
                alt="Preview"
                size="large"
              />
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

export function ErrorBoundary() {
  return boundary.error(null);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
