import { useState, useEffect } from "react";
import { NavLink } from "@/components/NavLink";
import { useAppStore } from "@/store/useAppStore";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Database,
  Receipt,
  ChevronDown,
  LogOut,
  Wallet,
  Users,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AppSidebar() {
  const location = useLocation();
  const [isMasterOpen, setIsMasterOpen] = useState(false);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const { user, logout } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname.startsWith("/master")) {
      setIsMasterOpen(true);
    }
    if (location.pathname.startsWith("/budget")) {
      setIsBudgetOpen(true);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleLogoutClick = () => {
    setShowLogoutDialog(true);
  };

  const confirmLogout = () => {
    setShowLogoutDialog(false);
    handleLogout();
  };

  return (
    <SidebarProvider>
      <Sidebar
        className="
          bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900
          text-white
          border-r border-slate-700/50
          shadow-2xl
          backdrop-blur-xl
        "
      >
        {/* Subtle background pattern */}
        <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full blur-2xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-500/10 to-transparent rounded-full blur-2xl" />

        <SidebarContent className="gap-0 pt-8 relative z-10">

          {/* HEADER */}
          <SidebarHeader className="px-6">
            <div className="flex items-center gap-4">
              <div className="
                w-12 h-12 rounded-xl
                bg-gradient-to-br from-blue-500 to-indigo-600
                flex items-center justify-center
                shadow-lg shadow-blue-500/25
                ring-1 ring-white/10
              ">
                <Wallet className="w-6 h-6 text-white" />
              </div>

              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                  FinancePro
                </h1>
                <p className="text-xs text-slate-400 font-medium tracking-wide">Accounting System</p>
              </div>
            </div>

            {user && (
              <div className="
                mt-2 px-4 py-3
                rounded-xl
                bg-gradient-to-r from-slate-800/80 to-slate-700/80
                border border-slate-600/30
                shadow-inner
                backdrop-blur-sm
              ">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Active User</p>
                <p className="font-semibold text-white text-sm">{user.name}</p>
              </div>
            )}
          </SidebarHeader>

          {/* MENU GROUP */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-slate-400 text-xs uppercase tracking-wider font-semibold px-2 mb-4">
              Navigation
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-4">

                {/* DASHBOARD */}
                <SidebarMenuItem>
                  <NavLink to="/dashboard">
                    <SidebarMenuButton
                      isActive={location.pathname === "/dashboard"}
                      className={cn(
                        "group relative rounded-xl px-4 py-4 text-slate-300 hover:text-white transition-all duration-300",
                        "hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-indigo-600/20",
                        "hover:shadow-lg hover:shadow-blue-500/10",
                        "data-[active=true]:bg-gradient-to-r data-[active=true]:from-blue-600/30 data-[active=true]:to-indigo-600/30",
                        "data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-blue-500/20",
                        "border border-transparent data-[active=true]:border-blue-500/30",
                        "py-5"
                      )}
                    >
                      <LayoutDashboard className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                      <span className="font-medium">Dashboard</span>
                      {location.pathname === "/dashboard" && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-r-full" />
                      )}
                    </SidebarMenuButton>
                  </NavLink>
                </SidebarMenuItem>

                {/* MASTER DATA */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setIsMasterOpen(!isMasterOpen)}
                    className={cn(
                      "group relative rounded-xl px-4 py-4 text-slate-300 hover:text-white transition-all duration-300",
                      "hover:bg-gradient-to-r hover:from-slate-700/50 hover:to-slate-600/50",
                      "hover:shadow-lg hover:shadow-slate-500/10",
                       "py-5",
                      isMasterOpen && "bg-gradient-to-r from-slate-700/60 to-slate-600/60 text-white shadow-lg shadow-slate-500/20"
                    )}
                  >
                    <Database className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                    <span className="font-medium">Master Data</span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 ml-auto transition-all duration-300 group-hover:scale-110",
                        isMasterOpen && "rotate-180 text-blue-400"
                      )}
                    />
                  </SidebarMenuButton>

                  {isMasterOpen && (
                    <SidebarMenuSub className="ml-8 mt-3 space-y-2 animate-in slide-in-from-top-2 duration-300">
                      {[
                        { key: "kategori", label: "Kategori" },
                        { key: "subkategori", label: "Sub Kategori" },
                        { key: "akun", label: "Akun" },
                        { key: "program", label: "Program" },
                        { key: "perusahaan", label: "Master Perusahaan" },
                        { key: "bank", label: "Master Bank" },
                        { key: "rekening", label: "Master Rekening" },
                      ].map((item, index) => (
                        <SidebarMenuSubItem key={item.key}>
                          <NavLink to={`/master/${item.key}`}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={
                                location.pathname === `/master/${item.key}`
                              }
                              className={cn(
                                "group relative rounded-lg px-3 py-2 text-slate-400 hover:text-white transition-all duration-300",
                                "hover:bg-gradient-to-r hover:from-slate-600/40 hover:to-slate-500/40",
                                "hover:translate-x-1",
                                "data-[active=true]:bg-gradient-to-r data-[active=true]:from-blue-600/30 data-[active=true]:to-indigo-600/30",
                                "data-[active=true]:text-white data-[active=true]:shadow-md data-[active=true]:shadow-blue-500/20"
                              )}
                              style={{ animationDelay: `${index * 100}ms` }}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-current opacity-60 group-hover:opacity-100 transition-opacity" />
                                <span className="font-medium text-sm">{item.label}</span>
                                {location.pathname === `/master/${item.key}` && (
                                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-r-full" />
                                )}
                              </div>
                            </SidebarMenuSubButton>
                          </NavLink>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>

                {/* BUDGET */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setIsBudgetOpen(!isBudgetOpen)}
                    className={cn(
                      "group relative rounded-xl px-4 py-4 text-slate-300 hover:text-white transition-all duration-300",
                      "hover:bg-gradient-to-r hover:from-green-600/20 hover:to-emerald-600/20",
                      "hover:shadow-lg hover:shadow-green-500/10",
                       "py-5",
                      isBudgetOpen && "bg-gradient-to-r from-green-700/60 to-emerald-600/60 text-white shadow-lg shadow-green-500/20"
                    )}
                  >
                    <DollarSign className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                    <span className="font-medium">Budget Control</span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 ml-auto transition-all duration-300 group-hover:scale-110",
                        isBudgetOpen && "rotate-180 text-green-400"
                      )}
                    />
                  </SidebarMenuButton>

                  {isBudgetOpen && (
                    <SidebarMenuSub className="ml-8 mt-3 space-y-2 animate-in slide-in-from-top-2 duration-300">
                      {[
                        { key: "budget", label: "Master Budget" },
                        { key: "budget-usage", label: "Budget Usage" },
                      ].map((item, index) => (
                        <SidebarMenuSubItem key={item.key}>
                          <NavLink to={`/budget/${item.key}`}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={
                                location.pathname === `/budget/${item.key}`
                              }
                              className={cn(
                                "group relative rounded-lg px-3 py-3 text-slate-400 hover:text-white transition-all duration-300",
                                "hover:bg-gradient-to-r hover:from-green-600/40 hover:to-emerald-600/40",
                                "hover:translate-x-1",
                                "data-[active=true]:bg-gradient-to-r data-[active=true]:from-green-600/30 data-[active=true]:to-emerald-600/30",
                                "data-[active=true]:text-white data-[active=true]:shadow-md data-[active=true]:shadow-green-500/20",
                                 "py-5"
                              )}
                              style={{ animationDelay: `${index * 100}ms` }}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-current opacity-60 group-hover:opacity-100 transition-opacity" />
                                <span className="font-medium text-sm">{item.label}</span>
                                {location.pathname === `/budget/${item.key}` && (
                                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-gradient-to-b from-green-400 to-emerald-500 rounded-r-full" />
                                )}
                              </div>
                            </SidebarMenuSubButton>
                          </NavLink>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>

                {/* TRANSAKSI */}
                <SidebarMenuItem>
                  <NavLink to="/transaksi">
                    <SidebarMenuButton
                      isActive={location.pathname === "/transaksi"}
                      className={cn(
                        "group relative rounded-xl px-4 py-4 text-slate-300 hover:text-white transition-all duration-300",
                        "hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-indigo-600/20",
                        "hover:shadow-lg hover:shadow-blue-500/10",
                        "data-[active=true]:bg-gradient-to-r data-[active=true]:from-blue-600/30 data-[active=true]:to-indigo-600/30",
                        "data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-blue-500/20",
                        "border border-transparent data-[active=true]:border-blue-500/30",
                         "py-5"
                      )}
                    >
                      <Receipt className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                      <span className="font-medium">Transaksi</span>
                      {location.pathname === "/transaksi" && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-r-full" />
                      )}
                    </SidebarMenuButton>
                  </NavLink>
                </SidebarMenuItem>

                {/* SUBSCRIBER */}
                <SidebarMenuItem>
                  <NavLink to="/subscriber">
                    <SidebarMenuButton
                      isActive={location.pathname === "/subscriber"}
                      className={cn(
                        "group relative rounded-xl px-4 py-4 text-slate-300 hover:text-white transition-all duration-300",
                        "hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-indigo-600/20",
                        "hover:shadow-lg hover:shadow-blue-500/10",
                        "data-[active=true]:bg-gradient-to-r data-[active=true]:from-blue-600/30 data-[active=true]:to-indigo-600/30",
                        "data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-blue-500/20",
                        "border border-transparent data-[active=true]:border-blue-500/30",
                         "py-5"
                      )}
                    >
                      <Users className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                      <span className="font-medium">Subscriber</span>
                      {location.pathname === "/subscriber" && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-r-full" />
                      )}
                    </SidebarMenuButton>
                  </NavLink>
                </SidebarMenuItem>

                {/* VPS */}
                <SidebarMenuItem>
                  <NavLink to="/vps">
                    <SidebarMenuButton
                      isActive={location.pathname === "/vps"}
                      className={cn(
                        "group relative rounded-xl px-4 py-4 text-slate-300 hover:text-white transition-all duration-300",
                        "hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-indigo-600/20",
                        "hover:shadow-lg hover:shadow-blue-500/10",
                        "data-[active=true]:bg-gradient-to-r data-[active=true]:from-blue-600/30 data-[active=true]:to-indigo-600/30",
                        "data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-blue-500/20",
                        "border border-transparent data-[active=true]:border-blue-500/30",
                        "py-5"
                      )}
                    >
                      <Users className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                      <span className="font-medium">VPS</span>
                      {location.pathname === "/vps" && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-r-full" />
                      )}
                    </SidebarMenuButton>
                  </NavLink>
                </SidebarMenuItem>

                {/* USERS - Only for Super Admin */}
                {user?.role === 'superadmin' && (
                  <SidebarMenuItem>
                    <NavLink to="/users">
                      <SidebarMenuButton
                        isActive={location.pathname === "/users"}
                        className={cn(
                          "group relative rounded-xl px-4 py-4 text-slate-300 hover:text-white transition-all duration-300",
                          "hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-indigo-600/20",
                          "hover:shadow-lg hover:shadow-blue-500/10",
                          "data-[active=true]:bg-gradient-to-r data-[active=true]:from-blue-600/30 data-[active=true]:to-indigo-600/30",
                          "data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-blue-500/20",
                          "border border-transparent data-[active=true]:border-blue-500/30",
                          "py-5"
                        )}
                      >
                        <Users className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                        <span className="font-medium">Users</span>
                        {location.pathname === "/users" && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gradient-to-b from-blue-400 to-indigo-500 rounded-r-full" />
                        )}
                      </SidebarMenuButton>
                    </NavLink>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* FOOTER */}
          <div className="absolute bottom-0 left-0 w-full px-4 pb-6">
            <div className="h-px bg-gradient-to-r from-transparent via-slate-600/50 to-transparent mb-4" />
            <SidebarFooter>
              <SidebarMenu className="space-y-3">
                <SidebarMenuItem>
                  <NavLink to="/tutupbuku">
                    <SidebarMenuButton
                      className={cn(
                        "group rounded-xl px-4 py-4 text-slate-300 hover:text-white transition-all duration-300",
                        "hover:bg-gradient-to-r hover:from-slate-700/50 hover:to-slate-600/50",
                        "hover:shadow-lg hover:shadow-slate-500/10",
                        "py-5"
                      )}
                    >
                      <Database className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                      <span className="font-medium">Tutup Buku</span>
                    </SidebarMenuButton>
                  </NavLink>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
                    <AlertDialogTrigger asChild>
                      <SidebarMenuButton
                        className={cn(
                          "group rounded-xl px-4 py-4 text-slate-300 hover:text-red-300 transition-all duration-300",
                          "hover:bg-gradient-to-r hover:from-red-600/20 hover:to-red-700/20",
                          "hover:shadow-lg hover:shadow-red-500/10",
                          "py-5"
                        )}
                      >
                        <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                        <span className="font-medium">Logout</span>
                      </SidebarMenuButton>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-white/95 backdrop-blur-sm border-red-300 shadow-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent">
                          Konfirmasi Logout
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-600 text-base">
                          Apakah Anda yakin ingin keluar dari aplikasi? Anda akan diarahkan ke halaman login.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-3">
                        <AlertDialogCancel className="border-gray-300 hover:bg-gray-50 transition-all duration-200">
                          Batal
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={confirmLogout}
                          className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
                        >
                          Ya, Logout
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </div>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
