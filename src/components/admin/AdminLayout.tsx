import { useMemo, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BriefcaseBusiness,
  ChevronRight,
  CheckSquare,
  ClipboardList,
  FileText,
  Headphones,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Receipt,
  Settings,
  ServerCog,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import logoDark from "@/assets/logo-dark-bg.png";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { adminLoginPath, adminPath } from "@/lib/adminRoutes";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    title: "Genel",
    items: [{ to: adminPath(), label: "Genel Bakış", description: "Kısa şirket özeti", icon: LayoutDashboard, end: true }],
  },
  {
    title: "CRM",
    items: [
      { to: adminPath("/musteriler"), label: "Müşteriler", description: "Cari ve ilişki takibi", icon: Users },
      { to: adminPath("/firsatlar"), label: "Fırsatlar", description: "Satış pipeline", icon: TrendingUp },
      { to: adminPath("/hizmetler"), label: "Hizmetler", description: "BT hizmet kataloğu", icon: ServerCog },
    ],
  },
  {
    title: "Operasyon",
    items: [
      { to: adminPath("/projeler"), label: "Projeler", description: "Teknik işler", icon: BriefcaseBusiness },
      { to: adminPath("/gorevler"), label: "Görevler", description: "İş takibi", icon: CheckSquare },
      { to: adminPath("/destek-talepleri"), label: "Destek Talepleri", description: "Servis istekleri", icon: Headphones },
    ],
  },
  {
    title: "Finans",
    items: [
      { to: adminPath("/teklifler"), label: "Teklifler", description: "Proposal yönetimi", icon: ClipboardList },
      { to: adminPath("/finans"), label: "Faturalar", description: "Ödeme ve cari", icon: FileText },
      { to: adminPath("/cari-hesap"), label: "Cari Hesap", description: "Resmi / iç kayıt", icon: Wallet },
      { to: adminPath("/masraflar"), label: "Masraflar", description: "Gider kalemleri", icon: Receipt },
      { to: adminPath("/raporlar"), label: "Raporlar", description: "Analitik ve CSV", icon: BarChart3 },
    ],
  },
  {
    title: "Sistem",
    items: [{ to: adminPath("/ayarlar"), label: "Ayarlar", description: "Firma ve CRM", icon: Settings }],
  },
];

const pageMeta = [
  { path: adminPath("/dashboard"), title: "Genel Bakış", group: "Genel" },
  { path: adminPath("/musteriler"), title: "Müşteriler", group: "CRM" },
  { path: adminPath("/firsatlar"), title: "Fırsatlar", group: "CRM" },
  { path: adminPath("/hizmetler"), title: "Hizmetler", group: "CRM" },
  { path: adminPath("/projeler"), title: "Projeler", group: "Operasyon" },
  { path: adminPath("/gorevler"), title: "Görevler", group: "Operasyon" },
  { path: adminPath("/destek-talepleri"), title: "Destek Talepleri", group: "Operasyon" },
  { path: adminPath("/teklifler"), title: "Teklifler", group: "Finans" },
  { path: adminPath("/finans"), title: "Faturalar", group: "Finans" },
  { path: adminPath("/cari-hesap"), title: "Cari Hesap", group: "Finans" },
  { path: adminPath("/masraflar"), title: "Masraflar", group: "Finans" },
  { path: adminPath("/raporlar"), title: "Raporlar", group: "Finans" },
  { path: adminPath("/mesajlar"), title: "Mesajlar", group: "Operasyon" },
  { path: adminPath("/ayarlar"), title: "Ayarlar", group: "Sistem" },
  { path: adminPath("/customers"), title: "Müşteriler", group: "CRM" },
  { path: adminPath("/leads"), title: "Fırsatlar", group: "CRM" },
  { path: adminPath("/services"), title: "Hizmetler", group: "CRM" },
  { path: adminPath("/projects"), title: "Projeler", group: "Operasyon" },
  { path: adminPath("/tasks"), title: "Görevler", group: "Operasyon" },
  { path: adminPath("/tickets"), title: "Destek Talepleri", group: "Operasyon" },
  { path: adminPath("/offers"), title: "Teklifler", group: "Finans" },
  { path: adminPath("/finance"), title: "Faturalar", group: "Finans" },
  { path: adminPath("/accounts"), title: "Cari Hesap", group: "Finans" },
  { path: adminPath("/expenses"), title: "Masraflar", group: "Finans" },
  { path: adminPath("/reports"), title: "Raporlar", group: "Finans" },
  { path: adminPath("/messages"), title: "Mesajlar", group: "Operasyon" },
  { path: adminPath("/settings"), title: "Ayarlar", group: "Sistem" },
  { path: adminPath(), title: "Dashboard", group: "Genel", exact: true },
];

function currentPage(pathname: string) {
  return pageMeta.find((item) => (item.exact ? pathname === item.path : pathname.startsWith(item.path))) ?? { title: "Yönetim Paneli", group: "Eclipse CRM" };
}

export default function AdminLayout() {
  const { session, isAdmin, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const page = useMemo(() => currentPage(location.pathname), [location.pathname]);

  if (!isSupabaseConfigured) {
    return <Navigate to={adminLoginPath} replace />;
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-secondary/40 text-sm text-muted-foreground">Yönetim paneli yükleniyor...</div>;
  }

  if (!session || !isAdmin) {
    return <Navigate to={adminLoginPath} replace state={{ from: location.pathname }} />;
  }

  async function logout() {
    await supabase?.auth.signOut();
    navigate(adminLoginPath, { replace: true });
  }

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-secondary/40">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-navy text-white shadow-2xl transition-transform duration-200 print:hidden lg:static lg:w-80 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="border-b border-white/10 p-5">
          <Link to={adminPath()} className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <img src={logoDark} alt="Eclipse Mühendislik" className="h-14 w-24 object-contain" />
            <div className="min-w-0">
              <div className="font-display text-lg font-semibold">Eclipse CRM</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">Yönetim Paneli</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-5">
            {navGroups.map((group) => (
              <div key={group.title}>
                <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">{group.title}</div>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all duration-200 hover:translate-x-0.5 hover:bg-white/10 hover:text-white",
                          isActive ? "bg-electric text-white shadow-glow ring-1 ring-white/10" : "text-white/75",
                        )
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{item.label}</span>
                        <span className="block truncate text-[11px] opacity-65">{item.description}</span>
                      </span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-white/10 pt-4">
            <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white">
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

      <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">
        <header className="sticky top-0 z-20 w-full max-w-full overflow-x-hidden border-b border-border bg-background/95 px-4 backdrop-blur print:hidden md:px-6">
          <div className="flex h-16 items-center gap-3">
            <button onClick={() => setOpen(true)} aria-label="Menüyü aç" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Home className="h-3.5 w-3.5" />
                <span>{page.group}</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{page.title}</span>
              </div>
              <div className="truncate font-display text-lg font-semibold">{page.title}</div>
            </div>
            <Button asChild size="sm" className="ml-auto hidden bg-gradient-electric text-white shadow-glow md:inline-flex">
              <Link to={adminPath("/musteriler")}>
                <Plus className="h-4 w-4" />
                Hızlı Kayıt
              </Link>
            </Button>
          </div>
        </header>
        <main className="min-w-0 w-full max-w-full flex-1 overflow-x-hidden p-4 md:p-6 xl:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
