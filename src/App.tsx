import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getDetectedLanguage, getSavedLanguage, LanguageProvider } from "@/i18n/LanguageContext";
import type { PageKey } from "@/content/site";

const Index = lazy(() => import("./pages/Index.tsx"));
const MarketingPage = lazy(() => import("./pages/MarketingPage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const DemoHome = lazy(() => import("./pages/DemoHome.tsx"));

const isDemoApp = import.meta.env.MODE === "demo";

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
  <LanguageProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Yükleniyor...</div>}>
          {isDemoApp ? (
            <Routes>
              <Route path="/" element={<DemoHome />} />
              <Route path="*" element={<DemoHome />} />
            </Routes>
          ) : (
            <Routes>
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
);

export default App;
