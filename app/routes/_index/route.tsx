import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.content}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Fabric VTON</p>
            <h1 className={styles.heading}>
              Virtual Try-On that turns product pages into fitting rooms
            </h1>
            <p className={styles.text}>
              Give shoppers an instant AI try-on experience inside your Shopify
              storefront, with no custom theme coding and a merchant dashboard
              for analytics, settings, and billing.
            </p>
            <div className={styles.previewShell} aria-hidden="true">
              <div className={styles.previewTopbar}>
                <span className={styles.previewDot} />
                <span className={styles.previewDot} />
                <span className={styles.previewDot} />
              </div>
              <div className={styles.previewGrid}>
                <div className={styles.previewPanel}>
                  <span className={styles.previewLabel}>Storefront</span>
                  <div className={styles.previewImage} />
                  <div className={styles.previewLine} />
                  <div className={styles.previewLineShort} />
                </div>
                <div className={styles.previewPanel}>
                  <span className={styles.previewLabel}>AI Try-On</span>
                  <div className={styles.previewImageAlt} />
                  <div className={styles.previewStats}>
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.metricRow}>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>Theme App</span>
                <span className={styles.metricLabel}>plug in with no-code setup</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>AI Try-On</span>
                <span className={styles.metricLabel}>customer previews in seconds</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricValue}>Merchant Tools</span>
                <span className={styles.metricLabel}>analytics, billing, settings</span>
              </div>
            </div>
          </div>

          <div className={styles.launchPanel}>
            <div className={styles.panelHeader}>
              <p className={styles.panelEyebrow}>Launch your store</p>
              <h2 className={styles.panelTitle}>Open the Shopify app</h2>
              <p className={styles.panelText}>
                Enter your store domain to continue through Shopify OAuth and
                land inside the embedded merchant dashboard.
              </p>
            </div>
            {showForm && (
              <Form className={styles.form} method="post" action="/auth/login">
                <label className={styles.label}>
                  <span>Shop domain</span>
                  <input
                    className={styles.input}
                    type="text"
                    name="shop"
                    placeholder="my-shop.myshopify.com"
                  />
                </label>
                <button className={styles.button} type="submit">
                  Get started
                </button>
              </Form>
            )}
            <div className={styles.panelHint}>
              Use your `myshopify.com` domain, for example
              <span> fabricvton-devstore.myshopify.com</span>
            </div>
          </div>
        </section>

        <section className={styles.features}>
          <article className={styles.featureCard}>
            <span className={styles.featureTag}>Customer Experience</span>
            <h3>AI-powered try-on on the product page</h3>
            <p>
              Shoppers upload a photo and preview how garments look before they
              buy, creating a more confident path to checkout.
            </p>
          </article>
          <article className={styles.featureCard}>
            <span className={styles.featureTag}>Merchant Setup</span>
            <h3>Shopify-native installation flow</h3>
            <p>
              Installs as a Shopify Theme App Extension, so merchants can enable
              the experience without custom theme development.
            </p>
          </article>
          <article className={styles.featureCard}>
            <span className={styles.featureTag}>Operations</span>
            <h3>Built for analytics, settings, and growth</h3>
            <p>
              Merchants can manage configuration, review try-on activity, and
              monitor app usage from the embedded admin experience.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
}
