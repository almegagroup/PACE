/*
 * File-ID: ID-1A
 * File-Path: supabase/functions/api/index.ts
 * Gate: 1 (with Gate-2 dispatch enabled)
 * Phase: 1
 * Domain: BACKEND
 * Purpose: Deterministic request pipeline entry with fixed security order
 * Authority: Backend
 */

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Pipeline
import { getAllowedOrigins } from "./pipeline/origins.ts";
import { attachRequestId } from "./pipeline/requestId.ts";
import { applySecurityHeaders } from "./pipeline/headers.ts";
import { applyCORS } from "./pipeline/cors.ts";
import { applyCSRF } from "./pipeline/csrf.ts";
import { applyRateLimit } from "./pipeline/rateLimit.ts";
import { resolveSession } from "./pipeline/session.ts";
import { resolveContext } from "./pipeline/context.ts";
import { resolveACL } from "./pipeline/acl.ts";
import { isPublicPath } from "./pipeline/public.ts";

// Handlers
import { healthHandler } from "./health.ts";
import { loginHandler } from "./domains/auth/login/login.handler.ts";
import { meHandler } from "./domains/auth/me/me.handler.ts";
import { logoutHandler } from "./domains/auth/logout/logout.handler.ts";
import { signupRequestHandler } from "./domains/auth/signup/signupRequest.handler.ts";
import { humanChallengeHandler } from "./domains/auth/humanChallenge.handler.ts";
import { listSignupRequestsHandler }
  from "./domains/auth/signup/list.handler.ts";
import { signupApprovalHandler } from "./domains/auth/signup/approval.handler.ts";
import { createUserFromSignupHandler } from "./domains/auth/signup/createUser.handler.ts";
import { statusCheckHandler } from "./domains/auth/status/statusCheck.handler.ts";
import { firstLoginHandler } 
  from "./domains/auth/first-login/firstLogin.handler.ts";
  import { forgotPasswordHandler }
  from "./domains/auth/forgot-password/forgotPassword.handler.ts";

import { forgotPasscodeHandler }
  from "./domains/auth/forgot-passcode/forgotPasscode.handler.ts";
  import { resetRequestHandler }
  from "./domains/auth/reset-request/resetRequest.handler.ts";
  import {
  listResetRequestsHandler,
  approveResetRequestHandler,
  rejectResetRequestHandler,
} from "./domains/auth/reset-request/adminReset.handler.ts";
import { resetCompleteHandler }
  from "./domains/auth/reset-complete/resetComplete.handler.ts";




