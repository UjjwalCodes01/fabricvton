/**
 * Merchant Billing Page
 *
 * View and manage subscription, billing history, and plans.
 */

import type { HeadersFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
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
  Banner,
  Divider,
  Box,
  ProgressBar,
} from "@shopify/polaris";
import { authenticateAdminRequest } from "../lib/shopify-auth.server";
import {
  getShopBillingInfo,
  startTrial,
  createSubscription,
  BILLING_CONFIG,
} from "../lib/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  const billing = await getShopBillingInfo(session.shop);

  return {
    billing,
    config: BILLING_CONFIG,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticateAdminRequest(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "start_trial") {
    await startTrial(session.shop);
    return { success: true };
  }

  if (intent === "subscribe") {
    const returnUrl = `${process.env.SHOPIFY_APP_URL}/app/billing?subscribed=true`;
    const result = await createSubscription(admin, session.shop, returnUrl);

    if (result.confirmationUrl) {
      return Response.redirect(result.confirmationUrl, 302);
    }

    return { success: false, error: "Failed to create subscription" };
  }

  return null;
};

export default function BillingPage() {
  const { billing, config } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const handleStartTrial = () => {
    submit({ intent: "start_trial" }, { method: "post" });
  };

  const handleSubscribe = () => {
    submit({ intent: "subscribe" }, { method: "post" });
  };

  const trialProgress = billing.status === "trial"
    ? (billing.usageThisMonth / config.TRIAL_TRYONS) * 100
    : 0;

  return (
    <Page title="Billing & Plans">
      <Layout>
        {/* Current Status */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">Current Plan</Text>
                <Badge
                  tone={
                    billing.status === "active"
                      ? "success"
                      : billing.status === "trial"
                        ? "info"
                        : "warning"
                  }
                >
                  {billing.status.toUpperCase()}
                </Badge>
              </InlineStack>

              <Text as="p">{billing.message}</Text>

              {billing.status === "trial" && (
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodySm">
                      Trial Usage: {billing.usageThisMonth} / {config.TRIAL_TRYONS}
                    </Text>
                    <Text as="span" variant="bodySm">
                      {config.TRIAL_TRYONS - billing.usageThisMonth} remaining
                    </Text>
                  </InlineStack>
                  <ProgressBar progress={trialProgress} size="small" />
                  {billing.trialEndsAt && (
                    <Text as="p" variant="bodySm" tone="subdued">
                      Trial ends: {new Date(billing.trialEndsAt).toLocaleDateString()}
                    </Text>
                  )}
                </BlockStack>
              )}

              {billing.status === "active" && (
                <Text as="p" variant="bodySm" tone="subdued">
                  Usage this period: {billing.usageThisMonth} try-ons
                  (${(billing.usageThisMonth * config.PRICE_PER_TRYON).toFixed(2)})
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Start Trial CTA */}
        {billing.status === "none" && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Start Your Free Trial</Text>
                <Text as="p">
                  Try FabricVTON free for {config.TRIAL_DAYS} days with up to {config.TRIAL_TRYONS} virtual try-ons.
                  No credit card required.
                </Text>
                <Button
                  variant="primary"
                  onClick={handleStartTrial}
                  loading={isSubmitting}
                >
                  Start Free Trial
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Upgrade CTA */}
        {(billing.status === "trial" || billing.status === "expired" || billing.status === "none") && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">{config.PLAN_NAME}</Text>
                <Text as="p">{config.TERMS}</Text>

                <Divider />

                <BlockStack gap="200">
                  <InlineStack gap="200">
                    <Text as="span" variant="headingLg">${config.PRICE_PER_TRYON.toFixed(2)}</Text>
                    <Text as="span" tone="subdued">per successful try-on</Text>
                  </InlineStack>

                  <Text as="p" variant="bodySm" tone="subdued">
                    Maximum ${config.CAPPED_AMOUNT.toFixed(2)} per billing period
                  </Text>
                </BlockStack>

                <BlockStack gap="100">
                  <Text as="p" variant="bodySm">✓ Unlimited try-ons</Text>
                  <Text as="p" variant="bodySm">✓ Pay only for what you use</Text>
                  <Text as="p" variant="bodySm">✓ Cancel anytime</Text>
                  <Text as="p" variant="bodySm">✓ Spending cap protection</Text>
                </BlockStack>

                <Button
                  variant="primary"
                  onClick={handleSubscribe}
                  loading={isSubmitting}
                >
                  Subscribe Now
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Pricing Details */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">How Billing Works</Text>
              <Divider />
              <BlockStack gap="300">
                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm">Usage-Based Pricing</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    You're only charged for successful virtual try-on generations.
                    Failed attempts don't count toward your usage.
                  </Text>
                </BlockStack>

                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm">Spending Cap</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Your monthly charges are capped at ${config.CAPPED_AMOUNT.toFixed(2)}.
                    Once you hit this limit, try-ons continue working at no additional cost
                    until the next billing period.
                  </Text>
                </BlockStack>

                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm">Billing Through Shopify</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    All charges appear on your Shopify bill. You can manage your subscription
                    through your Shopify admin at any time.
                  </Text>
                </BlockStack>
              </BlockStack>
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
