// akunting-frontend/src/pages/Auth/Login.tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "react-toastify";
import axiosInstance from "@/api/axiosInstance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LogIn } from "lucide-react";
import { base64URLToBuffer, bufferToBase64URL } from "@/utils/webauthn";
import { useAppStore } from "@/store/useAppStore";
import { secureStorage } from "@/utils/secureStorage";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleBlockedDialogOpen, setRoleBlockedDialogOpen] = useState(false);
  const navigate = useNavigate();
  const [yubiLoading, setYubiLoading] = useState(false);
  const setUser = useAppStore((s) => s.setUser);

  const handleWebsiteRoleRestriction = (role?: string) => {
    if (role !== "user") return false;

    // Role "user" khusus aplikasi mobile, blokir akses ke web sejak proses login.
    secureStorage.removeItem("auth_token");
    secureStorage.removeItem("user_name");
    secureStorage.removeItem("user_role");
    setUser(null);
    setRoleBlockedDialogOpen(true);
    return true;
  };

  // -------------------------
  // Normal Login (password)
  // -------------------------
  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await axiosInstance.post("/auth/login", credentials);
      return response.data;
    },
    onSuccess: (data) => {
      const { token, user } = data;
      if (handleWebsiteRoleRestriction(user?.role)) return;
      // Simpan token & user
      secureStorage.setItem("auth_token", token);
      secureStorage.setItem("user_name", user.name);
      secureStorage.setItem("user_role", user.role);
      setUser({ name: user.name, email: user.email, role: user.role });
      toast.success("Login berhasil!");
      navigate("/dashboard");
    },
    onError: (error: any) => {
      const message =
        error.response?.data?.message ||
        "Login gagal. Periksa email dan password Anda.";
      toast.error(message);
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  // -------------------------
  // WebAuthn / YubiKey Login
  // -------------------------
  const handleYubiLogin = async () => {
    if (!email) {
      toast.error("Masukkan email/username terlebih dahulu");
      return;
    }

    setYubiLoading(true);

    try {
      // 1. Dapatkan challenge dari backend
      const challengeRes = await axiosInstance.post("/auth/login-challenge", {
        username: email,
      });

      const options = challengeRes.data;

      // Convert challenge dari base64url -> ArrayBuffer
      options.challenge = base64URLToBuffer(options.challenge);

      // Convert allowCredentials[].id
      if (options.allowCredentials) {
        options.allowCredentials = options.allowCredentials.map((cred: any) => ({
          ...cred,
          id: base64URLToBuffer(cred.id),
        }));
      }

      // 2. Browser request assertion dari YubiKey
      const assertion: any = await navigator.credentials.get({
        publicKey: { ...options },
      });

      const authResp: any = assertion.response;

      // 3. Convert buffers ke base64url untuk backend
      const credentialForServer = {
        id: assertion.id,
        rawId: bufferToBase64URL(assertion.rawId),
        type: assertion.type,
        response: {
          clientDataJSON: bufferToBase64URL(authResp.clientDataJSON),
          authenticatorData: bufferToBase64URL(authResp.authenticatorData),
          signature: bufferToBase64URL(authResp.signature),
          userHandle: authResp.userHandle
            ? bufferToBase64URL(authResp.userHandle)
            : null,
        },
      };

      // 4. Verify backend
      const verifyRes = await axiosInstance.post("/auth/login-verify", {
        credential: credentialForServer,
        username: email,
      });

      if (verifyRes.data.success) {
        // Simpan token & user (gunakan nama dari backend jika ada)
        const userName = verifyRes.data.user?.name || email;
        const userRole = verifyRes.data.user?.role || 'user';
        if (handleWebsiteRoleRestriction(userRole)) return;
        secureStorage.setItem("auth_token", "webauthn_dummy_token");
        secureStorage.setItem("user_name", userName);
        secureStorage.setItem("user_role", userRole);
        setUser({ name: userName, email, role: userRole });
        toast.success("Login YubiKey berhasil!");
        navigate("/dashboard");
      } else {
        toast.error("Login YubiKey gagal!");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Login YubiKey gagal");
    }

    setYubiLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-100 p-4 relative overflow-hidden">
      <Dialog open={roleBlockedDialogOpen} onOpenChange={setRoleBlockedDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Akses Web Tidak Diizinkan</DialogTitle>
            <DialogDescription>
              Akun dengan role <span className="font-semibold">user</span> hanya dapat login melalui aplikasi mobile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setRoleBlockedDialogOpen(false)} className="w-full sm:w-auto">
              Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      <div className="absolute top-0 right-0 -z-10">
        <div className="w-72 h-72 bg-gradient-to-bl from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl" />
      </div>
      <div className="absolute bottom-0 left-0 -z-10">
        <div className="w-96 h-96 bg-gradient-to-tr from-indigo-400/20 to-purple-600/20 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-6">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Welcome Back
          </CardTitle>
          <CardDescription className="text-center text-gray-600 text-base">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-3">
              <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                Email / Username
              </Label>
              <Input
                id="email"
                type="text"
                placeholder="Enter your email or username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="password" className="text-sm font-semibold text-gray-700">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-semibold rounded-lg transition-all duration-200"
              onClick={handleYubiLogin}
              disabled={yubiLoading}
            >
              {yubiLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
                  <span>Connecting...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">Y</span>
                  </div>
                  <span>Sign in with Security Key</span>
                </div>
              )}
            </Button>
          </form>

          <div className="text-center pt-4">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-blue-600 hover:text-blue-800 font-semibold hover:underline transition-colors duration-200"
              >
                Sign up here
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
