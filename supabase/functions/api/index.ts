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

// Pipeline stages
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

// SSOT response envelope
import { apiResponse, Action } from "./utils/response.ts";
import { signupRequestHandler } from "./domains/auth/signup/signupRequest.handler.ts";


serve(async (req: Request) => {
  // ─────────────────────────────────────────
  // ID-10 :: Request ID (always first)
  // ─────────────────────────────────────────
  req = attachRequestId(req);
  const requestId = req.headers.get("X-Request-Id") ?? crypto.randomUUID();

  // ─────────────────────────────────────────
  // FINAL RESPONSE NORMALIZER (SSOT)
  // ─────────────────────────────────────────
  function finalizeResponse(
    req: Request,
    res: Response,
    requestId: string
  ): Response {
    const headers = new Headers(res.headers);

    // HARD RESET — never trust upstream
    headers.delete("Access-Control-Allow-Origin");
    headers.delete("Access-Control-Allow-Credentials");
    headers.delete("Vary");

    // Base headers
    headers.set("Content-Type", "application/json");
    headers.set("Cache-Control", "no-store");
    headers.set("X-Request-Id", requestId);

    // CORS propagation (ONLY from pipeline)
    const corsMeta = (req as any)._cors as { allowedOrigin?: string } | undefined;
    if (corsMeta?.allowedOrigin) {
      headers.set("Access-Control-Allow-Origin", corsMeta.allowedOrigin);
      headers.set("Access-Control-Allow-Credentials", "true");
      headers.set("Vary", "Origin");
    }

    // Absolute guard
    if (headers.get("Access-Control-Allow-Origin") === "*") {
      return apiResponse(
        {
          status: "ERROR",
          code: "CORS_WILDCARD_FORBIDDEN",
          message: "Wildcard CORS forbidden by policy",
          action: Action.NONE,
        },
        500
      );
    }

    return new Response(res.body, {
      status: res.status,
      headers,
    });
  }

  // ─────────────────────────────────────────
  // PUBLIC ENDPOINTS (NO PIPELINE)
  // ─────────────────────────────────────────
  if (isPublicPath(req)) {
    // Public routes need CORS only
    const corsResp = await applyCORS(req);
if (corsResp) {
  // 🚫 DO NOT normalize OPTIONS through finalizeResponse
  if (req.method === "OPTIONS") {
    return corsResp;
  }
  return finalizeResponse(req, corsResp, requestId);
}

    const path = new URL(req.url).pathname;

    // /health
    if (path === "/health") {
      if (req.method !== "GET") {
        return apiResponse(
          {
            status: "ERROR",
            code: "METHOD_NOT_ALLOWED",
            message: "Only GET allowed",
            action: Action.NONE,
          },
          405
        );
      }
      return healthHandler(req);
    }

    // /auth/login
    if (path.endsWith("/auth/login")) {
      if (req.method !== "POST") {
        return apiResponse(
          {
            status: "ERROR",
            code: "METHOD_NOT_ALLOWED",
            message: "Use POST",
            action: Action.NONE,
          },
          405
        );
      }

      // 🔒 ID-2.5 :: AUTH RATE LIMIT (LOGIN ONLY)
  const rateLimitResp = await applyRateLimit(req);
  if (rateLimitResp) {
    return finalizeResponse(req, rateLimitResp, requestId);
  }

      const isProd =
        Deno.env.get("ENV") === "production" ||
        Deno.env.get("SUPABASE_ENV") === "production";

      const respond = (payload: any, status = 200, ctx: any = {}) =>
        apiResponse(payload, status, {
          ...ctx,
          route: "/auth/login",
          env: {
            COOKIE_DOMAIN: isProd ? "erp.almegagroup.in" : "localhost",
            PROD: isProd,
          },
        });

      const res = await loginHandler(req, { respond });
      return finalizeResponse(req, res, requestId);
    }
        // /auth/signup-request
    if (path.endsWith("/auth/signup-request")) {
      if (req.method !== "POST") {
        return apiResponse(
          {
            status: "ERROR",
            code: "METHOD_NOT_ALLOWED",
            message: "Use POST",
            action: Action.NONE,
          },
          405
        );
      }

      // ID-4.1 uses global rate limit (not login-specific)
      const rateLimitResp = await applyRateLimit(req);
      if (rateLimitResp) {
        return finalizeResponse(req, rateLimitResp, requestId);
      }

     const res = await signupRequestHandler(req);
    return finalizeResponse(req, res, requestId);
    }


    return;
  }

  // ─────────────────────────────────────────
  // FULL SECURITY PIPELINE
  // ─────────────────────────────────────────
  let early: Response | null;

  early = await applySecurityHeaders(req);
  if (early) return finalizeResponse(req, early, requestId);

  early = await applyCORS(req);
  if (early) return finalizeResponse(req, early, requestId);

  early = await applyCSRF(req);
  if (early) return finalizeResponse(req, early, requestId);

  early = await applyRateLimit(req);
  if (early) return finalizeResponse(req, early, requestId);

  const sessionResult = await resolveSession(req);
  if (sessionResult.response)
    return finalizeResponse(req, sessionResult.response, requestId);

  const contextResult = await resolveContext(req, sessionResult);
  if (contextResult.response)
    return finalizeResponse(req, contextResult.response, requestId);

  const aclResult = await resolveACL(req, contextResult);
  if (aclResult.response)
    return finalizeResponse(req, aclResult.response, requestId);

  // ─────────────────────────────────────────
  // AUTH: /me
  // ─────────────────────────────────────────
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

  if (path.endsWith("/me") || path.endsWith("/auth/me")) {
    if (req.method !== "GET") {
      return respond(
        {
          status: "ERROR",
          code: "METHOD_NOT_ALLOWED",
          message: "Use GET",
          action: Action.NONE,
        },
        405
      );
    }

    const res = await meHandler(req, {
  session: sessionResult.status === "CLAIMED"
    ? {
        sessionId: sessionResult.sessionId!,
        state: sessionResult.state,
      }
    : undefined,
});
    return finalizeResponse(req, res, requestId);
  }
  // ─────────────────────────────────────────
// AUTH: /logout
// ─────────────────────────────────────────

if (path.endsWith("/logout") || path.endsWith("/auth/logout")) {
  if (req.method !== "POST") {
    return respond(
      {
        status: "ERROR",
        code: "METHOD_NOT_ALLOWED",
        message: "Use POST",
        action: Action.NONE,
      },
      405
    );
  }

  const payload = await logoutHandler(req, {
    session:
      sessionResult.status === "CLAIMED"
        ? {
            sessionId: sessionResult.sessionId!,
            state: sessionResult.state,
          }
        : undefined,
  });

  return finalizeResponse(
    req,
    respond(payload, 200),
    requestId
  );
}



  // ─────────────────────────────────────────
  // DEFAULT
  // ─────────────────────────────────────────
  return respond(
    {
      status: "ERROR",
      code: "ROUTE_NOT_FOUND",
      message: "Not found",
      action: Action.NONE,
    },
    404
  );
});
