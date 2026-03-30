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
      <div className={styles.content}>
        <p className={styles.eyebrow}>Fabric VTON</p>
        <h1 className={styles.heading}>
          Virtual Try-On for Every Storefront
        </h1>
        <p className={styles.text}>
          Let your shoppers see how garments look on them before they buy —
          powered by AI-driven virtual try-on, right inside your Shopify store.
        </p>
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
        <ul className={styles.list}>
          <li>
            <strong>AI-Powered Try-On</strong>. Shoppers upload a photo and
            instantly see themselves wearing your products — no physical samples
            needed.
          </li>
          <li>
            <strong>Seamless Integration</strong>. Installs as a Shopify Theme
            App Extension — no code changes to your theme, works out of the box.
          </li>
          <li>
            <strong>Reduce Returns</strong>. Customers who see how garments fit
            before checkout return far fewer items, improving margins and
            satisfaction.
          </li>
        </ul>
      </div>
    </div>
  );
}
