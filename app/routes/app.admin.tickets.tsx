/**
 * Super Admin - Support Tickets
 * 
 * View and manage support tickets from merchants.
 */

import type { HeadersFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSubmit } from "react-router";
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
  DataTable,
  Modal,
  Box,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticateAdminRequest } from "../lib/shopify-auth.server";
import { requireSuperAdmin } from "../lib/super-admin.server";
import { getAllTickets, updateTicketStatus } from "../lib/support.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  requireSuperAdmin(session.onlineAccessInfo?.associated_user?.email);
  
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") || undefined;
  
  const tickets = await getAllTickets(statusFilter);
  
  return { tickets, statusFilter };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticateAdminRequest(request);
  requireSuperAdmin(session.onlineAccessInfo?.associated_user?.email);
  
  const formData = await request.formData();
  const ticketId = formData.get("ticketId") as string;
  const status = formData.get("status") as "open" | "in_progress" | "resolved" | "closed";
  
  await updateTicketStatus(ticketId, status);
  
  return { success: true };
};

export default function AdminTicketsPage() {
  const { tickets, statusFilter } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  
  const [selectedTicket, setSelectedTicket] = useState<typeof tickets[0] | null>(null);
  const [filter, setFilter] = useState(statusFilter || "");
  
  const handleFilterChange = useCallback((value: string) => {
    setFilter(value);
    window.location.href = value ? `/app/admin/tickets?status=${value}` : "/app/admin/tickets";
  }, []);
  
  const handleStatusChange = (ticketId: string, status: string) => {
    submit({ ticketId, status }, { method: "post" });
  };
  
  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge tone="attention">Open</Badge>;
      case "in_progress":
        return <Badge tone="info">In Progress</Badge>;
      case "resolved":
        return <Badge tone="success">Resolved</Badge>;
      case "closed":
        return <Badge>Closed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Page
      title="Support Tickets"
      backAction={{ content: "Admin", url: "/app/admin" }}
    >
      <Layout>
        {/* Stats */}
        <Layout.Section>
          <InlineStack gap="400">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Open</Text>
                <Text as="p" variant="headingLg">{openCount}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">In Progress</Text>
                <Text as="p" variant="headingLg">{inProgressCount}</Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Total</Text>
                <Text as="p" variant="headingLg">{tickets.length}</Text>
              </BlockStack>
            </Card>
          </InlineStack>
        </Layout.Section>

        {/* Filter */}
        <Layout.Section>
          <Card>
            <InlineStack gap="400" align="start">
              <Box minWidth="200px">
                <Select
                  label="Filter by Status"
                  labelHidden
                  options={[
                    { label: "All Tickets", value: "" },
                    { label: "Open", value: "open" },
                    { label: "In Progress", value: "in_progress" },
                    { label: "Resolved", value: "resolved" },
                    { label: "Closed", value: "closed" },
                  ]}
                  value={filter}
                  onChange={handleFilterChange}
                />
              </Box>
            </InlineStack>
          </Card>
        </Layout.Section>

        {/* Tickets Table */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Tickets ({tickets.length})</Text>
              {tickets.length > 0 ? (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                  headings={["Date", "Shop", "Type", "Subject", "Status", "Actions"]}
                  rows={tickets.map((ticket) => [
                    new Date(ticket.createdAt).toLocaleDateString(),
                    ticket.shop?.domain || "—",
                    ticket.issueType,
                    <Button
                      key={ticket.id}
                      variant="plain"
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      {ticket.subject}
                    </Button>,
                    getStatusBadge(ticket.status),
                    <Select
                      key={`status-${ticket.id}`}
                      label="Change status"
                      labelHidden
                      options={[
                        { label: "Open", value: "open" },
                        { label: "In Progress", value: "in_progress" },
                        { label: "Resolved", value: "resolved" },
                        { label: "Closed", value: "closed" },
                      ]}
                      value={ticket.status}
                      onChange={(value) => handleStatusChange(ticket.id, value)}
                    />,
                  ])}
                />
              ) : (
                <Text as="p" tone="subdued">No tickets found.</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <Modal
          open={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          title={selectedTicket.subject}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="span" variant="bodySm" tone="subdued">
                  From: {selectedTicket.email}
                </Text>
                <Text as="span" variant="bodySm" tone="subdued">
                  {new Date(selectedTicket.createdAt).toLocaleString()}
                </Text>
              </InlineStack>
              
              <InlineStack gap="200">
                <Badge>{selectedTicket.issueType}</Badge>
                {getStatusBadge(selectedTicket.status)}
              </InlineStack>
              
              <Text as="p" variant="bodySm" tone="subdued">
                Shop: {selectedTicket.shop?.domain}
              </Text>
              
              <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                <Text as="p">{selectedTicket.message}</Text>
              </Box>
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}

export function ErrorBoundary() {
  return boundary.error(null);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
