/**
 * ID: FRONT-PUBLIC-LAYOUT
 * Gate: Public Zone (Pre Gate-8)
 * Purpose: Shared layout for ALL public pages
 *
 * Pages using this layout:
 * - Splash
 * - Login
 * - Signup Request
 * - Forgot Password
 * - Forgot Passcode
 *
 * Rules:
 * ❌ No auth logic
 * ❌ No API calls
 * ❌ No state / hooks
 * ❌ No AppShell / Menu / Keyboard
 *
 * ✅ Pure visual + content slot
 * ✅ Stable, reusable, frozen foundation
 */

import spImage from "../../assets/brand/sp.png";

export default function PublicLayout({ children }) {
  return (
    <div className="min-h-screen flex bg-bg-base text-text-primary">
      {/* =====================================================
         LEFT PANEL — BRAND / VISUAL (Hidden on mobile)
         ===================================================== */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden">
        {/* Base background */}
        <div className="absolute inset-0 bg-bg-raised" />

        {/* Subtle bronze grid */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(208,140,58,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(208,140,58,0.22) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        {/* Brand Image */}
        <img
          src={spImage}
          alt="PACE ERP"
          className="relative z-10 w-full h-full object-cover"
          draggable="false"
        />

        {/* Dark vignette for authority feel */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-transparent to-black/70" />
      </div>

      {/* =====================================================
         RIGHT PANEL — CONTENT SLOT
         ===================================================== */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
