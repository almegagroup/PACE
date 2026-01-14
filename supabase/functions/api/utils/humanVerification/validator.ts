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
 * Validate human-verification answer deterministically.
 *
 * CORE IDEAS
 * ---------
 * - Backend can recompute expected answer
 * - Frontend never knows expected answer
 * - No answer stored anywhere
 * - Same logic for Postman / Frontend / Prod
 *
 * CONTRACT
 * --------
 * If ANY check fails → return false
 */

type ValidateParams = {
  attemptId: string;
  answer: number;
};

// ─────────────────────────────────────────
// Config (Gate-4 locked)
// ─────────────────────────────────────────
const CHALLENGE_TTL_MS = 2 * 60 * 1000; // 2 minutes

// ─────────────────────────────────────────
// Public API
// ─────────────────────────────────────────
export function validateAttempt(
  req: Request,
  params: ValidateParams
): boolean {
  const { attemptId, answer } = params;

  // Basic sanity
  if (!attemptId || typeof answer !== "number") {
    return false;
  }

  // Decode attemptId
  const decoded = decodeAttemptId(attemptId);
  if (!decoded) {
    return false;
  }

  const { a, b, issuedAt } = decoded;

  // Expiry check
  if (Date.now() - issuedAt > CHALLENGE_TTL_MS) {
    return false;
  }

  // Compute expected answer
  const expected = a + b;

  // Final check
  if (answer !== expected) {
    return false;
  }

  return true;
}

// ─────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────

function decodeAttemptId(
  attemptId: string
): { a: number; b: number; issuedAt: number } | null {
  try {
    /**
     * attemptId format (opaque to frontend):
     * base64("a:b:timestamp")
     *
     * Example decoded string:
     * "7:5:1690000000000"
     */
    const raw = atob(attemptId);
    const parts = raw.split(":");

    if (parts.length !== 3) return null;

    const a = Number(parts[0]);
    const b = Number(parts[1]);
    const issuedAt = Number(parts[2]);

    if (
      Number.isNaN(a) ||
      Number.isNaN(b) ||
      Number.isNaN(issuedAt)
    ) {
      return null;
    }

    return { a, b, issuedAt };
  } catch {
    return null;
  }
}
