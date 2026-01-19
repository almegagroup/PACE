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
 * - Stateless (Edge-safe)
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

type DecodedAttempt = {
  a: number;
  op: "+" | "-" | "*";
  b: number;
  issuedAt: number;
};

// ─────────────────────────────────────────
// Public API
// ─────────────────────────────────────────
export function validateAttempt(
  _req: Request,
  params: ValidateParams
): boolean {
  const { attemptId, answer } = params;

  // 1️⃣ Basic sanity
  if (!attemptId || typeof answer !== "number") {
    return false;
  }

  // 2️⃣ Decode attemptId
  const decoded = decodeAttemptId(attemptId);
  if (!decoded) {
    return false;
  }

  const { a, op, b, issuedAt } = decoded;

  // 3️⃣ Expiry check
  if (Date.now() - issuedAt > CHALLENGE_TTL_MS) {
    return false;
  }

  // 4️⃣ Compute expected answer
  let expected: number;

  switch (op) {
    case "+":
      expected = a + b;
      break;
    case "-":
      expected = a - b;
      break;
    case "*":
      expected = a * b;
      break;
    default:
      return false;
  }

  // 5️⃣ Final check
  return answer === expected;
}

// ─────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────
function decodeAttemptId(attemptId: string): DecodedAttempt | null {
  try {
    /**
     * attemptId format (opaque to frontend):
     * base64("a:op:b:timestamp")
     *
     * Example decoded string:
     * "8:*:7:1768391155048"
     */
    const raw = atob(attemptId);
    const parts = raw.split(":");

    if (parts.length !== 4) return null;

    const a = Number(parts[0]);
    const op = parts[1] as DecodedAttempt["op"];
    const b = Number(parts[2]);
    const issuedAt = Number(parts[3]);

    if (
      Number.isNaN(a) ||
      Number.isNaN(b) ||
      Number.isNaN(issuedAt)
    ) {
      return null;
    }

    if (!["+", "-", "*"].includes(op)) {
      return null;
    }

    return { a, op, b, issuedAt };
  } catch {
    return null;
  }
}
