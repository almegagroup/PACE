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
 * Track human-verification attempt patterns.
 *
 * WHAT THIS FILE DOES
 * -------------------
 * - Counts attempts per IP + endpoint
 * - Applies soft delay + hard block
 * - Detects suspicious fast retries
 *
 * WHAT THIS FILE NEVER DOES
 * -------------------------
 * - Knows the question
 * - Knows the answer
 * - Writes to DB
 * - Talks to frontend
 */

type AttemptRecord = {
  count: number;
  lastAttemptAt: number;
};

const attemptStore = new Map<string, AttemptRecord>();

// ─────────────────────────────────────────
// Config (Gate-4 locked)
// ─────────────────────────────────────────
const MAX_ATTEMPTS = 7;
const SOFT_LIMIT = 3;
const MIN_HUMAN_DELAY_MS = 300;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
function getClientKey(req: Request, endpoint: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "UNKNOWN";

  return `${endpoint}:${ip}`;
}

// ─────────────────────────────────────────
// Public API
// ─────────────────────────────────────────
export function trackAttempt(
  req: Request,
  endpoint: "signup" | "recovery"
): boolean {
  const key = getClientKey(req, endpoint);
  const now = Date.now();

  const record = attemptStore.get(key);

  // First attempt
  if (!record || now - record.lastAttemptAt > WINDOW_MS) {
    attemptStore.set(key, {
      count: 1,
      lastAttemptAt: now,
    });
    return true;
  }

  // Timing heuristic
  const delta = now - record.lastAttemptAt;
  record.lastAttemptAt = now;
  record.count += 1;

  // Suspicious fast retry
  if (delta < MIN_HUMAN_DELAY_MS) {
    return false;
  }

  // Hard block
  if (record.count >= MAX_ATTEMPTS) {
    return false;
  }

  // Soft zone (allowed, but watched)
  if (record.count > SOFT_LIMIT) {
    // Allowed, but next layers may fail
    return true;
  }

  return true;
}
