import { secureStorage } from "@/utils/secureStorage";

const PROGRAM_INTERNAL_URL = (import.meta.env.VITE_PROGRAM_INTERNAL_URL || "http://localhost:5173").replace(/\/$/, "");

export const programInternalLoginUrl = `${PROGRAM_INTERNAL_URL}/login`;

export function isProgramInternalSession() {
  return secureStorage.getItem("auth_source") === "program-internal";
}

export function getLoginFallbackUrl() {
  return isProgramInternalSession() ? programInternalLoginUrl : "/login";
}

export function redirectToLoginFallback() {
  window.location.href = getLoginFallbackUrl();
}
