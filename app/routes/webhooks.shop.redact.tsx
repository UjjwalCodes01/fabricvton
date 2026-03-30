import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * GDPR mandatory webhook — shop/redact
 *
 * Shopify sends this 48 hours after a shop uninstalls the app,
 * instructing us to delete ALL data associated with the shop.
 *
 * We clean up any remaining session records.  When additional
 * per-shop data is stored in later phases (e.g. VTON history,
 * analytics), those records must also be purged here.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Remove all session rows for this shop domain.
  // The app/uninstalled handler already deletes sessions on uninstall,
  // but this is the definitive GDPR data-purge and must be idempotent.
  await db.session.deleteMany({ where: { shop } });

  console.log(`Shop redact complete — all data for ${shop} has been purged.`);

  return new Response(null, { status: 200 });
};
