// Gate-0 / ID-0.7A
// Public Health Endpoint (JS-style code inside TS entrypoint)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve((_req) => {
  return new Response(
    JSON.stringify({
      status: "OK",
      service: "PACE-ERP",
      gate: "0",
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
});
