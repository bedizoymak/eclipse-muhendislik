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
const Musteriler = lazy(() => import("./pages/Musteriler.tsx"));
const MusteriDetay = lazy(() => import("./pages/MusteriDetay.tsx"));
const Faturalar = lazy(() => import("./pages/Faturalar.tsx"));
const FaturaDetay = lazy(() => import("./pages/FaturaDetay.tsx"));
const Tahsilatlar = lazy(() => import("./pages/Tahsilatlar.tsx"));
const TahsilatDetay = lazy(() => import("./pages/TahsilatDetay.tsx"));
const Hesaplar = lazy(() => import("./pages/Hesaplar.tsx"));
const HesapHareketleri = lazy(() => import("./pages/HesapHareketleri.tsx"));
const Giderler = lazy(() => import("./pages/Giderler.tsx"));
const GiderDetay = lazy(() => import("./pages/GiderDetay.tsx"));
const Tedarikciler = lazy(() => import("./pages/Tedarikciler.tsx"));
const GiderOdemeleri = lazy(() => import("./pages/GiderOdemeleri.tsx"));
const Urunler = lazy(() => import("./pages/Urunler.tsx"));
const UrunDetay = lazy(() => import("./pages/UrunDetay.tsx"));
const Depolar = lazy(() => import("./pages/Depolar.tsx"));
const StokSeviyeleri = lazy(() => import("./pages/StokSeviyeleri.tsx"));
const StokHareketleri = lazy(() => import("./pages/StokHareketleri.tsx"));
const Cekler = lazy(() => import("./pages/Cekler.tsx"));
const CekDetay = lazy(() => import("./pages/CekDetay.tsx"));
const Teklifler = lazy(() => import("./pages/Teklifler.tsx"));
const TeklifDetay = lazy(() => import("./pages/TeklifDetay.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));

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
              <Route path="/musteriler" element={<Musteriler />} />
              <Route path="/musteriler/:parasutId" element={<MusteriDetay />} />
              <Route path="/satislar/faturalar" element={<Faturalar />} />
              <Route path="/satislar/faturalar/:parasutId" element={<FaturaDetay />} />
              <Route path="/satislar/tahsilatlar" element={<Tahsilatlar />} />
              <Route path="/satislar/tahsilatlar/:parasutId" element={<TahsilatDetay />} />
              <Route path="/nakit/hesaplar" element={<Hesaplar />} />
              <Route path="/nakit/hesap-hareketleri" element={<HesapHareketleri />} />
              <Route path="/giderler" element={<Giderler />} />
              <Route path="/giderler/tedarikciler" element={<Tedarikciler />} />
              <Route path="/giderler/odemeler" element={<GiderOdemeleri />} />
              <Route path="/giderler/:parasutId" element={<GiderDetay />} />
              <Route path="/urunler" element={<Urunler />} />
              <Route path="/urunler/:parasutId" element={<UrunDetay />} />
              <Route path="/stok/depolar" element={<Depolar />} />
              <Route path="/stok/seviyeleri" element={<StokSeviyeleri />} />
              <Route path="/stok/hareketleri" element={<StokHareketleri />} />
              <Route path="/nakit/cekler" element={<Cekler />} />
              <Route path="/nakit/cekler/:parasutId" element={<CekDetay />} />
              <Route path="/satislar/teklifler" element={<Teklifler />} />
              <Route path="/satislar/teklifler/:parasutId" element={<TeklifDetay />} />
              <Route path="*" element={<DemoHome />} />
            </Routes>
          ) : (
            <Routes>
              <Route path="/" element={<AutoHome />} />
              <Route path="/login" element={<Login />} />
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
