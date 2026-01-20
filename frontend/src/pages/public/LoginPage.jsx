/**
 * ID: FRONT-PUBLIC-LOGIN
 * Zone: Public (Pre Gate-8)
 * Purpose: ERP Login – Production Ready
 *
 * Backend-driven
 * UI + Router only
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import BaseInput from "../../components/ui/BaseInput";
import BaseButton from "../../components/ui/BaseButton";
import FormError from "../../components/ui/FormError";

export default function LoginPage() {
  const navigate = useNavigate();

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            user_id: userId.trim(),
            password,
          }),
        }
      );

      const data = await res.json();

      if (!data?.success) {
        setError(data?.message || "Login failed");
        setLoading(false);
        return;
      }

      switch (data.status) {
        case "ACTIVE":
          navigate("/app", { replace: true });
          break;

        case "FIRST_LOGIN_REQUIRED":
          navigate("/auth/first-login", { replace: true });
          break;

        case "RESET_REQUIRED":
          navigate("/auth/forgot-password", { replace: true });
          break;

        case "PASSCODE_REQUIRED":
          navigate("/auth/forgot-passcode", { replace: true });
          break;

        case "SIGNUP_REQUIRED":
        case "NOT_FOUND":
          navigate("/auth/signup-request", { replace: true });
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
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
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
              disabled={!userId || !password}
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
