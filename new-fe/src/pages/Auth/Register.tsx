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
import { UserPlus } from "lucide-react";
import {
  base64URLToBuffer,
  bufferToBase64URL,
} from "@/utils/webauthn";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const [yubiLoading, setYubiLoading] = useState(false);

  // Normal Registration
  const registerMutation = useMutation({
    mutationFn: async (userData: {
      name: string;
      email: string;
      password: string;
    }) => {
      const response = await axiosInstance.post("/auth/register", userData);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Registrasi berhasil! Silakan login.");
      navigate("/login");
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.message || "Registrasi gagal. Silakan coba lagi."
      );
    },
  });

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate({ name, email, password });
  };

  // -------------------------------------
  // WEBAUTHN / YUBIKEY REGISTRATION
  // -------------------------------------

  const handleYubiRegister = async () => {
    if (!name || !email || !password) {
      toast.error("Isi semua data terlebih dahulu");
      return;
    }

    setYubiLoading(true);

    try {
      // 1. Ask backend to create user & challenge
      const challengeRes = await axiosInstance.post("/auth/register-challenge", {
        username: email,
        name,
        password,
      });

      const options = challengeRes.data;

      // Convert challenge from base64url to ArrayBuffer
      options.challenge = base64URLToBuffer(options.challenge);

      // Convert user.id
      if (options.user && options.user.id) {
        options.user.id = base64URLToBuffer(options.user.id);
      }

      // Convert excludeCredentials[].id
      if (options.excludeCredentials) {
        options.excludeCredentials = options.excludeCredentials.map(
          (cred: any) => ({
            ...cred,
            id: base64URLToBuffer(cred.id),
          })
        );
      }

      // 2. Browser creates credential using YubiKey
      const credential: any = await navigator.credentials.create({
        publicKey: options,
      });

      const attResp: any = credential.response;

      // 3. Convert to base64url for backend
      const credentialForServer = {
        id: credential.id,
        rawId: bufferToBase64URL(credential.rawId),
        type: credential.type,
        response: {
          clientDataJSON: bufferToBase64URL(attResp.clientDataJSON),
          attestationObject: bufferToBase64URL(attResp.attestationObject),
        },
      };

      // 4. Verify with backend
      const verifyRes = await axiosInstance.post("/auth/register-verify", {
        credential: credentialForServer,
        username: email,
      });

      if (verifyRes.data.success) {
        toast.success("Registrasi YubiKey berhasil! Silakan login.");
        navigate("/login");
      } else {
        toast.error("Registrasi YubiKey gagal.");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Registrasi YubiKey gagal");
    }

    setYubiLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-100 p-4 relative overflow-hidden">
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
              <UserPlus className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Create Account
          </CardTitle>
          <CardDescription className="text-center text-gray-600 text-base">
            Join us and start managing your finances
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-3">
              <Label htmlFor="name" className="text-sm font-semibold text-gray-700">
                Full Name
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="email" className="text-sm font-semibold text-gray-700">
                Email / Username
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
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
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating account...</span>
                </div>
              ) : (
                "Create Account"
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
              onClick={handleYubiRegister}
              disabled={yubiLoading}
            >
              {yubiLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin" />
                  <span>Registering...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">Y</span>
                  </div>
                  <span>Register with Security Key</span>
                </div>
              )}
            </Button>
          </form>

          <div className="text-center pt-4">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link
                to="/login"
                className="text-blue-600 hover:text-blue-800 font-semibold hover:underline transition-colors duration-200"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
