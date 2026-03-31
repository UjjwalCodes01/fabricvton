import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // 1. Authenticate the Storefront App Proxy Request
  // authenticate.public.appProxy() throws if the Shopify HMAC signature is invalid.
  // It resolves (with session=null) for guest/anonymous shoppers — that's expected and fine.
  // Do NOT gate on !session; session is only populated when a customer is logged in.
  const { session } = await authenticate.public.appProxy(request);

  // Optional: capture logged-in customer ID for analytics/personalisation
  const url = new URL(request.url);
  const customerId = url.searchParams.get("logged_in_customer_id"); // may be null for guests

  try {
    // 2. Parse the multipart form data sent by our frontend JS
    const formData = await request.formData();
    const customerImage = formData.get("customerImage");
    const productImageUrl = formData.get("productImageUrl");

    if (!customerImage || !(customerImage instanceof File)) {
      return Response.json({ error: "Missing customer image file" }, { status: 400 });
    }
    if (!productImageUrl || typeof productImageUrl !== "string") {
      return Response.json({ error: "Missing product image URL" }, { status: 400 });
    }

    // Normalize protocol-relative URLs (e.g. //cdn.shopify.com) → https://
    const normalizedProductImageUrl = productImageUrl.startsWith("//")
      ? `https:${productImageUrl}`
      : productImageUrl;

    // 3. GenLook VTON Model API Call
    const baseUrl = process.env.GENLOOK_BASE_URL || "https://api.genlook.app/tryon/v1";
    const apiKey = process.env.GENLOOK_API_KEY;

    let resultUrl = "";

    if (apiKey) {
      console.log(`Starting GenLook try-on flow for product: ${productImageUrl}`);
      
      const headers = {
        "x-api-key": apiKey
      };

      // Step 1: Create a Product
      const productRes = await fetch(`${baseUrl}/products`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          externalId: `prod-${Date.now()}`,
          title: "Try-On Product",
          description: "Shopify Try-On integration product",
          imageUrls: [normalizedProductImageUrl]
        })
      });
      if (!productRes.ok) throw new Error(`Product creation failed: ${await productRes.text()}`);
      const productData = await productRes.json();
      const productId = productData.externalId || productData.productId;

      // Step 2: Upload Customer Photo
      const uploadFormData = new FormData();
      uploadFormData.append("file", customerImage);
      
      const uploadRes = await fetch(`${baseUrl}/images/upload`, {
        method: "POST",
        headers: headers, // Do NOT set Content-Type manually for FormData
        body: uploadFormData
      });
      if (!uploadRes.ok) throw new Error(`Image upload failed: ${await uploadRes.text()}`);
      const uploadData = await uploadRes.json();
      const imageId = uploadData.imageId;

      console.log(`Product created: ${productId}, Image uploaded: ${imageId}`);

      // Step 3: Create Try-On
      const tryonRes = await fetch(`${baseUrl}/try-on`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          productId: productId,
          customerImageId: imageId
        })
      });
      if (!tryonRes.ok) throw new Error(`Try-On generation failed: ${await tryonRes.text()}`);
      const tryonData = await tryonRes.json();
      if (!tryonData.success) {
        throw new Error(`Try-On generation API rejected: ${tryonData.error || tryonData.message || JSON.stringify(tryonData)}`);
      }
      const generationId = tryonData.generationId;

      console.log(`Generation started: ${generationId}. Polling...`);

      // Step 4: Poll for Completion
      let completed = false;
      const startTime = Date.now();
      const timeoutMs = 30000; // 30s polling timeout

      while (!completed) {
        if (Date.now() - startTime > timeoutMs) {
           throw new Error("Generation timed out");
        }
        
        const pollRes = await fetch(`${baseUrl}/generations/${generationId}`, {
          method: "GET",
          headers: headers
        });
        
        if (!pollRes.ok) throw new Error(`Polling failed: ${await pollRes.text()}`);
        const pollData = await pollRes.json();

        if (pollData.status === "COMPLETED") {
          resultUrl = pollData.resultImageUrl;
          completed = true;
          console.log("Generation COMPLETED successfully.");
        } else if (pollData.status === "FAILED") {
          throw new Error(`Generation FAILED: ${pollData.errorMessage || JSON.stringify(pollData)}`);
        } else {
          // PENDING or PROCESSING. Wait 2 seconds before next poll.
          await new Promise(res => setTimeout(res, 2000));
        }
      }

    } else {
      // 4. Mock simulation mode (useful for testing UI without burning API credits)
      console.log("No VTON API credentials found. Running in simulation mode...");
      await new Promise((resolve) => setTimeout(resolve, 3500)); // Simulate 3.5s processing time
      
      // Simple fallback image pointing to a placeholder that proves the loop completed
      resultUrl = "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"; 
    }

    // 5. Return JSON payload matching proxy expected format
    return Response.json({ success: true, resultUrl });
    
  } catch (error) {
    console.error("Try-On Proxy Error:", error);
    return Response.json(
      { error: "An internal error occurred during try-on processing" },
      { status: 500 }
    );
  }
};
