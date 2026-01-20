/**
 * ID: FRONT-PUBLIC-LOGIN (FINAL)
 * Zone: Public (Pre Gate-8)
 * Authority: Backend (SSOT)
 *
 * RULES:
 * - Request payload MUST match backend contract
 * - Success determined ONLY by `status === "OK"`
 * - Navigation driven ONLY by `action`
 * - No frontend assumptions
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import BaseInput from "../../components/ui/BaseInput";
import BaseButton from "../../components/ui/BaseButton";
import FormError from "../../components/ui/FormError";

export default function LoginPage() {
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    let data;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            identifier: identifier.trim(),
            password,
          }),
        }
      );

      try {
        data = await res.json();
      } catch {
        setError("Invalid server response");
        return;
      }

      // 🔐 Backend is the only authority
      if (data?.status !== "OK") {
        setError(data?.message || "Login failed");
        return;
      }

      // 🧭 Navigation strictly by backend action
      switch (data.action) {
        case "NONE":
          navigate("/app", { replace: true });
          break;

        case "FIRST_LOGIN":
          navigate("/auth/first-login", { replace: true });
          break;

        case "WAIT_FOR_ACCESS":
          setError("Access pending approval");
          break;

        default:
          setError("Account access denied");
      }
    } catch {
      setError("System unavailable. Try again later.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base px-6">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-border-subtle bg-bg-raised p-8 shadow-lg">
          <h1 className="text-3xl font-semibold text-text-primary">
            PACE ERP Login
          </h1>
          <p className="mt-2 text-base text-text-muted">
            Authorized enterprise access only
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-6">
            <BaseInput
              label="ERP User ID"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
              autoFocus
            />

            <BaseInput
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />

            {error && <FormError>{error}</FormError>}

            <BaseButton
              type="submit"
              loading={loading}
              disabled={!identifier || !password}
              full
            >
              Sign In
            </BaseButton>
          </form>

          <div className="mt-8 border-t border-border-subtle pt-6 space-y-3 text-sm">
            <Link
              to="/auth/forgot-password"
              className="block text-text-muted hover:text-bronze-400"
            >
              Forgot password
            </Link>

            <Link
              to="/auth/forgot-passcode"
              className="block text-text-muted hover:text-bronze-400"
            >
              Forgot passcode
            </Link>

            <Link
              to="/auth/first-login"
              className="block text-text-muted hover:text-bronze-400"
            >
              First time login
            </Link>

            <Link
              to="/auth/signup-request"
              className="block text-text-muted hover:text-bronze-400"
            >
              Request access
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">
          PACE ERP • Authorized Enterprise System
        </p>
      </div>
    </div>
  );
}
