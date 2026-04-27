import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import AppSidebar from "@/components/Sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarVisible, setSidebarVisible] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("main_layout_sidebar_visible");
    if (stored === "false") {
      setSidebarVisible(false);
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarVisible((prev) => {
      const next = !prev;
      localStorage.setItem("main_layout_sidebar_visible", String(next));
      return next;
    });
  };

  return (
    <SidebarProvider>
      <div className="relative min-h-screen w-full bg-gradient-to-br from-blue-50 via-white to-indigo-100 overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
        <div className="absolute top-0 right-0 -z-10">
          <div className="w-72 h-72 bg-gradient-to-bl from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl" />
        </div>
        <div className="absolute bottom-0 left-0 -z-10">
          <div className="w-96 h-96 bg-gradient-to-tr from-indigo-400/20 to-purple-600/20 rounded-full blur-3xl" />
        </div>

        {/* Sidebar */}
        {sidebarVisible && (
          <div className="fixed inset-y-0 left-0 z-40 w-72 hidden lg:block rounded-tr-3xl rounded-br-3xl overflow-hidden">
            <AppSidebar />
          </div>
        )}

        {/* Sidebar Toggle (Desktop/Tablet) */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden lg:inline-flex fixed top-4 z-50 h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white/90 text-slate-700 shadow-md backdrop-blur-sm hover:bg-white hover:text-slate-900 transition-all duration-200"
          style={{ left: sidebarVisible ? "18.25rem" : "1rem" }}
          title={sidebarVisible ? "Sembunyikan Sidebar" : "Tampilkan Sidebar"}
          aria-label={sidebarVisible ? "Sembunyikan Sidebar" : "Tampilkan Sidebar"}
        >
          {sidebarVisible ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
        </button>

        {/* CONTENT AREA */}
        <main
          className={`flex-1 min-h-screen p-4 lg:p-8 transition-all duration-300 ${
            sidebarVisible ? "pl-0 lg:pl-[260px] lg:ml-4" : "pl-0 lg:pl-0 lg:ml-0"
          }`}
          style={{ maxWidth: '100vw' }}
        >
          {children}
        </main>

      </div>
    </SidebarProvider>
  );
}
