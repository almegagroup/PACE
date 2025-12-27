/*
 * File-ID: ID-9B
 * File-Path: supabase/functions/api/utils/sessionAction.ts
 * Gate: 1
 * Phase: 1
 * Domain: SECURITY
 * Purpose: Enforce SESSION_* → LOGOUT action rule
 * Authority: Backend
 */

import type { ActionType } from "./response.ts";

export function enforceSessionAction(
  code: string,
  currentAction: ActionType
): ActionType {
  if (code.startsWith("SESSION_")) {
    return "LOGOUT";
  }
  return currentAction;
}
