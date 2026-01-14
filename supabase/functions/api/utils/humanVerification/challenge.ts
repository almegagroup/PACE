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
 * Generate backend-only human verification challenge.
 *
 * RULES (LOCKED)
 * --------------
 * - No DB write
 * - No answer storage
 * - Frontend gets question + attemptId only
 * - attemptId is opaque
 */

type Challenge = {
  question: string;
  attemptId: string;
};

// ─────────────────────────────────────────
// Config (Gate-4 locked)
// ─────────────────────────────────────────
const MIN = 3;
const MAX = 9;

// ─────────────────────────────────────────
// Public API
// ─────────────────────────────────────────
export function generateChallenge(): Challenge {
  const a = randomInt(MIN, MAX);
  const b = randomInt(MIN, MAX);
  const issuedAt = Date.now();

  /**
   * attemptId format (opaque):
   * base64("a:b:timestamp")
   */
  const raw = `${a}:${b}:${issuedAt}`;
  const attemptId = btoa(raw);

  return {
    question: `${a} + ${b} = ?`,
    attemptId,
  };
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
