/**
 * PACE ERP — Frontend Runtime Authority (SSOT)
 * Scope:
 *  - Splash lifecycle
 *  - Public pages readiness
 *  - Browser capability checks
 *
 * NOTE:
 *  - No routing
 *  - No UI logic
 *  - No backend calls
 */

/* ===== Environment Checks ===== */

export const isBrowser =
  typeof window !== "undefined" &&
  typeof document !== "undefined";

export const isNavigator =
  typeof navigator !== "undefined";

/* ===== Runtime State ===== */

export const Runtime = {
  status: "BOOTING", // BOOTING | READY
};

/**
 * Mark frontend runtime as READY
 * Only SplashScreen is allowed to call this
 */
export function markRuntimeReady() {
  Runtime.status = "READY";
}

/**
 * Check if runtime is ready
 */
export function isRuntimeReady() {
  return Runtime.status === "READY";
}
