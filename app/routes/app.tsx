import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticateAdminRequest } from "../lib/shopify-auth.server";
import { isSuperAdmin } from "../lib/super-admin.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, offlineToken } = await authenticateAdminRequest(request);
  const userEmail = session.onlineAccessInfo?.associated_user?.email || "";
  const showAdminLink = isSuperAdmin(userEmail);

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    tokenState: offlineToken.state,
    showAdminLink,
  };
};

export default function App() {
  const { apiKey, tokenState, showAdminLink } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <nav
        style={{
          display: "flex",
          gap: "12px",
          padding: "16px 20px 0",
          flexWrap: "wrap",
          borderBottom: "1px solid #e1e3e5",
          paddingBottom: "12px",
        }}
      >
        <Link to="/app/dashboard">Dashboard</Link>
        <Link to="/app/analytics">Analytics</Link>
        <Link to="/app/products">Products</Link>
        <Link to="/app/settings">Settings</Link>
        <Link to="/app/billing">Billing</Link>
        <Link to="/app/support">Support</Link>
        {showAdminLink && (
          <Link to="/app/admin" style={{ color: "#6200ea" }}>
            Admin
          </Link>
        )}
      </nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
