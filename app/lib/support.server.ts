/**
 * Support Ticket Management
 */

import prisma from "../db.server";

export const ISSUE_TYPES = [
  { value: "billing", label: "Billing Issue" },
  { value: "technical", label: "Technical Problem" },
  { value: "feature_request", label: "Feature Request" },
  { value: "other", label: "Other" },
] as const;

export type IssueType = typeof ISSUE_TYPES[number]["value"];

/**
 * Create a support ticket
 */
export async function createSupportTicket(
  shopDomain: string,
  data: {
    email: string;
    issueType: IssueType;
    subject: string;
    message: string;
  }
) {
  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    select: { id: true },
  });

  if (!shop) throw new Error("Shop not found");

  return prisma.supportTicket.create({
    data: {
      shopId: shop.id,
      email: data.email,
      issueType: data.issueType,
      subject: data.subject,
      message: data.message,
    },
  });
}

/**
 * Get tickets for a shop
 */
export async function getShopTickets(shopDomain: string) {
  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    select: { id: true },
  });

  if (!shop) return [];

  return prisma.supportTicket.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get all tickets (for super admin)
 */
export async function getAllTickets(status?: string) {
  const where = status ? { status } : {};

  return prisma.supportTicket.findMany({
    where,
    include: {
      shop: { select: { domain: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Update ticket status
 */
export async function updateTicketStatus(
  ticketId: string,
  status: "open" | "in_progress" | "resolved" | "closed"
) {
  const data: Record<string, unknown> = { status };
  if (status === "resolved" || status === "closed") {
    data.resolvedAt = new Date();
  }

  return prisma.supportTicket.update({
    where: { id: ticketId },
    data,
  });
}
