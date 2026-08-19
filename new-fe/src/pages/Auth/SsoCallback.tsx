import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { secureStorage } from "@/utils/secureStorage";

type PortalPayload = {
  username?: string;
  name?: string;
  role?: string;
  iss?: string;
  exp?: number;
};

function decodeJwtPayload(token: string): PortalPayload {
  const payload = token.split(".")[1];
  if (!payload) return {};

  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return JSON.parse(atob(padded));
}

export default function SsoCallback() {
  const setUser = useAppStore((state) => state.setUser);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const token = params.get("token");
      const redirect = params.get("redirect") || "/dashboard";

      if (!token) {
        setError("Token SSO tidak ditemukan.");
        return;
      }

      const payload = decodeJwtPayload(token);
      if (payload.iss !== "program-internal") {
        setError("Token SSO tidak valid.");
        return;
      }

      if (payload.exp && payload.exp * 1000 < Date.now()) {
        setError("Token SSO sudah kedaluwarsa.");
        return;
      }

      secureStorage.setItem("auth_token", token);
      secureStorage.setItem("user_name", payload.name || payload.username || "Internal User");
      secureStorage.setItem("user_role", payload.role || "user");
      secureStorage.setItem("auth_source", "program-internal");
      setUser({
        name: payload.name || payload.username || "Internal User",
        email: payload.username || "",
        role: payload.role || "user",
      });
      setRedirectTo(redirect.startsWith("/") ? redirect : "/dashboard");
    } catch {
      setError("Gagal memproses token SSO.");
    }
  }, [setUser]);

  if (redirectTo) return <Navigate to={redirectTo} replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-lg">
        <h1 className="text-xl font-semibold text-slate-900">Single Sign-On</h1>
        <p className="mt-2 text-slate-600">{error || "Menghubungkan sesi dari Program Internal..."}</p>
        {error && (
          <a className="mt-5 inline-block rounded-md bg-blue-600 px-4 py-2 font-semibold text-white" href="/login">
            Kembali ke login
          </a>
        )}
      </div>
    </div>
  );
}
