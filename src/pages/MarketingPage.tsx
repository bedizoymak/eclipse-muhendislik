import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/sections/Footer";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { DashboardVisual } from "@/components/marketing/Visuals";
import { useLang } from "@/i18n/LanguageContext";
import { iconSet, routes, siteContent, type PageKey } from "@/content/site";
import { CONTACT } from "@/i18n/translations";
import { useReveal } from "@/hooks/use-reveal";

const setMeta = (title: string, description: string) => {
  document.title = title;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
  }
  meta.content = description;
};

const PageHero = ({ pageKey }: { pageKey: PageKey }) => {
  const { lang } = useLang();
  const t = siteContent[lang];
  const page = t.pages[pageKey];

  return (
    <section className="relative isolate overflow-hidden pt-32 pb-16 md:pt-40 md:pb-24">
      <div className="absolute inset-0 bg-gradient-hero" aria-hidden />
      <div className="absolute inset-0 grid-pattern opacity-25" aria-hidden />
      <div className="absolute left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-electric/20 blur-[110px]" aria-hidden />
      <div className="container-page relative grid items-center gap-12 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <span className="eyebrow">{page.eyebrow}</span>
          <h1 className="mt-6 max-w-4xl font-display text-4xl font-semibold leading-[1.06] text-white md:text-6xl">{page.title}</h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-white/70">{page.subtitle}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button size="xl" variant="hero" asChild>
              <Link to={routes[lang].contact}>{pageKey === "contact" ? t.form.submit : t.nav.demo}<ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button size="xl" variant="outline-light" asChild>
              <Link to={routes[lang].solutions}>{t.nav.solutions}</Link>
            </Button>
          </div>
        </div>
        <DashboardVisual />
      </div>
    </section>
  );
};

