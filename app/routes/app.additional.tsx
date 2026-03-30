export default function AdditionalPage() {
  return (
    <s-page heading="Setup">
      <s-section heading="Install checklist">
        <s-paragraph>
          Use this page as the quick verification guide while testing the app
          against a Shopify development store.
        </s-paragraph>
        <s-unordered-list>
          <s-list-item>Start local development with <code>shopify app dev</code>.</s-list-item>
          <s-list-item>Install the app on your dev store.</s-list-item>
          <s-list-item>Open the embedded admin and verify the Overview page reports an active token.</s-list-item>
          <s-list-item>Enable the Fabric VTON app embed from the theme editor.</s-list-item>
        </s-unordered-list>
      </s-section>
      <s-section slot="aside" heading="OAuth notes">
        <s-unordered-list>
          <s-list-item>
            The app uses Shopify&apos;s expiring offline token flow with refresh
            token support enabled.
          </s-list-item>
          <s-list-item>
            Session records are persisted by Prisma session storage and reused per
            shop.
          </s-list-item>
          <s-list-item>
            Every embedded admin request rechecks the stored offline token state
            before rendering the dashboard.
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}
