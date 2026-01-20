import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { markRuntimeReady } from "../utils/runtime";
import logoMark from "../assets/brand/logo-mark.png";

/* ===== STATIC CONFIG (ERP SAFE) ===== */
const LOADING_STAGES = [
  { threshold: 0, text: "Initializing system..." },
  { threshold: 20, text: "Loading core modules..." },
  { threshold: 45, text: "Establishing connections..." },
  { threshold: 70, text: "Preparing interface..." },
  { threshold: 90, text: "Ready" },
];

const BOOT_DURATION_MS = 4000;
const INTERVAL_MS = 50;

const SplashScreen = () => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
 

  // Progress engine (deterministic)
 useEffect(() => {
  const step = 100 / (BOOT_DURATION_MS / INTERVAL_MS);

  const timer = setInterval(() => {
    setProgress((p) => {
      const next = p + step;

      if (next >= 100) {
        markRuntimeReady();   // ✅ এখানেই
        return 100;
      }

      return next;
    });
  }, INTERVAL_MS);

  return () => clearInterval(timer);
}, []);

  // Stage text resolver (deterministic)
  const stageText =
  [...LOADING_STAGES]
    .reverse()
    .find((s) => progress >= s.threshold)?.text
  ?? LOADING_STAGES[0].text;

  // Auto-navigate to Login when done (Public Zone allowed)
  useEffect(() => {
    if (progress >= 100) {
      const t = setTimeout(() => navigate("/login", { replace: true }), 150);
      return () => clearTimeout(t);
    }
  }, [progress, navigate]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        background: "radial-gradient(ellipse at center, #1c1c1c 0%, #070707 70%)",
        color: "#e6e6e6",
      }}
    >
      {/* Subtle bronze grid (theme match) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.06,
          backgroundImage:
            "linear-gradient(rgba(208,140,58,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(208,140,58,0.22) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          pointerEvents: "none",
        }}
      />

      {/* Top bronze line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(208,140,58,0.9), transparent)",
          opacity: 0.9,
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
        {/* REAL LOGO */}
        <img
          src={logoMark}
          alt="PACE ERP"
          style={{
            width: 120,
            height: 120,
            objectFit: "contain",
            marginBottom: 18,
            filter: "drop-shadow(0 0 18px rgba(208,140,58,0.25))",
          }}
        />

        {/* BRAND */}
        <div style={{ fontSize: 28, letterSpacing: "0.32em", fontWeight: 500, marginBottom: 6 }}>
          PACE ERP
        </div>

        <div style={{ fontSize: 12, letterSpacing: "0.18em", opacity: 0.72, marginBottom: 44 }}>
          Process Automation &amp; Control Environment
        </div>

        {/* PROGRESS BAR */}
        <div
          style={{
            width: 340,
            height: 4,
            background: "#1f2937",
            borderRadius: 4,
            overflow: "hidden",
            marginBottom: 10,
            position: "relative",
          }}
        >
          {/* soft shimmer */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(90deg, transparent, rgba(208,140,58,0.18), transparent)",
              opacity: 0.7,
            }}
          />
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: "linear-gradient(90deg, #7a4b22, #d08c3a, #f3c27a)",
              transition: "width 0.05s linear",
              position: "relative",
              zIndex: 2,
            }}
          />
        </div>

        {/* STATUS LINE */}
        <div
          style={{
            width: 340,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            letterSpacing: "0.12em",
            opacity: 0.75,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
          <span>{stageText}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      {/* FOOTER */}
      <div
        style={{
          position: "absolute",
          bottom: 26,
          fontSize: 10,
          letterSpacing: "0.28em",
          opacity: 0.35,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        }}
      >
        v1.0 • Enterprise Edition
      </div>
    </div>
  );
};

export default SplashScreen;
