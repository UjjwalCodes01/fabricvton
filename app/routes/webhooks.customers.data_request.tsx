import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * GDPR mandatory webhook — customers/data_request
 *
 * Shopify sends this when a customer requests their data.
 * FabricVTON does not persist any customer data today (all VTON
 * processing is stateless), so we acknowledge the request and
 * return an empty 200.
 *
 * When customer data storage is added in a later phase, this
 * handler must be updated to compile and return all stored PII.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);
  console.log(
    "Customer data request received — no customer PII is stored by FabricVTON at this time.",
    { shopDomain: shop, customerId: (payload as Record<string, Record<string, unknown>>)?.customer?.id },
  );

  return new Response(null, { status: 200 });
};
