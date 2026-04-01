/**
 * Super Admin Authentication
 *
 * Uses SUPER_ADMIN_EMAILS env var to control access to admin-only routes.
 * Emails are compared case-insensitively.
 */

const getSuperAdminEmails = (): string[] => {
  const emails = process.env.SUPER_ADMIN_EMAILS || "";
  return emails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
};

/**
 * Check if an email belongs to a super admin
 */
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = getSuperAdminEmails();
  return adminEmails.includes(email.toLowerCase());
}

/**
 * Require super admin access. Throws Response if not authorized.
 * Use in loader/action functions to protect admin routes.
 */
export function requireSuperAdmin(email: string | null | undefined): void {
  if (!isSuperAdmin(email)) {
    throw new Response("Forbidden: Super admin access required", {
      status: 403,
      statusText: "Forbidden",
    });
  }
}

/**
 * Get info about super admin configuration (for debugging)
 */
export function getSuperAdminInfo() {
  const emails = getSuperAdminEmails();
  return {
    configured: emails.length > 0,
    count: emails.length,
  };
}
