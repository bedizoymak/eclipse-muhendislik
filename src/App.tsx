import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getDetectedLanguage, getSavedLanguage, LanguageProvider } from "@/i18n/LanguageContext";
import type { PageKey } from "@/content/site";

const AdminLayout = lazy(() => import("@/components/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminCustomerDetail = lazy(() => import("@/pages/admin/AdminCustomerDetail"));
const AdminCustomers = lazy(() => import("@/pages/admin/AdminCustomers"));
const AdminExpenses = lazy(() => import("@/pages/admin/AdminExpenses"));
const AdminFinance = lazy(() => import("@/pages/admin/AdminFinance"));
const AdminLeads = lazy(() => import("@/pages/admin/AdminLeads"));
const AdminLogin = lazy(() => import("@/pages/admin/AdminLogin"));
const AdminMessages = lazy(() => import("@/pages/admin/AdminMessages"));
const AdminOffers = lazy(() => import("@/pages/admin/AdminOffers"));
const AdminProjectDetail = lazy(() => import("@/pages/admin/AdminProjectDetail"));
const AdminProjects = lazy(() => import("@/pages/admin/AdminProjects"));
const AdminServices = lazy(() => import("@/pages/admin/AdminServices"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const AdminReports = lazy(() => import("@/pages/admin/AdminReports"));
const AdminTasks = lazy(() => import("@/pages/admin/AdminTasks"));
const AdminTickets = lazy(() => import("@/pages/admin/AdminTickets"));
const Index = lazy(() => import("./pages/Index.tsx"));
const MarketingPage = lazy(() => import("./pages/MarketingPage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

const queryClient = new QueryClient();
const isErpApp = import.meta.env.MODE === "erp";

function AdminPrefixRedirect() {
  const location = useLocation();
  const pathname = location.pathname.replace(/^\/admin/, "") || "/";
  return <Navigate to={`${pathname}${location.search}${location.hash}`} replace />;
}

function AdminRoutes({ rootPath }: { rootPath: string }) {
  return (
    <Route path={rootPath} element={<AdminLayout />}>
      <Route index element={<AdminDashboard />} />
      <Route path="dashboard" element={<AdminDashboard />} />
      <Route path="customers" element={<AdminCustomers />} />
      <Route path="customers/:id" element={<AdminCustomerDetail />} />
      <Route path="leads" element={<AdminLeads />} />
      <Route path="services" element={<AdminServices />} />
      <Route path="projects" element={<AdminProjects />} />
      <Route path="projects/:id" element={<AdminProjectDetail />} />
      <Route path="tasks" element={<AdminTasks />} />
      <Route path="offers" element={<AdminOffers />} />
      <Route path="finance" element={<AdminFinance />} />
      <Route path="accounts" element={<AdminFinance />} />
      <Route path="expenses" element={<AdminExpenses />} />
      <Route path="tickets" element={<AdminTickets />} />
      <Route path="reports" element={<AdminReports />} />
      <Route path="messages" element={<AdminMessages />} />
      <Route path="settings" element={<AdminSettings />} />
      <Route path="musteriler" element={<AdminCustomers />} />
      <Route path="musteriler/:id" element={<AdminCustomerDetail />} />
      <Route path="firsatlar" element={<AdminLeads />} />
      <Route path="hizmetler" element={<AdminServices />} />
      <Route path="projeler" element={<AdminProjects />} />
      <Route path="projeler/:id" element={<AdminProjectDetail />} />
      <Route path="gorevler" element={<AdminTasks />} />
      <Route path="teklifler" element={<AdminOffers />} />
      <Route path="finans" element={<AdminFinance />} />
      <Route path="cari-hesap" element={<AdminFinance />} />
      <Route path="masraflar" element={<AdminExpenses />} />
      <Route path="destek-talepleri" element={<AdminTickets />} />
      <Route path="raporlar" element={<AdminReports />} />
      <Route path="mesajlar" element={<AdminMessages />} />
      <Route path="ayarlar" element={<AdminSettings />} />
    </Route>
  );
}

function AutoHome() {
  const saved = getSavedLanguage();
  const detected = getDetectedLanguage();
  if ((saved ?? detected) === "en") return <Navigate to="/en" replace />;
  return <Index />;
}

const marketingRoutes: Array<[string, PageKey]> = [
  ["/cozumler", "solutions"],
  ["/moduller", "modules"],
  ["/ai-yapay-zeka", "ai"],
  ["/veri-analizi", "dataAnalytics"],
  ["/dijital-donusum", "digitalTransformation"],
  ["/sektorler", "industries"],
  ["/referanslar", "references"],
  ["/surec", "process"],
  ["/iletisim", "contact"],
  ["/en", "home"],
  ["/en/solutions", "solutions"],
  ["/en/modules", "modules"],
  ["/en/ai", "ai"],
  ["/en/data-analytics", "dataAnalytics"],
  ["/en/digital-transformation", "digitalTransformation"],
  ["/en/industries", "industries"],
  ["/en/references", "references"],
  ["/en/process", "process"],
  ["/en/contact", "contact"],
];

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Yükleniyor...</div>}>
            {isErpApp ? (
              <Routes>
                <Route path="/giris" element={<AdminLogin />} />
                <Route path="/admin/login" element={<Navigate to="/giris" replace />} />
                <Route path="/admin/giris" element={<Navigate to="/giris" replace />} />
                <Route path="/admin/*" element={<AdminPrefixRedirect />} />
                {AdminRoutes({ rootPath: "/" })}
                <Route path="*" element={<NotFound />} />
              </Routes>
            ) : (
              <Routes>
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/giris" element={<AdminLogin />} />
                {AdminRoutes({ rootPath: "/admin" })}
                <Route path="/" element={<AutoHome />} />
                {marketingRoutes.map(([path, pageKey]) => (
                  <Route key={path} path={path} element={<MarketingPage pageKey={pageKey} />} />
                ))}
                <Route path="*" element={<NotFound />} />
              </Routes>
            )}
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;

//test