const CTA = () => {
  const { lang } = useLang();
  const t = siteContent[lang];
  return (
    <section className="bg-gradient-hero py-16">
      <div className="container-page">
        <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-8 text-center backdrop-blur md:p-12">
          <h2 className="mx-auto max-w-3xl text-3xl font-semibold text-white md:text-4xl">{t.ctaTitle}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-white/65">{t.ctaText}</p>
          <Button className="mt-8" size="xl" variant="hero" asChild>
            <Link to={routes[lang].contact}>{t.nav.demo}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

const Cards = ({ items }: { items: readonly (readonly string[])[] }) => (
  <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
    {items.map((item, index) => {
      const Icon = iconSet[index % iconSet.length];
      return (
        <article key={item[0]} className="reveal rounded-xl border border-white/10 bg-white/[0.04] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-electric-bright/45 hover:bg-white/[0.075]">
          <Icon className="h-6 w-6 text-electric-bright" />
          <h3 className="mt-5 text-xl font-semibold text-white">{item[0]}</h3>
          <p className="mt-3 text-sm leading-relaxed text-white/62">{item[1]}</p>
          {item[2] && <p className="mt-4 text-sm leading-relaxed text-white/50">{item[2]}</p>}
          {item[3] && <p className="mt-4 text-sm font-medium leading-relaxed text-electric-bright">{item[3]}</p>}
        </article>
      );
    })}
  </div>
);

const homeSections = {
  tr: [
    ["İşletme problemleri", "Parçalı yazılımlar, Excel dosyaları, geciken raporlar ve kopuk ekip akışları yönetim kararlarını zayıflatır. Eclipse; ERP, CRM, AI-Yapay Zeka, Veri Analizi ve Dijital Dönüşüm katmanlarını tek mimaride birleştirerek operasyonel belirsizliği azaltır.", "tasks"],
    ["Tek platform yaklaşımı", "Satış, finans, stok, görev ve yönetim raporları aynı veri modeli üzerinde çalıştığında işletme bütünsel olarak yönetilebilir hale gelir. Tek platform yaklaşımı, karar kalitesini ve süreç takibini kurumsal standarda taşır.", "executive"],
    ["ERP modülleri", "ERP modülleri; operasyon, stok, finans, personel, teklif, sipariş ve raporlama süreçlerini ölçülebilir bir yönetim sistemine dönüştürür. Her modül, iş akışlarına ve yetki yapılarına göre konumlandırılır.", "stock"],
    ["CRM pipeline bölümü", "CRM pipeline yapısı; fırsat, teklif, takip ve kapanış süreçlerini satış ekipleri için görünür hale getirir. AI-Yapay Zeka destekli tahmin katmanı, yüksek potansiyelli fırsatların önceliklendirilmesine yardımcı olur.", "pipeline"],
    ["AI-Yapay Zeka karar motoru", "AI-Yapay Zeka karar motoru; satış tahmini, risk sinyali, finansal öngörü ve müşteri davranış analizi üretir. Sistem yalnızca veri göstermez, yönetim aksiyonlarını destekleyen sinyaller oluşturur.", "finance"],
    ["Veri Analizi dashboard bölümü", "Veri Analizi dashboardları KPI, finans, satış, stok ve performans verilerini karşılaştırılabilir hale getirir. Yöneticiler anlık durum, trend ve sapmaları tek ekrandan okuyabilir.", "analytics"],
    ["Dijital Dönüşüm süreci", "Dijital Dönüşüm; mevcut süreçlerin yazılıma aktarılmasından daha kapsamlıdır. Eclipse yaklaşımı; süreçlerin yeniden tasarlanması, otomasyonla güçlendirilmesi ve sürdürülebilir şekilde ölçülmesini sağlar.", "architecture"],
    ["Sektör bazlı kullanım senaryoları", "Üretim, depo, lojistik, saha, satış, finans ve servis ekipleri farklı operasyon modellerine sahiptir. Eclipse platformu, bu iş birimlerinin veri ve süreç ihtiyaçlarına göre yapılandırılır.", "tasks"],
    ["Mobil kullanım", "Mobil kullanım; saha, depo, satış ve servis ekiplerinin gerçek zamanlı veriyle çalışmasını sağlar. Merkez ve saha arasındaki bilgi gecikmesi azalır, operasyonel kayıtlar kurumsal sisteme doğrudan akar.", "stock"],
    ["Eclipse ile bir iş günü senaryosu", "Gün; CRM fırsatlarının değerlendirilmesi, ERP stok durumunun kontrol edilmesi, finans risklerinin izlenmesi ve Veri Analizi dashboardlarının yönetim kararlarına temel oluşturmasıyla ilerler.", "pipeline"],
    ["Yönetici dashboardları", "Yönetici dashboardları; şirket performansını departman bazlı değil, bütünleşik veri mimarisi üzerinden gösterir. KPI alert, Forecast ve Risk signal gibi mikro göstergeler karar sürecini hızlandırır.", "executive"],
    ["Entegrasyon ve ölçeklenebilir mimari", "Eclipse mimarisi API bağlantıları, rol bazlı veri erişimi ve ölçeklenebilir modül yapısı ile büyüyen işletme ihtiyaçlarına uyum sağlar. Yeni modüller mevcut veri modeliyle birlikte gelişir.", "architecture"],
    ["Güvenlik ve rol bazlı erişim", "Rol bazlı erişim, departmanlara ve kullanıcı sorumluluklarına göre veri görünürlüğünü kontrol eder. Güvenlik katmanı, kurumsal operasyonların yetkili ve izlenebilir şekilde yürütülmesini destekler.", "security"],
  ],
  en: [
    ["Business operating challenges", "Fragmented software, spreadsheets, delayed reports and disconnected team workflows weaken management decisions. Eclipse unifies ERP, CRM, AI, Data Analytics and Digital Transformation layers in one architecture.", "tasks"],
    ["One-platform approach", "When sales, finance, inventory, tasks and reporting operate on the same data model, the business becomes manageable as one system. This approach raises decision quality and process discipline.", "executive"],
    ["ERP modules", "ERP modules turn operations, inventory, finance, personnel, proposals, orders and reporting into a measurable management system. Each module is positioned around workflows and permissions.", "stock"],
    ["CRM pipeline", "The CRM pipeline makes opportunities, proposals, follow-ups and closing stages visible for sales teams. AI-supported forecasting helps prioritize high-potential opportunities.", "pipeline"],
    ["AI decision engine", "The AI decision engine produces sales forecasts, risk signals, financial outlooks and customer behavior analysis. The system does not only display data; it generates signals that support management action.", "finance"],
    ["Data Analytics dashboard", "Data Analytics dashboards make KPI, finance, sales, inventory and performance data comparable. Executives read status, trends and deviations from one interface.", "analytics"],
    ["Digital Transformation process", "Digital Transformation is broader than moving existing work into software. Eclipse redesigns processes, strengthens them with automation and makes them sustainably measurable.", "architecture"],
    ["Industry scenarios", "Manufacturing, warehouse, logistics, field, sales, finance and service teams each have distinct operating models. Eclipse is configured around their data and workflow requirements.", "tasks"],
    ["Mobile usage", "Mobile usage enables field, warehouse, sales and service teams to work with real-time data. Information latency between headquarters and field operations decreases.", "stock"],
    ["A business day with Eclipse", "The day progresses through CRM opportunity review, ERP inventory control, finance risk tracking and Data Analytics dashboards supporting management decisions.", "pipeline"],
    ["Executive dashboards", "Executive dashboards show company performance through integrated data architecture rather than isolated department reports. KPI alert, Forecast and Risk signal labels accelerate decisions.", "executive"],
    ["Integration and scalable architecture", "Eclipse architecture supports API connections, role-based data access and scalable modules. New capabilities evolve with the existing data model.", "architecture"],
    ["Security and role-based access", "Role-based access controls data visibility according to departments and user responsibilities. The security layer supports authorized and traceable operations.", "security"],
  ],
} as const;

const HomeSection = ({ item, index }: { item: readonly [string, string, string]; index: number }) => {
  const reverse = index % 2 === 1;
  return (
    <section className={index % 2 === 0 ? "bg-[#071827] py-20 md:py-28" : "bg-navy-deep py-20 md:py-28"}>
      <div className={`container-page grid gap-12 lg:grid-cols-2 lg:items-center ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div>
          <span className="eyebrow">0{index + 2}</span>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">{item[0]}</h2>
          <p className="mt-5 text-lg leading-relaxed text-white/64">{item[1]}</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {["Live data", "Risk signal", "Forecast"].map((tag) => (
              <div key={tag} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70 transition hover:border-electric-bright/40 hover:text-white">
                <CheckCircle2 className="mr-2 inline h-4 w-4 text-electric-bright" />
                {tag}
              </div>
            ))}
          </div>
        </div>
        <DashboardVisual kind={item[2] as Parameters<typeof DashboardVisual>[0]["kind"]} />
      </div>
    </section>
  );
};

const HomePage = () => {
  const { lang } = useLang();
  const t = siteContent[lang];
  const sections = homeSections[lang];

  return (
    <>
      <PageHero pageKey="home" />
      <section className="bg-navy-deep py-16">
        <div className="container-page">
          <div className="grid gap-5 md:grid-cols-4">
            {[
              ["ERP", "94%"],
              ["CRM", "38"],
              [lang === "tr" ? "AI-Yapay Zeka" : "AI", "12"],
              [lang === "tr" ? "Veri Analizi" : "Data Analytics", "7/24"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-1 hover:border-electric-bright/40">
                <div className="text-xs uppercase tracking-[0.18em] text-white/45">{label}</div>
                <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
                <div className="mt-3 h-1.5 rounded-full bg-white/10">
                  <div className="h-1.5 w-4/5 rounded-full bg-electric-bright" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {sections.map((item, index) => <HomeSection key={item[0]} item={item} index={index} />)}
      <section className="bg-[#071827] py-20 md:py-28">
        <div className="container-page">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <span className="eyebrow">15</span>
              <h2 className="mt-4 text-3xl font-semibold text-white md:text-5xl">{t.ctaTitle}</h2>
              <p className="mt-5 text-lg leading-relaxed text-white/64">{t.ctaText}</p>
              <Button className="mt-8" size="xl" variant="hero" asChild>
                <Link to={routes[lang].contact}>{t.nav.demo}<ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </div>
            <DashboardVisual kind="executive" />
          </div>
        </div>
      </section>
    </>
  );
};

const StandardPage = ({ pageKey }: { pageKey: PageKey }) => {
  const { lang } = useLang();
  const t = siteContent[lang];

  if (pageKey === "contact") return <ContactPage />;
  if (pageKey === "home") return <HomePage />;

  const content =
    pageKey === "solutions" ? t.solutionCards :
    pageKey === "modules" ? t.modules :
    pageKey === "ai" ? t.aiItems.map((item) => [item, lang === "tr" ? "Kurumsal veri modeliyle ilişkilendirilmiş AI-Yapay Zeka karar destek kapasitesi." : "Decision intelligence connected to the enterprise data model."]) :
    pageKey === "dataAnalytics" ? t.analyticsItems.map((item) => [item, lang === "tr" ? "Yönetim raporlaması için karşılaştırılabilir ve aksiyona dönüştürülebilir veri katmanı." : "Comparable and actionable data layer for management reporting."]) :
    pageKey === "digitalTransformation" ? t.transformationItems.map((item) => [item, lang === "tr" ? "Süreçleri ölçülebilir ve sürdürülebilir kurumsal yazılım yapısına dönüştürür." : "Transforms processes into measurable and sustainable enterprise software structures."]) :
    pageKey === "industries" ? t.industries :
    t.processSteps;

  return (
    <>
      <PageHero pageKey={pageKey} />
      <section className="bg-[#071827] py-20 md:py-28">
        <div className="container-page">
          {pageKey === "solutions" && <p className="mb-12 max-w-4xl text-xl leading-relaxed text-white/70">{t.pages.solutions.intro}</p>}
          <Cards items={content} />
        </div>
      </section>
      {(
        <section className="bg-navy-deep py-20">
          <div className="container-page grid gap-10 lg:grid-cols-2 lg:items-center">
            <DashboardVisual />
            <div>
              <span className="eyebrow">{t.nav.dataAnalytics}</span>
              <h2 className="mt-4 text-3xl font-semibold text-white md:text-5xl">{lang === "tr" ? "ERP, CRM, AI-Yapay Zeka ve Veri Analizi aynı mimaride çalışır." : "ERP, CRM, AI and Data Analytics operate within the same architecture."}</h2>
              <p className="mt-5 text-lg leading-relaxed text-white/62">{lang === "tr" ? "Bu yaklaşım, süreçlerin yalnızca takip edilmesini değil; ölçülmesini, analiz edilmesini ve yönetim kararlarına doğrudan bağlanmasını sağlar." : "This approach does not merely track processes; it measures, analyzes and connects them directly to management decisions."}</p>
            </div>
          </div>
        </section>
      )}
      <CTA />
    </>
  );
};

const ContactPage = () => {
  const { lang } = useLang();
  const t = siteContent[lang];

  return (
    <>
      <PageHero pageKey="contact" />
      <section className="bg-[#071827] py-20 md:py-28">
        <div className="container-page grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="text-3xl font-semibold text-white md:text-4xl">{t.pages.contact.title}</h2>
            <p className="mt-5 text-lg leading-relaxed text-white/62">{t.pages.contact.subtitle}</p>
            <div className="mt-8 space-y-3 text-sm text-white/70">
              <p>{CONTACT.email}</p>
              <p>{CONTACT.phone}</p>
            </div>
          </div>
          <form className="rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-6 backdrop-blur md:p-8">
            <div className="grid gap-4 md:grid-cols-2">
              {[t.form.name, t.form.company, t.form.email, t.form.phone].map((label) => (
                <label key={label} className="text-sm font-medium text-white/70">
                  {label}
                  <input className="mt-2 h-11 w-full rounded-md border border-white/10 bg-navy-deep/70 px-3 text-white outline-none transition focus:border-electric-bright" />
                </label>
              ))}
            </div>
            <label className="mt-4 block text-sm font-medium text-white/70">
              {t.form.solution}
              <select className="mt-2 h-11 w-full rounded-md border border-white/10 bg-navy-deep/70 px-3 text-white outline-none transition focus:border-electric-bright">
                {t.form.options.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <label className="mt-4 block text-sm font-medium text-white/70">
              {t.form.message}
              <textarea className="mt-2 min-h-32 w-full rounded-md border border-white/10 bg-navy-deep/70 px-3 py-3 text-white outline-none transition focus:border-electric-bright" />
            </label>
            <Button className="mt-6 w-full" size="xl" variant="hero" type="button">{t.form.submit}</Button>
          </form>
        </div>
      </section>
    </>
  );
};

export const MarketingPage = ({ pageKey }: { pageKey: PageKey }) => {
  const ref = useReveal();
  const { lang, setLang } = useLang();
  const location = useLocation();
  const t = siteContent[lang];

  useEffect(() => {
    const routeLang = location.pathname.startsWith("/en") ? "en" : "tr";
    if (lang !== routeLang) setLang(routeLang);
  }, [lang, location.pathname, setLang]);

  useEffect(() => {
    const [title, description] = t.seo[pageKey];
    setMeta(title, description);
  }, [pageKey, t]);

  return (
    <div ref={ref} className="min-h-screen bg-navy-deep text-white">
      <Header />
      <main>
        <StandardPage pageKey={pageKey} />
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
};

export default MarketingPage;
