/**
 * Merchant Settings Page
 *
 * Configure try-on button appearance and behavior.
 */

import type { HeadersFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation, useRouteError } from "react-router";
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
  Checkbox,
  Banner,
  Divider,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticateAdminRequest } from "../lib/shopify-auth.server";
import { getShopConfig, updateShopConfig } from "../lib/config.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  const config = await getShopConfig(session.shop);

  return { config };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  const formData = await request.formData();

  await updateShopConfig(session.shop, {
    tryOnEnabled: formData.get("tryOnEnabled") === "true",
    buttonPosition: formData.get("buttonPosition") as string,
    buttonText: formData.get("buttonText") as string,
  });

  return { success: true };
};

export default function SettingsPage() {
  const { config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [saved, setSaved] = useState(false);

  const [enabled, setEnabled] = useState(config?.tryOnEnabled ?? true);
  const [position, setPosition] = useState(config?.buttonPosition ?? "below_add_to_cart");
  const [buttonText, setButtonText] = useState(config?.buttonText ?? "Try It On");

  const handleSave = () => {
    submit(
      {
        tryOnEnabled: enabled.toString(),
        buttonPosition: position,
        buttonText,
      },
      { method: "post" }
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleEnabledChange = useCallback((checked: boolean) => setEnabled(checked), []);
  const handlePositionChange = useCallback((value: string) => setPosition(value), []);
  const handleTextChange = useCallback((value: string) => setButtonText(value), []);

  return (
    <Page
      title="Settings"
      primaryAction={{
        content: "Save",
        onAction: handleSave,
        loading: isSubmitting,
      }}
    >
      <Layout>
        {saved && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSaved(false)}>
              Settings saved successfully!
            </Banner>
          </Layout.Section>
        )}

        {/* Enable/Disable */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Try-On Button</Text>
              <Divider />
              <Checkbox
                label="Enable Try-On Button"
                helpText="When enabled, the try-on button will appear on product pages."
                checked={enabled}
                onChange={handleEnabledChange}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Button Configuration */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Button Appearance</Text>
              <Divider />

              <TextField
                label="Button Text"
                value={buttonText}
                onChange={handleTextChange}
                autoComplete="off"
                helpText="The text displayed on the try-on button"
              />

              <Select
                label="Button Position"
                options={[
                  { label: "Below Add to Cart", value: "below_add_to_cart" },
                  { label: "Above Add to Cart", value: "above_add_to_cart" },
                  { label: "Floating (Bottom Right)", value: "floating" },
                ]}
                value={position}
                onChange={handlePositionChange}
                helpText="Where the button appears on the product page"
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Theme Integration */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Theme Integration</Text>
              <Divider />
              <Text as="p" variant="bodySm" tone="subdued">
                The try-on button is added to your store via the Theme App Extension.
                To enable it:
              </Text>
              <BlockStack gap="200">
                <Text as="p" variant="bodySm">
                  1. Go to your Shopify admin → Online Store → Themes
                </Text>
                <Text as="p" variant="bodySm">
                  2. Click "Customize" on your active theme
                </Text>
                <Text as="p" variant="bodySm">
                  3. Navigate to a product page template
                </Text>
                <Text as="p" variant="bodySm">
                  4. Click "Add block" and select "FabricVTON Try-On Button"
                </Text>
              </BlockStack>
              <Button
                url="https://admin.shopify.com/store/themes"
                external
              >
                Open Theme Editor
              </Button>
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
