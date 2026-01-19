/**
 * File-ID: ID-4.1C
 * Gate: 4
 * Phase: 4
 * Domain: SECURITY
 * Tier: A
 * Status: FINAL – FROZEN
 *
 * PURPOSE
 * -------
 * Backend-only human verification engine.
 *
 * HARD RULES (LOCKED)
 * ------------------
 * - No frontend authority
 * - No answer storage
 * - Deterministic pass / fail
 * - Stateless (Edge-safe)
 * - Same behaviour in Postman / Frontend / Prod
 * - Silent on reason, explicit on result
 */

import { validateAttempt } from "./validator.ts";

export const humanVerification = {
  /**
   * Validate a human verification attempt.
   *
   * @returns boolean
   *  - true  => verification passed
   *  - false => verification failed
   */
  async validate(
    req: Request,
    params: {
      attemptId: string;
      answer: number;
      endpoint?: "signup" | "recovery"; // backward compatibility
    }
  ): Promise<boolean> {
    try {
      // Single source of truth:
      // deterministic math + TTL
      return validateAttempt(req, {
        attemptId: params.attemptId,
        answer: params.answer,
      });
    } catch {
      // Absolute safety: any error = FAIL
      return false;
    }
  },
};
