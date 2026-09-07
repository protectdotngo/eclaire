import type { APIRoute } from "astro";

// Kubernetes liveness/readiness probe target: must stay cheap (no SSR, no DB),
// otherwise the kubelet kills busy-but-healthy pods under load.
export const GET: APIRoute = () =>
  new Response("ok", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
