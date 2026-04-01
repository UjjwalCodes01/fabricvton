import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * GDPR mandatory webhook — customers/redact
 *
 * Shopify sends this when a customer requests deletion of their data.
 * FabricVTON does not persist any customer PII today (all VTON
 * processing is stateless), so we acknowledge the request and
 * return an empty 200.
 *
 * When customer data storage is added in a later phase, this
 * handler must delete ALL stored PII for the specified customer.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log(
    "Customer redact request received — no customer PII is stored by FabricVTON at this time.",
    { shopDomain: shop },
  );

  return new Response(null, { status: 200 });
};
