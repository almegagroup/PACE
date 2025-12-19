import { ENV } from './env';

// Canonical web origin (no path)
export const CANONICAL_ORIGIN = ENV.API_BASE;

// Hard assertion — mismatch হলে boot-এই crash
if (!CANONICAL_ORIGIN.startsWith('https://')) {
  throw new Error('[DOMAIN] API base must be https');
}
