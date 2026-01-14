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
 * - Same behaviour in Postman / Frontend / Prod
 * - Silent on reason, explicit on result
 */

import { validateAttempt } from "./validator.ts";
import { trackAttempt } from "./tracker.ts";

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
      endpoint: "signup" | "recovery";
    }
  ): Promise<boolean> {
    try {
      // 1️⃣ Track attempt pattern (rate / retry / timing)
      const allowed = trackAttempt(req, params.endpoint);
      if (!allowed) {
        return false;
      }

      // 2️⃣ Validate answer & timing
      const result = validateAttempt(req, {
        attemptId: params.attemptId,
        answer: params.answer,
      });

      return result === true;
    } catch {
      // Absolute safety: any error = FAIL
      return false;
    }
  },
};
