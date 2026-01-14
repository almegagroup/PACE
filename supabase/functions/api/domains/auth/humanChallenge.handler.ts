/**
 * File-ID: ID-4.1C-CHALLENGE
 * Gate: 4
 * Phase: 4
 * Domain: SECURITY
 * Tier: A
 * Status: FINAL
 *
 * PURPOSE
 * -------
 * Serve backend-generated human verification challenge.
 *
 * RULES
 * -----
 * - No auth required
 * - No DB access
 * - No answer exposure
 * - Postman & Frontend identical
 */

import { apiResponse, Action } from "../../utils/response.ts";
import { generateChallenge } from "../../utils/humanVerification/challenge.ts";

export async function humanChallengeHandler(): Promise<Response> {
  const challenge = generateChallenge();

  return apiResponse({
    status: "OK",
    code: "HUMAN_CHALLENGE",
    message: "Challenge issued",
    action: Action.NONE,
    data: challenge,
  });
}
