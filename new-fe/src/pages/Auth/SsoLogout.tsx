import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { secureStorage } from "@/utils/secureStorage";

export default function SsoLogout() {
  const setUser = useAppStore((state) => state.setUser);

  useEffect(() => {
    secureStorage.removeItem("auth_token");
    secureStorage.removeItem("user_name");
    secureStorage.removeItem("user_role");
    secureStorage.removeItem("auth_source");
    setUser(null);
    window.close();
  }, [setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center shadow-lg">
        <h1 className="text-xl font-semibold text-slate-900">Logout Program Internal</h1>
        <p className="mt-2 text-slate-600">Sesi aplikasi sedang diakhiri...</p>
      </div>
    </div>
  );
}
