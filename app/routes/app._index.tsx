import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticateAdminRequest } from "../lib/shopify-auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Authenticate first to ensure the user is logged in
  await authenticateAdminRequest(request);
  // Redirect to the main dashboard
  return redirect("/app/dashboard");
};

export default function Index() {
  // This won't render since we always redirect
  return null;
}

export function ErrorBoundary() {
  return boundary.error(null);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
