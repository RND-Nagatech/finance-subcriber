import Perusahaan from "./pages/MasterData/Perusahaan";
import Bank from './pages/MasterData/Bank';
import Rekening from './pages/MasterData/Rekening';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useQuery } from '@tanstack/react-query';
import { fetchActiveFiscalYear } from '@/api/fiscal';
import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { ProtectedRoute } from "./components/ProtectedRoute";
import { MainLayout } from "./components/MainLayout";
import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";
import Dashboard from "./pages/Dashboard";
import DashboardV2 from "./pages/DashboardV2";
import Kategori from "./pages/MasterData/Kategori";
import SubKategori from "./pages/MasterData/SubKategori";
import Akun from "./pages/MasterData/Akun";
import Program from "./pages/MasterData/Program";
import Subscriber from "./pages/Subscriber";
import CustomDashboard from "./pages/MasterData/CustomDashboard";
import Transaksi from "./pages/Transaksi";
import TutupBuku from "./pages/TutupBuku";
import NotFound from "./pages/NotFound";
import PublicDashboard from "./pages/public-dashboard";
import Budget from "./pages/Budget";
import BudgetUsage from "./pages/BudgetUsage";
import VPS from "./pages/VPS";
import Users from "./pages/Users";
import UpdateLog from "./pages/UpdateLog";
import RiwayatSaldoRekening from "./pages/RiwayatSaldoRekening";
import SaldoHarianRekening from "./pages/SaldoHarianRekening";
import SaldoHarianGenerator from "./pages/SaldoHarianGenerator";
import PerjalananDinas from "./pages/PerjalananDinas";
import PerjalananDinasTransaksi from "./pages/PerjalananDinasTransaksi";
import PerjalananDinasDana from "./pages/PerjalananDinasDana";
import PerjalananDinasAudit from "./pages/PerjalananDinasAudit";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ToastContainer position="top-right" autoClose={3000} />
      <FiscalYearInitializer />
      <BrowserRouter>
        <Routes>
                    <Route
                      path="/master/perusahaan"
                      element={
                        <ProtectedRoute>
                          <MainLayout>
                            <Perusahaan />
                          </MainLayout>
                        </ProtectedRoute>
                      }
                    />
                      <Route
                        path="/master/bank"
                        element={
                          <ProtectedRoute>
                            <MainLayout>
                              <Bank />
                            </MainLayout>
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/master/rekening"
                        element={
                          <ProtectedRoute>
                            <MainLayout>
                              <Rekening />
                            </MainLayout>
                          </ProtectedRoute>
                        }
                      />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route
            path="/dashboard-v2"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Dashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <DashboardV2 />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/master/kategori"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Kategori />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/master/subkategori"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SubKategori />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/master/akun"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Akun />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/master/program"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Program />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/subscriber"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Subscriber />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/vps"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <VPS />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Users />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/budget/budget"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Budget />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/budget/budget-usage"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <BudgetUsage />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/master/custom-dashboard"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <CustomDashboard />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/public-dashboard" element={<PublicDashboard />} />
          
          <Route
            path="/transaksi"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <Transaksi />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/perjalanan-dinas"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <PerjalananDinas />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/perjalanan-dinas/transaksi"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <PerjalananDinasTransaksi />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/perjalanan-dinas/dana"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <PerjalananDinasDana />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/perjalanan-dinas/audit"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <PerjalananDinasAudit />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/tutupbuku"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <TutupBuku />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/riwayat-saldo-rekening"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <RiwayatSaldoRekening />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/saldo-harian-rekening"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SaldoHarianRekening />
                </MainLayout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/saldo-harian-generator"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <SaldoHarianGenerator />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/update-log"
            element={
              <ProtectedRoute>
                <MainLayout>
                  <UpdateLog />
                </MainLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

function FiscalYearInitializer() {
  // This component runs early and ensures the global fiscal year
  // is aligned with server's active fiscal year.
  const setFiscalYear = useAppStore(s => s.setFiscalYear);
  const { data: activeYear } = useQuery({
    queryKey: ['fiscal-active'],
    queryFn: fetchActiveFiscalYear,
  });

  useEffect(() => {
    console.debug('[FiscalYearInitializer] fetched activeYear:', activeYear);
    if (activeYear) {
      console.debug('[FiscalYearInitializer] setting fiscalYear to', Number(activeYear));
      setFiscalYear(Number(activeYear));
    } else {
      console.debug('[FiscalYearInitializer] no activeYear returned from server');
    }
  }, [activeYear, setFiscalYear]);

  return null;
}
