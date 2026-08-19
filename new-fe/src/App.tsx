import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { MainLayout } from "@/components/MainLayout";
import { fetchActiveFiscalYear } from "@/api/fiscal";
import { useAppStore } from "@/store/useAppStore";

import Login from "@/pages/Auth/Login";
import Register from "@/pages/Auth/Register";
import SsoCallback from "@/pages/Auth/SsoCallback";
import SsoLogout from "@/pages/Auth/SsoLogout";
import Dashboard from "@/pages/SubscriberVpsDashboard";
import Bank from "@/pages/MasterData/Bank";
import Group from "@/pages/MasterData/Group";
import GroupProgram from "@/pages/MasterData/GroupProgram";
import Karyawan from "@/pages/MasterData/Karyawan";
import Perusahaan from "@/pages/MasterData/Perusahaan";
import Program from "@/pages/MasterData/Program";
import Rekening from "@/pages/MasterData/Rekening";
import Subscriber from "@/pages/Subscriber";
import Subscription from "@/pages/VPS";
import Users from "@/pages/Users";
import MaintenancePatch from "@/pages/MaintenancePatch";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedPage({ children }: { children: JSX.Element }) {
  return (
    <ProtectedRoute>
      <MainLayout>{children}</MainLayout>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ToastContainer position="top-right" autoClose={3000} />
      <FiscalYearInitializer />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/sso/callback" element={<SsoCallback />} />
          <Route path="/sso/logout" element={<SsoLogout />} />

          <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
          <Route path="/subscriber" element={<ProtectedPage><Subscriber key="subscriber" /></ProtectedPage>} />
          <Route path="/subscriber-outstand" element={<ProtectedPage><Subscriber key="subscriber-outstand" mode="outstand" /></ProtectedPage>} />
          <Route path="/subscription" element={<ProtectedPage><Subscription /></ProtectedPage>} />
          <Route path="/maintenance/patch" element={<ProtectedPage><MaintenancePatch /></ProtectedPage>} />
          <Route path="/master/group" element={<ProtectedPage><Group /></ProtectedPage>} />
          <Route path="/master/group-program" element={<ProtectedPage><GroupProgram /></ProtectedPage>} />
          <Route path="/master/karyawan" element={<ProtectedPage><Karyawan /></ProtectedPage>} />
          <Route path="/master/bank" element={<ProtectedPage><Bank /></ProtectedPage>} />
          <Route path="/master/perusahaan" element={<ProtectedPage><Perusahaan /></ProtectedPage>} />
          <Route path="/master/program" element={<ProtectedPage><Program /></ProtectedPage>} />
          <Route path="/master/rekening" element={<ProtectedPage><Rekening /></ProtectedPage>} />
          <Route path="/users" element={<ProtectedPage><Users /></ProtectedPage>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

function FiscalYearInitializer() {
  const setFiscalYear = useAppStore((state) => state.setFiscalYear);
  const { data: activeYear } = useQuery({
    queryKey: ["fiscal-active"],
    queryFn: fetchActiveFiscalYear,
  });

  useEffect(() => {
    if (activeYear) {
      setFiscalYear(Number(activeYear));
    }
  }, [activeYear, setFiscalYear]);

  return null;
}
