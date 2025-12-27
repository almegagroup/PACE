/*
 * File-ID: ID-4.CAPTCHA
 * File-Path: supabase/functions/api/utils/verifyCaptcha.ts
 * Gate: 4
 * Purpose: Universal CAPTCHA verification (Cloudflare Turnstile)
 * Authority: Backend (SSOT)
 *
 * Rules:
 * - Token never stored
 * - Failure is silent
 * - Same logic for Web + Mobile
 */

const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyCaptcha(token: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");

  // If secret is missing, verification must fail
  if (!secret || !token) {
    return false;
  }

  try {
    const formData = new FormData();
    formData.append("secret", secret);
    formData.append("response", token);

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      return false;
    }

    const data = await res.json();

    // Cloudflare Turnstile contract
    return data?.success === true;
  } catch {
    // Silent failure (Gate-4 rule)
    return false;
  }
}
