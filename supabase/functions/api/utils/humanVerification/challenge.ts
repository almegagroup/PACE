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
 * - Stateless (Edge-safe)
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

type Operator = "+" | "-" | "*";
const OPERATORS: Operator[] = ["+", "-", "*"];

// ─────────────────────────────────────────
// Public API
// ─────────────────────────────────────────
export function generateChallenge(): Challenge {
  const a = randomInt(MIN, MAX);
  const b = randomInt(MIN, MAX);
  const op = OPERATORS[randomInt(0, OPERATORS.length - 1)];
  const issuedAt = Date.now();

  /**
   * attemptId format (opaque):
   * base64("a:op:b:timestamp")
   */
  const raw = `${a}:${op}:${b}:${issuedAt}`;
  const attemptId = btoa(raw);

  return {
    question: `${a} ${op} ${b} = ?`,
    attemptId,
  };
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
