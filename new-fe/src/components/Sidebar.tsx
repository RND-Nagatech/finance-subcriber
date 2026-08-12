import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import axiosInstance from "@/api/axiosInstance";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/NavLink";
import { useAppStore } from "@/store/useAppStore";
import { ChevronDown, CreditCard, Database, KeyRound, LayoutDashboard, LogOut, Server, UserRoundCheck, Users, Wallet } from "lucide-react";
import { toast } from "react-toastify";

export default function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAppStore();
  const [isMasterOpen, setIsMasterOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    if (location.pathname.startsWith("/master")) {
      setIsMasterOpen(true);
    }
  }, [location.pathname]);

  const confirmLogout = () => {
    setShowLogoutDialog(false);
    logout();
    navigate("/login");
  };

  const handleChangePassword = async () => {
    if (!passwordForm.old_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      toast.error("Semua field password wajib diisi.");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("Konfirmasi password baru tidak cocok.");
      return;
    }

    setChangingPassword(true);
    try {
      const response = await axiosInstance.put("/users/change-password", passwordForm);
      toast.success(response?.data?.message || "Password berhasil diubah.");
      setPasswordForm({ old_password: "", new_password: "", confirm_password: "" });
      setChangePasswordOpen(false);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Gagal mengubah password.");
    } finally {
      setChangingPassword(false);
    }
  };

  const menuButtonClass = (activeColor = "blue") => cn(
    "group relative rounded-xl px-4 py-5 text-slate-300 hover:text-white transition-all duration-300",
    activeColor === "emerald"
      ? "hover:bg-gradient-to-r hover:from-emerald-600/20 hover:to-teal-600/20 data-[active=true]:from-emerald-600/30 data-[active=true]:to-teal-600/30 data-[active=true]:border-emerald-500/30"
      : "hover:bg-gradient-to-r hover:from-blue-600/20 hover:to-indigo-600/20 data-[active=true]:from-blue-600/30 data-[active=true]:to-indigo-600/30 data-[active=true]:border-blue-500/30",
    "hover:shadow-lg data-[active=true]:bg-gradient-to-r data-[active=true]:text-white data-[active=true]:shadow-lg border border-transparent"
  );

  return (
    <SidebarProvider>
      <Sidebar className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white border-r border-slate-700/50 shadow-2xl">
        <SidebarContent className="gap-0 pt-8 relative z-10">
          <SidebarHeader className="px-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 ring-1 ring-white/10">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                  Subscriber Subscription
                </h1>
                <p className="text-xs text-slate-400 font-medium tracking-wide">
                  Management v{import.meta.env.VITE_APP_VERSION || "1.0.0"}
                </p>
              </div>
            </div>

            {user && (
              <div className="mt-2 px-4 py-3 rounded-xl bg-gradient-to-r from-slate-800/80 to-slate-700/80 border border-slate-600/30 shadow-inner">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Active User</p>
                    <p className="font-semibold text-white text-sm">{user.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setChangePasswordOpen(true)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-600/70 bg-slate-700/70 text-slate-200 hover:text-white hover:bg-slate-600 transition-colors"
                    title="Ganti Password"
                    aria-label="Ganti Password"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </SidebarHeader>

          <SidebarGroup>
            <SidebarGroupLabel className="text-slate-400 text-xs uppercase tracking-wider font-semibold px-2 mb-4">
              Navigation
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-4">
                <SidebarMenuItem>
                  <NavLink to="/dashboard">
                    <SidebarMenuButton isActive={location.pathname === "/dashboard"} className={menuButtonClass()}>
                      <LayoutDashboard className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                      <span className="font-medium">Dashboard</span>
                    </SidebarMenuButton>
                  </NavLink>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setIsMasterOpen(!isMasterOpen)}
                    className={cn(menuButtonClass(), isMasterOpen && "bg-gradient-to-r from-slate-700/60 to-slate-600/60 text-white")}
                  >
                    <Database className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                    <span className="font-medium">Master Data</span>
                    <ChevronDown className={cn("w-4 h-4 ml-auto transition-all duration-300", isMasterOpen && "rotate-180 text-blue-400")} />
                  </SidebarMenuButton>

                  {isMasterOpen && (
                    <SidebarMenuSub className="ml-8 mt-3 space-y-2 animate-in slide-in-from-top-2 duration-300">
                      {[
                        { path: "/master/group", label: "Group Toko", icon: UserRoundCheck },
                        { path: "/master/group-program", label: "Group Program", icon: Database },
                        { path: "/master/program", label: "Program", icon: Database },
                        { path: "/master/perusahaan", label: "Perusahaan", icon: Database },
                        { path: "/master/bank", label: "Bank", icon: CreditCard },
                        { path: "/master/rekening", label: "Rekening", icon: CreditCard },
                      ].map((item) => (
                        <SidebarMenuSubItem key={item.path}>
                          <NavLink to={item.path}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={location.pathname === item.path}
                              className="group relative rounded-lg px-3 py-2 text-slate-400 hover:text-white transition-all duration-300 hover:bg-gradient-to-r hover:from-slate-600/40 hover:to-slate-500/40 hover:translate-x-1 data-[active=true]:bg-gradient-to-r data-[active=true]:from-blue-600/30 data-[active=true]:to-indigo-600/30 data-[active=true]:text-white"
                            >
                              <div className="flex items-center gap-2">
                                <item.icon className="h-4 w-4" />
                                <span className="font-medium text-sm">{item.label}</span>
                              </div>
                            </SidebarMenuSubButton>
                          </NavLink>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <NavLink to="/subscriber-outstand">
                    <SidebarMenuButton isActive={location.pathname === "/subscriber-outstand"} className={menuButtonClass()}>
                      <UserRoundCheck className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                      <span className="font-medium">Subscriber Outstand</span>
                    </SidebarMenuButton>
                  </NavLink>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <NavLink to="/subscriber">
                    <SidebarMenuButton isActive={location.pathname === "/subscriber"} className={menuButtonClass()}>
                      <Users className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                      <span className="font-medium">Subscriber</span>
                    </SidebarMenuButton>
                  </NavLink>
                </SidebarMenuItem>

                <SidebarMenuItem>
                  <NavLink to="/subscription">
                    <SidebarMenuButton isActive={location.pathname === "/subscription"} className={menuButtonClass("emerald")}>
                      <Server className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                      <span className="font-medium">Subscription</span>
                    </SidebarMenuButton>
                  </NavLink>
                </SidebarMenuItem>

                {user?.role === "superuser" && (
                  <SidebarMenuItem>
                    <NavLink to="/users">
                      <SidebarMenuButton isActive={location.pathname === "/users"} className={menuButtonClass()}>
                        <Users className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                        <span className="font-medium">Users</span>
                      </SidebarMenuButton>
                    </NavLink>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <div className="mt-auto w-full px-4 pb-6 pt-4 relative z-10">
            <div className="h-px bg-gradient-to-r from-transparent via-slate-600/50 to-transparent mb-4" />
            <SidebarFooter>
              <SidebarMenu className="space-y-3">
                <SidebarMenuItem>
                  <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
                    <AlertDialogTrigger asChild>
                      <SidebarMenuButton className="group rounded-xl px-4 py-5 text-slate-300 hover:text-red-300 transition-all duration-300 hover:bg-gradient-to-r hover:from-red-600/20 hover:to-red-700/20">
                        <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
                        <span className="font-medium">Logout</span>
                      </SidebarMenuButton>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-white/95 backdrop-blur-sm border-red-300 shadow-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Konfirmasi Logout</AlertDialogTitle>
                        <AlertDialogDescription>
                          Apakah Anda yakin ingin keluar dari aplikasi? Anda akan diarahkan ke halaman login.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-3">
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmLogout} className="bg-red-600 hover:bg-red-700">
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

        <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Ganti Password</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="old-password">Password Lama</Label>
                <Input
                  id="old-password"
                  type="password"
                  value={passwordForm.old_password}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, old_password: event.target.value }))}
                  placeholder="Masukkan password lama"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-password">Password Baru</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, new_password: event.target.value }))}
                  placeholder="Masukkan password baru"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm-password">Konfirmasi Password Baru</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirm_password: event.target.value }))}
                  placeholder="Ulangi password baru"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setChangePasswordOpen(false)} disabled={changingPassword}>
                  Batal
                </Button>
                <Button type="button" onClick={handleChangePassword} disabled={changingPassword}>
                  {changingPassword ? "Menyimpan..." : "Simpan Password"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </Sidebar>
    </SidebarProvider>
  );
}
