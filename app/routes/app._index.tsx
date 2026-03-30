import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  authenticateAdminRequest,
  formatTokenTimestamp,
} from "../lib/shopify-auth.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, offlineToken } = await authenticateAdminRequest(request);
  const response = await admin.graphql(
    `#graphql
      query FabricVtonAppOverview {
        shop {
          name
          myshopifyDomain
          primaryDomain {
            url
          }
          plan {
            displayName
          }
        }
      }`,
  );
  const responseJson = await response.json();
  const shop = responseJson.data.shop;

  return {
    shop: {
      domain: session.shop,
      displayName: shop.name,
      myshopifyDomain: shop.myshopifyDomain,
      primaryDomain: shop.primaryDomain?.url ?? null,
      plan: shop.plan?.displayName ?? "Unknown",
    },
    offlineToken: {
      ...offlineToken,
      expiresAtLabel: formatTokenTimestamp(offlineToken.expiresAt),
      refreshExpiresAtLabel: formatTokenTimestamp(offlineToken.refreshExpiresAt),
    },
  };
};

export default function Index() {
  const { shop, offlineToken } = useLoaderData<typeof loader>();

  const tone =
    offlineToken.state === "active"
      ? "success"
      : offlineToken.state === "expiring_soon"
        ? "warning"
        : "critical";

  const tokenSummary =
    offlineToken.state === "active"
      ? "Offline access token is active and ready for Admin API calls."
      : offlineToken.state === "expiring_soon"
        ? "Offline access token is close to expiry. Shopify can rotate it using the stored refresh token."
        : offlineToken.state === "expired"
          ? "Offline access token has expired. A refresh token is expected to rotate it."
          : offlineToken.state === "refresh_expired"
            ? "Both token rotation and merchant re-authentication are required."
            : "No offline token record was found for this shop yet.";

  return (
    <s-page heading="Fabric VTON Admin">
      <s-section heading="Store access">
        <s-paragraph>
          This embedded app stores one installation record per shop using Shopify
          session storage and validates the offline token state on each admin
          request.
        </s-paragraph>
        <s-stack direction="block" gap="base">
          <s-text><strong>Shop name:</strong> {shop.displayName}</s-text>
          <s-text><strong>Shop domain:</strong> {shop.myshopifyDomain}</s-text>
          <s-text><strong>App session shop:</strong> {shop.domain}</s-text>
          <s-text><strong>Plan:</strong> {shop.plan}</s-text>
          {shop.primaryDomain ? (
            <s-text><strong>Primary domain:</strong> {shop.primaryDomain}</s-text>
          ) : null}
        </s-stack>
      </s-section>

      <s-section heading="OAuth token health">
        <s-badge tone={tone}>{offlineToken.state.replaceAll("_", " ")}</s-badge>
        <s-paragraph>{tokenSummary}</s-paragraph>
        <s-stack direction="block" gap="base">
          <s-text>
            <strong>Access token stored:</strong>{" "}
            {offlineToken.hasAccessToken ? "Yes" : "No"}
          </s-text>
          <s-text>
            <strong>Refresh token stored:</strong>{" "}
            {offlineToken.hasRefreshToken ? "Yes" : "No"}
          </s-text>
          <s-text>
            <strong>Access token expires at:</strong>{" "}
            {offlineToken.expiresAtLabel}
          </s-text>
          <s-text>
            <strong>Refresh token expires at:</strong>{" "}
            {offlineToken.refreshExpiresAtLabel}
          </s-text>
          <s-text>
            <strong>Granted scopes:</strong> {offlineToken.scope ?? "Unavailable"}
          </s-text>
          <s-text>
            <strong>Needs re-authentication:</strong>{" "}
            {offlineToken.needsReauth ? "Yes" : "No"}
          </s-text>
        </s-stack>
      </s-section>

      <s-section heading="Next verification step">
        <s-paragraph>
          Install this app on a Shopify dev store, open it in the Shopify admin,
          and confirm this screen shows an active token plus the expected shop
          domain and scopes.
        </s-paragraph>
        <s-paragraph>
          The Theme App Extension scaffold for the Fabric VTON embed block lives
          under <code>extensions/fabricvton-theme</code>.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export function ErrorBoundary() {
  return boundary.error(null);
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
