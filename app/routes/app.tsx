import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticateAdminRequest } from "../lib/shopify-auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { offlineToken } = await authenticateAdminRequest(request);

  // eslint-disable-next-line no-undef
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    tokenState: offlineToken.state,
  };
};

export default function App() {
  const { apiKey, tokenState } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <nav
        style={{
          display: "flex",
          gap: "12px",
          padding: "16px 20px 0",
        }}
      >
        <Link to="/app">Overview</Link>
        <Link to="/app/additional">
          {tokenState === "active" ? "Setup" : "OAuth attention"}
        </Link>
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
