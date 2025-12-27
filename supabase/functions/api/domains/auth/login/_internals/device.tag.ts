// ============================================================================
// Gate-3.5 :: Device Tag Generator (SOFT)
// File: device.tag.ts
// Purpose: Generate non-PII device fingerprint for session
// ============================================================================

export function generateDeviceTag(req: Request): string {
  const ua = req.headers.get("user-agent") ?? "unknown";
  const platform =
    req.headers.get("sec-ch-ua-platform") ??
    req.headers.get("x-platform") ??
    "unknown";

  const raw = `${ua}::${platform}`;

  // lightweight hash (non-crypto, non-PII)
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }

  return `DT:${Math.abs(hash)}`;
}