// Utils
import { apiResponse, Action } from "./utils/response.ts";


  serve(async (req: Request) => {

 

    // ─────────────────────────────────────────
  // 🔑 GLOBAL BODY PARSER (SSOT) — AFTER OPTIONS
  // ─────────────────────────────────────────
  let parsedBody: any = null;

  if (
    req.method !== "GET" &&
    req.method !== "HEAD" &&
    req.headers.get("content-type")?.includes("application/json")
  ) {
    try {
      parsedBody = await req.json();
    } catch {
      parsedBody = null;
    }
  }

  // attach ONCE for entire pipeline
  (req as any)._body = parsedBody;
  // ─────────────────────────────────────────
  // 0️⃣ Request ID
  // ─────────────────────────────────────────
  req = attachRequestId(req);
   // 🔍 ENTRY PROBE — request ঢোকার মুহূর্তেই
  console.log("[ENTRY_REQ]", {
    path: new URL(req.url).pathname,
    method: req.method,
    contentType: req.headers.get("content-type"),
    contentLength: req.headers.get("content-length"),
  });

  const requestId = req.headers.get("X-Request-Id") ?? crypto.randomUUID();
  const path = new URL(req.url).pathname;
  

  const isProd =
    Deno.env.get("ENV") === "production" ||
    Deno.env.get("SUPABASE_ENV") === "production";

  const respond = (payload: any, status = 200, ctx: any = {}) =>
    apiResponse(payload, status, {
      ...ctx,
      env: {
        COOKIE_DOMAIN: isProd ? "erp.almegagroup.in" : "localhost",
        PROD: isProd,
      },
    });


  // ─────────────────────────────────────────
  // FINAL RESPONSE NORMALIZER (SSOT)
  // ─────────────────────────────────────────
   function cspSourcesFromAllowedOrigins(): string {
  // env MUST be accessed lazily
  const origins = getAllowedOrigins();
  return Array.from(origins).join(" ");
}

  function finalizeResponse(req: Request, res: Response): Response {
    const headers = new Headers(res.headers);

    headers.delete("Access-Control-Allow-Origin");
    headers.delete("Access-Control-Allow-Credentials");
    headers.delete("Vary");

    headers.set("Content-Type", "application/json");
    headers.set("Cache-Control", "no-store");
    headers.set("X-Request-Id", requestId);
    headers.set("X-Content-Type-Options", "nosniff");
headers.set("X-Frame-Options", "DENY");
headers.set("Referrer-Policy", "no-referrer");
headers.set("X-XSS-Protection", "0");

const cspOrigins = cspSourcesFromAllowedOrigins();

headers.set(
  "Content-Security-Policy",
  [
    "default-src 'none'",
    `script-src 'self' ${cspOrigins}`,
    `style-src 'self' ${cspOrigins}`,
    `img-src 'self' ${cspOrigins} data:`,
    `font-src 'self' ${cspOrigins}`,
    `connect-src 'self' ${cspOrigins}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
    `form-action 'self' ${cspOrigins}`,
  ].join("; ")
);



    const corsMeta = (req as any)._cors as { allowedOrigin?: string } | undefined;
    if (corsMeta?.allowedOrigin) {
      headers.set("Access-Control-Allow-Origin", corsMeta.allowedOrigin);
      headers.set("Access-Control-Allow-Credentials", "true");
      headers.set("Vary", "Origin");
    }

    if (headers.get("Access-Control-Allow-Origin") === "*") {
      return apiResponse(
        {
          status: "ERROR",
          code: "CORS_WILDCARD_FORBIDDEN",
          message: "Wildcard CORS forbidden",
          action: Action.NONE,
        },
        500
      );
    }

    return new Response(res.body, { status: res.status, headers });
  }

// ─────────────────────────────────────────
// PUBLIC ROUTES (NO SESSION / CSRF)
// ─────────────────────────────────────────
if (isPublicPath(req)) {
  // 🔑 STEP 1: সব browser request-এ CORS annotate হবে
  // NOTE: corsResp is only non-null for OPTIONS.
// For other methods, applyCORS only annotates req._cors
  // Only annotate CORS for non-OPTIONS
const corsResp = await applyCORS(req);
if (corsResp) {
  return finalizeResponse(req, corsResp);
}

  // 🔑 STEP 2: OPTIONS হলে এখানেই শেষ
 


  // ───── HEALTH ─────
  if (path === "/health") {
    if (req.method !== "GET") {
      return finalizeResponse(
        req,
        apiResponse(
          { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
          405
        )
      );
    }
    return finalizeResponse(req, await healthHandler(req));
  }

  // ───── LOGIN ─────
  if (path.endsWith("/auth/login")) {
    if (req.method !== "POST") {
      return finalizeResponse(
        req,
        apiResponse(
          { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
          405
        )
      );
    }

    const rl = await applyRateLimit(req);
    if (rl) return finalizeResponse(req, rl);

    const res = await loginHandler(req, {
      respond: (p: any, s = 200, c: any = {}) =>
        respond(p, s, { ...c, route: "/auth/login" }),
    });

    return finalizeResponse(req, res);
  }

  // ───── SIGNUP REQUEST ─────
  if (path.endsWith("/auth/signup-request")) {
    if (req.method !== "POST") {
      return finalizeResponse(
        req,
        apiResponse(
          { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
          405
        )
      );
    }

    const rl = await applyRateLimit(req);
    if (rl) return finalizeResponse(req, rl);

    return finalizeResponse(req, await signupRequestHandler(req));
  }
    // ───── STATUS CHECK (ONBOARDING) ─────
  if (path.endsWith("/auth/status-check")) {
    if (req.method !== "POST") {
      return finalizeResponse(
        req,
        apiResponse(
          { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
          405
        )
      );
    }

    const rl = await applyRateLimit(req);
    if (rl) return finalizeResponse(req, rl);

    const res = await statusCheckHandler(req);
    return finalizeResponse(req, res);
  }
    // ───── FIRST LOGIN SETUP ─────
  if (path.endsWith("/auth/first-login")) {
    if (req.method !== "POST") {
      return finalizeResponse(
        req,
        apiResponse(
          { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
          405
        )
      );
    }

    const rl = await applyRateLimit(req);
    if (rl) return finalizeResponse(req, rl);

    const res = await firstLoginHandler(req);
    return finalizeResponse(req, res);
  }
  // ───── FORGOT PASSWORD ─────
if (path.endsWith("/auth/forgot-password")) {
  if (req.method !== "POST") {
    return finalizeResponse(
      req,
      apiResponse(
        { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
        405
      )
    );
  }

  const rl = await applyRateLimit(req);
  if (rl) return finalizeResponse(req, rl);

  const res = await forgotPasswordHandler(req);
  return finalizeResponse(req, res);
}
// ───── FORGOT PASSCODE ─────
if (path.endsWith("/auth/forgot-passcode")) {
  if (req.method !== "POST") {
    return finalizeResponse(
      req,
      apiResponse(
        { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
        405
      )
    );
  }

  const rl = await applyRateLimit(req);
  if (rl) return finalizeResponse(req, rl);

  const res = await forgotPasscodeHandler(req);
  return finalizeResponse(req, res);
}

// ───── RESET REQUEST ─────
if (path.endsWith("/auth/reset-request")) {
  if (req.method !== "POST") {
    return finalizeResponse(
      req,
      apiResponse(
        { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
        405
      )
    );
  }

  const rl = await applyRateLimit(req);
  if (rl) return finalizeResponse(req, rl);

  const res = await resetRequestHandler(req);
  return finalizeResponse(req, res);
}

// ───── RESET COMPLETE ─────
if (path.endsWith("/auth/reset-complete")) {
  if (req.method !== "POST") {
    return finalizeResponse(
      req,
      apiResponse(
        { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
        405
      )
    );
  }

  const rl = await applyRateLimit(req);
  if (rl) return finalizeResponse(req, rl);

  const res = await resetCompleteHandler(req);
  return finalizeResponse(req, res);
}



  // ───── HUMAN CHALLENGE ─────
  if (path.endsWith("/auth/human-challenge")) {
    if (req.method !== "GET") {
      return finalizeResponse(
        req,
        apiResponse(
          { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
          405
        )
      );
    }

    return finalizeResponse(req, await humanChallengeHandler());
  }

  // ───── FALLBACK ─────
  return finalizeResponse(
    req,
    apiResponse(
      { status: "ERROR", code: "ROUTE_NOT_FOUND", action: Action.NONE },
      404
    )
  );
}

  // ─────────────────────────────────────────
  // FULL SECURITY PIPELINE
  // ─────────────────────────────────────────
  let early: Response | null;

  if ((early = await applySecurityHeaders(req)))
    return finalizeResponse(req, early);
  if ((early = await applyCORS(req))) return finalizeResponse(req, early);
  if ((early = await applyCSRF(req))) return finalizeResponse(req, early);
  if ((early = await applyRateLimit(req))) return finalizeResponse(req, early);

  const sessionResult = await resolveSession(req);
  if (sessionResult.response)
    return finalizeResponse(req, sessionResult.response);

  const contextResult = await resolveContext(req, sessionResult);
  if (contextResult.response)
    return finalizeResponse(req, contextResult.response);

  // 🔒 HARD CONTEXT STATUS CHECK (CRITICAL)
  if (contextResult.status !== "OK") {
    return finalizeResponse(
      req,
      respond(
        {
          status: "ERROR",
          code: "CONTEXT_BLOCKED",
          action: Action.NONE,
        },
        403
      )
    );
  }

  const aclResult = await resolveACL(req, contextResult);
  if (aclResult.response) return finalizeResponse(req, aclResult.response);
 // ─────────────────────────────────────────
// ADMIN :: RESET REQUEST GOVERNANCE
// ─────────────────────────────────────────

// LIST RESET REQUESTS
if (path === "/api/admin/auth/reset-requests") {
  if (req.method !== "GET") {
    return finalizeResponse(
      req,
      respond(
        { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
        405
      )
    );
  }

  return finalizeResponse(
  req,
  await listResetRequestsHandler(req, {
    user: contextResult.context,
    respond,
  })
);
}

// APPROVE RESET REQUEST
if (path.match(/^\/api\/admin\/auth\/reset-requests\/[^/]+\/approve$/)) {
  if (req.method !== "POST") {
    return finalizeResponse(
      req,
      respond(
        { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
        405
      )
    );
  }

  const id = path.split("/")[5];

  return finalizeResponse(
  req,
  await approveResetRequestHandler(req, {
    user: contextResult.context,
    params: { id },
    respond,
  })
);

}

// REJECT RESET REQUEST
if (path.match(/^\/api\/admin\/auth\/reset-requests\/[^/]+\/reject$/)) {
  if (req.method !== "POST") {
    return finalizeResponse(
      req,
      respond(
        { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
        405
      )
    );
  }

  const id = path.split("/")[5];

  return finalizeResponse(
  req,
  await rejectResetRequestHandler(req, {
    user: contextResult.context,
    params: { id },
    respond,
  })
);
}


  // ─────────────────────────────────────────
  // ADMIN ROUTES (FULL CONTEXT PASSTHROUGH)
  // ─────────────────────────────────────────
  console.log("[ROUTE_HIT]", {
  path,
  method: req.method,
  hasCookie: !!req.headers.get("cookie"),
});
// ─────────────────────────────────────────
// ADMIN :: SIGNUP REQUEST LIST (SA ONLY)
// ─────────────────────────────────────────
if (path === "/api/admin/signup/requests") {
  if (req.method !== "GET") {
    return finalizeResponse(
      req,
      respond(
        { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
        405
      )
    );
  }

  return finalizeResponse(
    req,
    await listSignupRequestsHandler(req, {
      context: contextResult.context,
    })
  );
}

  if (path.endsWith("/admin/signup/approve")) {
    if (req.method !== "POST")
      return respond(
        { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
        405
      );

    return finalizeResponse(
      req,
      await signupApprovalHandler(req, {
        context: contextResult.context,
      })
    );
  }

  if (path.endsWith("/admin/signup/create-user")) {
    if (req.method !== "POST")
      return respond(
        { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
        405
      );

    return finalizeResponse(
      req,
      await createUserFromSignupHandler(req, {
        context: contextResult.context,
      })
    );
  }

  // ─────────────────────────────────────────
  // AUTH ROUTES
  // ─────────────────────────────────────────
  if (path.endsWith("/me") || path.endsWith("/auth/me")) {
    if (req.method !== "GET")
      return respond(
        { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
        405
      );

    return finalizeResponse(
      req,
      await meHandler(req, {
        session:
          sessionResult.status === "CLAIMED"
            ? {
                sessionId: sessionResult.sessionId!,
                state: sessionResult.state,
              }
            : undefined,
      })
    );
  }

  if (path.endsWith("/logout") || path.endsWith("/auth/logout")) {
    if (req.method !== "POST")
      return respond(
        { status: "ERROR", code: "METHOD_NOT_ALLOWED", action: Action.NONE },
        405
      );

    return finalizeResponse(
      req,
      respond(
        await logoutHandler(req, {
          session:
            sessionResult.status === "CLAIMED"
              ? {
                  sessionId: sessionResult.sessionId!,
                  state: sessionResult.state,
                }
              : undefined,
        })
      )
    );
  }

  // ─────────────────────────────────────────
  // DEFAULT
  // ─────────────────────────────────────────
  return respond(
    { status: "ERROR", code: "ROUTE_NOT_FOUND", action: Action.NONE },
    404
  );
});
