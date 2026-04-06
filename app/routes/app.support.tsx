/**
 * Merchant Support Page
 *
 * Contact form and documentation links.
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
  Button,
  TextField,
  Select,
  Banner,
  Divider,
  Link,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticateAdminRequest } from "../lib/shopify-auth.server";
import { createSupportTicket, getShopTickets } from "../lib/support.server";

// Define issue types client-side to avoid server module import issues
const ISSUE_TYPES = [
  { label: "Billing", value: "billing" },
  { label: "Technical Issue", value: "technical" },
  { label: "Feature Request", value: "feature_request" },
  { label: "Other", value: "other" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  const tickets = await getShopTickets(session.shop);

  return {
    email: session.onlineAccessInfo?.associated_user?.email || "",
    tickets,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  const formData = await request.formData();

  try {
    await createSupportTicket(session.shop, {
      email: formData.get("email") as string,
      issueType: formData.get("issueType") as "billing" | "technical" | "feature_request" | "other",
      subject: formData.get("subject") as string,
      message: formData.get("message") as string,
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to submit ticket" };
  }
};

export default function SupportPage() {
  const { email: defaultEmail, tickets } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [email, setEmail] = useState(defaultEmail);
  const [issueType, setIssueType] = useState("technical");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    submit({ email, issueType, subject, message }, { method: "post" });
    // Clear form on success
    if (!actionData?.error) {
      setSubject("");
      setMessage("");
    }
  };

  const handleEmailChange = useCallback((value: string) => setEmail(value), []);
  const handleIssueTypeChange = useCallback((value: string) => setIssueType(value), []);
  const handleSubjectChange = useCallback((value: string) => setSubject(value), []);
  const handleMessageChange = useCallback((value: string) => setMessage(value), []);

  return (
    <Page title="Support">
      <Layout>
        {actionData?.success && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => {}}>
              Your support request has been submitted. We'll get back to you soon!
            </Banner>
          </Layout.Section>
        )}

        {actionData?.error && (
          <Layout.Section>
            <Banner tone="critical">
              {actionData.error}
            </Banner>
          </Layout.Section>
        )}

        {/* Contact Form */}
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Contact Support</Text>
              <Divider />

              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={handleEmailChange}
                autoComplete="email"
              />

              <Select
                label="Issue Type"
                options={ISSUE_TYPES.map((t) => ({ label: t.label, value: t.value }))}
                value={issueType}
                onChange={handleIssueTypeChange}
              />

              <TextField
                label="Subject"
                value={subject}
                onChange={handleSubjectChange}
                autoComplete="off"
              />

              <TextField
                label="Message"
                value={message}
                onChange={handleMessageChange}
                multiline={4}
                autoComplete="off"
              />

              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={isSubmitting}
                disabled={!email || !subject || !message}
              >
                Submit Request
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Help Resources */}
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Help Resources</Text>
              <Divider />

              <BlockStack gap="300">
                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm">Documentation</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Learn how to set up and customize the virtual try-on feature.
                  </Text>
                  <Link url="https://docs.fabricvton.com" external>
                    View Documentation →
                  </Link>
                </BlockStack>

                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm">FAQs</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Find answers to common questions.
                  </Text>
                  <Link url="https://docs.fabricvton.com/faq" external>
                    View FAQs →
                  </Link>
                </BlockStack>

                <BlockStack gap="100">
                  <Text as="h3" variant="headingSm">Status Page</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Check current system status and uptime.
                  </Text>
                  <Link url="https://status.fabricvton.com" external>
                    View Status →
                  </Link>
                </BlockStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Previous Tickets */}
        {tickets.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Previous Requests</Text>
                <Divider />
                <BlockStack gap="300">
                  {tickets.slice(0, 5).map((ticket) => (
                    <InlineStack key={ticket.id} align="space-between">
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd">{ticket.subject}</Text>
                        <Text as="p" variant="bodySm" tone="subdued">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </Text>
                      </BlockStack>
                      <Text
                        as="span"
                        variant="bodySm"
                        tone={ticket.status === "resolved" ? "success" : "subdued"}
                      >
                        {ticket.status}
                      </Text>
                    </InlineStack>
                  ))}
                </BlockStack>
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
