import type { LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  return Response.json({
    ok: true,
    service: "fabricvton",
    env: process.env.NODE_ENV || "development",
    host: url.host,
    timestamp: new Date().toISOString(),
  });
};

export default function HealthRoute() {
  return null;
}
