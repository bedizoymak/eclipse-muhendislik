import { useMemo, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, Inbox, LayoutDashboard, LogOut, Menu, Settings, ServerCog, X, FolderKanban } from "lucide-react";
import logoDark from "@/assets/logo-dark-bg.png";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin", label: "Panel", icon: LayoutDashboard, end: true },
  { to: "/admin/services", label: "Hizmetler", icon: ServerCog },
  { to: "/admin/projects", label: "Projeler / Referanslar", icon: FolderKanban },
  { to: "/admin/messages", label: "Mesajlar", icon: Inbox },
  { to: "/admin/settings", label: "Site Ayarları", icon: Settings },
];

const pageTitles = [
  { path: "/admin/services", title: "Hizmetler" },
  { path: "/admin/projects", title: "Projeler / Referanslar" },
  { path: "/admin/messages", title: "Mesajlar" },
  { path: "/admin/settings", title: "Site Ayarları" },
  { path: "/admin", title: "Panel" },
];

function currentTitle(pathname: string) {
  return pageTitles.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`))?.title ?? "Panel";
}

export default function AdminLayout() {
  const { session, isAdmin, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const title = useMemo(() => currentTitle(location.pathname), [location.pathname]);

  if (!isSupabaseConfigured) {
    return <Navigate to="/admin/login" replace />;
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-secondary/40 text-sm text-muted-foreground">Yönetim paneli yükleniyor...</div>;
  }

  if (!session || !isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  async function logout() {
    await supabase?.auth.signOut();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-secondary/40">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-navy text-white shadow-2xl transition-transform duration-200 lg:static lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="border-b border-white/10 p-5">
          <Link to="/admin" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <img src={logoDark} alt="Eclipse Mühendislik" className="h-14 w-24 object-contain" />
            <div className="min-w-0">
              <div className="font-display text-lg font-semibold">Eclipse Mühendislik</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">Yönetim Paneli</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive ? "bg-electric text-white shadow-glow" : "text-white/75 hover:bg-white/10 hover:text-white",
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="mt-6 border-t border-white/10 pt-4">
            <Link
              to="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Home className="h-4 w-4" />
              Ana Siteye Dön
            </Link>
          </div>
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-3 rounded-lg bg-white/5 p-3">
            <div className="text-xs text-white/50">Oturum</div>
            <div className="mt-1 truncate text-sm font-semibold">{session.user.email}</div>
          </div>
          <Button onClick={logout} variant="ghost" className="w-full justify-start text-white/75 hover:bg-white/10 hover:text-white">
            <LogOut className="mr-2 h-4 w-4" />
            Çıkış Yap
          </Button>
        </div>
      </aside>

      {open && <button className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} aria-label="Menüyü kapat" />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
          <div className="flex h-16 items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              aria-label="Menüyü aç"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <div className="text-xs font-medium text-muted-foreground">Eclipse Yönetim Paneli</div>
              <div className="font-display text-lg font-semibold">{title}</div>
            </div>
            <Button asChild variant="outline" size="sm" className="ml-auto hidden md:inline-flex">
              <Link to="/">
                <Home className="h-4 w-4" />
                Siteye Git
              </Link>
            </Button>
            <button
              onClick={() => setOpen(false)}
              aria-label="Menüyü kapat"
              className="hidden h-10 w-10 items-center justify-center rounded-lg border border-border bg-background"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6 xl:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
