import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // 1. Authenticate the Storefront App Proxy Request
  const { session } = await authenticate.public.appProxy(request);

  if (!session) {
    return new Response("Unauthorized App Proxy Request", { status: 401 });
  }

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

    // 3. VTON Model API Call (Replicate / Custom API)
    // Here we read the custom API credentials or fallback to a simulated response
    const vtonApiUrl = process.env.VTON_API_URL;
    const vtonApiKey = process.env.VTON_API_KEY;

    let resultUrl = "";

    if (vtonApiUrl && vtonApiKey) {
      console.log(`Sending try-on request to ${vtonApiUrl} for product: ${productImageUrl}`);
      
      // If the third-party API expects a multipart payload:
      const apiFormData = new FormData();
      apiFormData.append("human_image", customerImage); // User's uploaded file
      apiFormData.append("garm_image_url", productImageUrl); // Product image URL
      
      const apiResponse = await fetch(vtonApiUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${vtonApiKey}`,
          // Note: When sending FormData via fetch, do NOT set Content-Type manually.
          // The browser/Node will automatically set the correct boundary.
        },
        body: apiFormData,
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error("VTON API Error:", errorText);
        throw new Error("Failed to generate try-on image from external API");
      }

      const apiJson = await apiResponse.json();
      
      // Extract the output URL (adjust keys based on your specific model's response)
      resultUrl = apiJson.imageUrl || apiJson.result_url || apiJson.output;

      if (!resultUrl) {
         throw new Error("External API did not return a recognizable image URL");
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
