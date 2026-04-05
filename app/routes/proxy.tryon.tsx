import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { logTryOnEvent } from "../lib/events.server";
import { canPerformTryOn, getOrCreateShop } from "../lib/billing.server";
import { logApiCall } from "../lib/logs.server";
import { getPlatformSettings } from "../lib/platform.server";

export const maxDuration = 60;

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // 1. Authenticate the Storefront App Proxy Request
  // authenticate.public.appProxy() throws if the Shopify HMAC signature is invalid.
  // It resolves (with session=null) for guest/anonymous shoppers — that's expected and fine.
  const { session } = await authenticate.public.appProxy(request);

  // Get shop domain from the request
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop") || "";

  // Track timing
  const startTime = Date.now();
  let productImageUrl = "";
  let success = false;
  let errorMessage: string | null = null;
  let resultUrl = "";
  let httpStatusCode = 200;

  try {
    // Check platform maintenance mode
    const platformSettings = await getPlatformSettings();
    if (platformSettings?.maintenanceMode) {
      httpStatusCode = 503;
      return Response.json(
        { error: "Service temporarily unavailable for maintenance" },
        { status: 503 }
      );
    }

    // 2. Check billing status before processing
    if (shopDomain) {
      const billingCheck = await canPerformTryOn(shopDomain);
      if (!billingCheck.allowed) {
        httpStatusCode = 402;
        await logApiCall({
          shopDomain,
          endpoint: "/proxy/tryon",
          method: "POST",
          statusCode: 402,
          durationMs: Date.now() - startTime,
          success: false,
          errorMessage: billingCheck.reason,
        });
        return Response.json(
          { error: billingCheck.reason, billingRequired: true },
          { status: 402 }
        );
      }
      // Ensure shop exists in our DB
      await getOrCreateShop(shopDomain);
    }

    // 3. Parse the multipart form data sent by our frontend JS
    const formData = await request.formData();
    const customerImage = formData.get("customerImage");
    productImageUrl = (formData.get("productImageUrl") as string) || "";

    if (!customerImage || !(customerImage instanceof File)) {
      throw new Error("Missing customer image file");
    }
    if (!productImageUrl) {
      throw new Error("Missing product image URL");
    }

    // Normalize protocol-relative URLs (e.g. //cdn.shopify.com) → https://
    const normalizedProductImageUrl = productImageUrl.startsWith("//")
      ? `https:${productImageUrl}`
      : productImageUrl;

    // 4. GenLook VTON Model API Call
    const baseUrl = process.env.GENLOOK_BASE_URL || "https://api.genlook.app/tryon/v1";
    const apiKey = process.env.GENLOOK_API_KEY;

    if (apiKey) {
      console.log(`[FabricVTON] Starting GenLook try-on for: ${normalizedProductImageUrl}`);

      const headers: Record<string, string> = {
        "x-api-key": apiKey
      };

      // Step 1: Create a Product
      console.log(`[FabricVTON] Step 1: Creating product...`);
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
      if (!productRes.ok) {
        const errText = await productRes.text();
        console.error(`[FabricVTON] Product creation failed (${productRes.status}): ${errText}`);
        throw new Error(`Product creation failed (${productRes.status}): ${errText}`);
      }
      const productData = await productRes.json();
      const productId = productData.externalId || productData.productId;
      console.log(`[FabricVTON] Product created: ${productId}`);

      // Step 2: Upload Customer Photo
      console.log(`[FabricVTON] Step 2: Uploading customer image...`);
      const uploadFormData = new FormData();
      uploadFormData.append("file", customerImage);

      const uploadRes = await fetch(`${baseUrl}/images/upload`, {
        method: "POST",
        headers: headers,
        body: uploadFormData
      });
      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error(`[FabricVTON] Image upload failed (${uploadRes.status}): ${errText}`);
        throw new Error(`Image upload failed (${uploadRes.status}): ${errText}`);
      }
      const uploadData = await uploadRes.json();
      const imageId = uploadData.imageId;
      console.log(`[FabricVTON] Image uploaded: ${imageId}`);

      // Step 3: Create Try-On
      console.log(`[FabricVTON] Step 3: Starting try-on generation...`);
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
      if (!tryonRes.ok) {
        const errText = await tryonRes.text();
        console.error(`[FabricVTON] Try-On request failed (${tryonRes.status}): ${errText}`);
        throw new Error(`Try-On request failed (${tryonRes.status}): ${errText}`);
      }
      const tryonData = await tryonRes.json();
      if (!tryonData.success) {
        throw new Error(`Try-On API rejected: ${tryonData.error || tryonData.message || JSON.stringify(tryonData)}`);
      }
      const generationId = tryonData.generationId;
      console.log(`[FabricVTON] Generation started: ${generationId}`);

      // Step 4: Poll for Completion
      let completed = false;
      const pollStartTime = Date.now();
      const timeoutMs = 30000; // 30s polling timeout

      while (!completed) {
        if (Date.now() - pollStartTime > timeoutMs) {
           throw new Error("Generation timed out after 30 seconds");
        }

        const pollRes = await fetch(`${baseUrl}/generations/${generationId}`, {
          method: "GET",
          headers: headers
        });

        if (!pollRes.ok) {
          const errText = await pollRes.text();
          throw new Error(`Polling failed (${pollRes.status}): ${errText}`);
        }
        const pollData = await pollRes.json();

        console.log(`[FabricVTON] Generation status: ${pollData.status}`);

        if (pollData.status === "COMPLETED") {
          resultUrl = pollData.resultImageUrl;
          completed = true;
          console.log(`[FabricVTON] Generation COMPLETED: ${resultUrl}`);
        } else if (pollData.status === "FAILED") {
          throw new Error(`Generation FAILED: ${pollData.errorMessage || JSON.stringify(pollData)}`);
        } else {
          await new Promise(res => setTimeout(res, 2000));
        }
      }

    } else {
      // Mock simulation mode
      console.log("[FabricVTON] No API key found — running in simulation mode...");
      await new Promise((resolve) => setTimeout(resolve, 3500));
      resultUrl = "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png";
    }

    success = true;
    const durationMs = Date.now() - startTime;

    // 5. Log the successful event
    if (shopDomain) {
      await Promise.all([
        logTryOnEvent({
          shopDomain,
          productImageUrl,
          success: true,
          durationMs,
        }),
        logApiCall({
          shopDomain,
          endpoint: "/proxy/tryon",
          method: "POST",
          statusCode: 200,
          durationMs,
          success: true,
        }),
      ]);
    }

    return Response.json({ success: true, resultUrl });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errorMessage = message;
    httpStatusCode = 500;
    console.error("[FabricVTON] Try-On Proxy Error:", message);

    // Log the failed event
    if (shopDomain) {
      const durationMs = Date.now() - startTime;
      await Promise.all([
        logTryOnEvent({
          shopDomain,
          productImageUrl,
          success: false,
          errorMessage: message,
          durationMs,
        }),
        logApiCall({
          shopDomain,
          endpoint: "/proxy/tryon",
          method: "POST",
          statusCode: 500,
          durationMs,
          success: false,
          errorMessage: message,
        }),
      ]);
    }

    return Response.json(
      { error: message },
      { status: 500 }
    );
  }
};
