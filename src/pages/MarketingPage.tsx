import { useEffect, useState } from "react";
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
    ["İşletme problemleri", "Parçalı yazılımlar, dağınık tablolar, geciken raporlar ve kopuk ekip akışları operasyonel görünürlüğü zayıflatır. Eclipse; ERP, CRM, AI-Yapay Zeka, Veri Analizi ve Dijital Dönüşüm katmanlarını tek kurumsal yazılım mimarisinde birleştirerek veri bütünlüğünü güçlendirir.", "tasks"],
    ["Tek platform yaklaşımı", "Satış, finans, stok, görev ve yönetim raporları aynı veri modeli üzerinde çalıştığında işletme yönetilebilir süreç modeline kavuşur. Tek platform yaklaşımı, karar kalitesini ve süreç mimarisini kurumsal standarda taşır.", "executive"],
    ["ERP modülleri", "ERP modülleri; operasyon, stok, finans, personel, teklif, sipariş ve raporlama süreçlerini ölçülebilir performans göstergeleriyle yönetilen bir sistem mimarisine dönüştürür.", "stock"],
    ["CRM satış hattı", "CRM satış hattı; fırsat, teklif, takip ve kapanış aşamalarını satış ekipleri için izlenebilir hale getirir. AI-Yapay Zeka destekli öngörü katmanı, yüksek potansiyelli fırsatların önceliklendirilmesini destekler.", "pipeline"],
    ["AI-Yapay Zeka karar motoru", "AI-Yapay Zeka karar motoru; satış öngörüsü, risk sinyali, finansal projeksiyon ve müşteri davranış analizi üretir. Sistem, karar destek katmanını operasyonel veriye doğrudan bağlar.", "ai"],
    ["Veri Analizi kontrol paneli", "Veri Analizi kontrol panelleri; finans, satış, stok ve performans verilerini karşılaştırılabilir göstergelere dönüştürür. Yönetim ekipleri anlık durum, eğilim ve sapmaları ölçülebilir biçimde izler.", "analytics"],
    ["Dijital Dönüşüm süreci", "Dijital Dönüşüm; mevcut süreçlerin yazılıma aktarılmasından daha kapsamlıdır. Eclipse yaklaşımı; süreç mimarisinin yeniden tasarlanmasını, otomasyonla güçlendirilmesini ve sürdürülebilir şekilde ölçülmesini sağlar.", "architecture"],
    ["Sektör bazlı kullanım senaryoları", "Üretim, depo, lojistik, saha, satış, finans ve servis ekipleri farklı operasyon modellerine sahiptir. Eclipse platformu, her iş biriminin veri akışı ve süreç mimarisi gereksinimlerine göre yapılandırılır.", "tasks"],
    ["Mobil kullanım", "Mobil kullanım; saha, depo, satış ve servis ekiplerinin gerçek zamanlı veriyle çalışmasını sağlar. Merkez ve saha arasındaki bilgi gecikmesi azalır, operasyonel kayıtlar kurumsal sisteme doğrudan aktarılır.", "mobile"],
    ["Eclipse ile bir iş günü senaryosu", "Gün; CRM fırsatlarının değerlendirilmesi, ERP stok durumunun kontrol edilmesi, finansal risklerin izlenmesi ve Veri Analizi kontrol panellerinin yönetim kararlarına temel oluşturmasıyla ilerler.", "pipeline"],
    ["Yönetici kontrol panelleri", "Yönetici kontrol panelleri; şirket performansını departman bazlı raporlar yerine bütünleşik veri mimarisi üzerinden gösterir. Performans uyarısı, öngörü ve risk sinyali göstergeleri karar süreçlerini hızlandırır.", "executive"],
    ["Entegrasyon ve ölçeklenebilir mimari", "Eclipse mimarisi API bağlantıları, rol bazlı veri erişimi ve ölçeklenebilir modül yapısı ile büyüyen işletme ihtiyaçlarına uyum sağlar. Yeni modüller mevcut veri modeliyle birlikte gelişir.", "architecture"],
    ["Güvenlik ve rol bazlı erişim", "Rol bazlı erişim, departmanlara ve kullanıcı sorumluluklarına göre veri görünürlüğünü kontrol eder. Güvenlik katmanı, kurumsal operasyonların yetkili ve izlenebilir şekilde yürütülmesini destekler.", "security"],
  ],
  en: [
    ["Business operating challenges", "Fragmented software, spreadsheets, delayed reports and disconnected team workflows weaken management decisions. Eclipse unifies ERP, CRM, AI, Data Analytics and Digital Transformation layers in one architecture.", "tasks"],
    ["One-platform approach", "When sales, finance, inventory, tasks and reporting operate on the same data model, the business becomes manageable as one system. This approach raises decision quality and process discipline.", "executive"],
    ["ERP modules", "ERP modules turn operations, inventory, finance, personnel, proposals, orders and reporting into a measurable management system. Each module is positioned around workflows and permissions.", "stock"],
    ["CRM pipeline", "The CRM pipeline makes opportunities, proposals, follow-ups and closing stages visible for sales teams. AI-supported forecasting helps prioritize high-potential opportunities.", "pipeline"],
    ["AI decision engine", "The AI decision engine produces sales forecasts, risk signals, financial outlooks and customer behavior analysis. The system does not only display data; it generates signals that support management action.", "ai"],
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
  const { lang } = useLang();
  const reverse = index % 2 === 1;
  const visualKind = item[2] as Parameters<typeof DashboardVisual>[0]["kind"];
  const tags = lang === "tr" ? ["Canlı veri", "Risk sinyali", "Öngörü"] : ["Live data", "Risk signal", "Forecast"];
  const problemCards = lang === "tr"
    ? [
        ["Kopuk veri", "Operasyonel sinyaller geç ulaşır ve kararlar parçalı kaynaklara bağlı kalır."],
        ["Manuel kontrol", "Ekipler ölçülebilir iş akışlarını yönetmek yerine dosya mutabakatına zaman ayırır."],
        ["Yönetim boşluğu", "Risk, kapasite ve performans tek güvenilir sistemden okunamaz."],
      ]
    : [
        ["Disconnected data", "Operational signals arrive late and decisions depend on fragmented sources."],
        ["Manual control", "Teams spend effort reconciling files instead of managing measurable workflows."],
        ["Management gap", "Leadership cannot read risk, capacity and performance from one reliable system."],
      ];
  const timelineSteps = lang === "tr" ? ["Analiz", "Yapılandırma", "Ölçüm", "Ölçekleme"] : ["Analyze", "Configure", "Measure", "Scale"];
  const timelineText = lang === "tr"
    ? "Operasyonel veri yapılandırılır, bağlanır ve ölçülebilir yönetim akışına dönüştürülür."
    : "Operational data is structured, connected and converted into measurable management flow.";

  if (index === 0 || index === 7) {
    return (
      <section className="bg-[#071827] py-20 md:py-28">
        <div className="container-page">
          <div className="max-w-4xl">
            <span className="eyebrow">0{index + 2}</span>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">{item[0]}</h2>
            <p className="mt-5 text-lg leading-relaxed text-white/64">{item[1]}</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {problemCards.map((card, cardIndex) => {
              const Icon = iconSet[(index + cardIndex) % iconSet.length];
              return (
                <article key={card[0]} className="rounded-xl border border-white/10 bg-white/[0.04] p-6 transition hover:-translate-y-1 hover:border-electric-bright/40">
                  <Icon className="h-5 w-5 text-electric-bright" />
                  <h3 className="mt-5 text-lg font-semibold text-white">{card[0]}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/58">{card[1]}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (index === 1 || index === 10) {
    return (
      <section className="bg-navy-deep py-20 md:py-28">
        <div className="container-page">
          <div className="mb-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <span className="eyebrow">0{index + 2}</span>
              <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">{item[0]}</h2>
            </div>
            <p className="text-lg leading-relaxed text-white/64">{item[1]}</p>
          </div>
          <div className="mx-auto max-w-5xl">
            <DashboardVisual kind={visualKind} />
          </div>
        </div>
      </section>
    );
  }

  if (index === 6 || index === 9) {
    return (
      <section className="bg-[#071827] py-20 md:py-28">
        <div className="container-page grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <span className="eyebrow">0{index + 2}</span>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">{item[0]}</h2>
            <p className="mt-5 text-lg leading-relaxed text-white/64">{item[1]}</p>
          </div>
          <div className="relative border-l border-white/10 pl-6">
            {timelineSteps.map((step, stepIndex) => (
              <div key={step} className="relative pb-8 last:pb-0">
                <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-electric-bright shadow-glow" />
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-electric-bright">0{stepIndex + 1}</div>
                  <div className="mt-2 font-semibold text-white">{step}</div>
                  <p className="mt-2 text-sm text-white/55">{timelineText}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (index === 11) {
    return (
      <section className="bg-navy-deep py-16 md:py-20">
        <div className="container-page">
          <div className="mx-auto max-w-5xl text-center">
            <span className="eyebrow justify-center">0{index + 2}</span>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">{item[0]}</h2>
            <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-white/64">{item[1]}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {(lang === "tr" ? ["API hazır", "Rol bazlı", "Ölçeklenebilir modüller", "Veri akışı"] : ["API ready", "Role mapped", "Scalable modules", "Data flow"]).map((tag) => (
                <span key={tag} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/64">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={index % 2 === 0 ? "bg-[#071827] py-20 md:py-28" : "bg-navy-deep py-20 md:py-28"}>
      <div className={`container-page grid gap-12 lg:grid-cols-2 lg:items-center ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div>
          <span className="eyebrow">0{index + 2}</span>
          <h2 className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">{item[0]}</h2>
          <p className="mt-5 text-lg leading-relaxed text-white/64">{item[1]}</p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {tags.map((tag) => (
              <div key={tag} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/70 transition hover:border-electric-bright/40 hover:text-white">
                <CheckCircle2 className="mr-2 inline h-4 w-4 text-electric-bright" />
                {tag}
              </div>
            ))}
          </div>
        </div>
        <DashboardVisual kind={visualKind} />
      </div>
    </section>
  );
};

const HomePage = () => {
  const { lang } = useLang();
  const t = siteContent[lang];
  const sections = homeSections[lang];
  const [activeTab, setActiveTab] = useState(0);
  const tabs = lang === "tr"
    ? [
        ["ERP", "Operasyon, stok, finans ve sipariş süreçlerini yönetilebilir süreç modeli altında birleştirir."],
        ["CRM", "Satış hattı, teklif ve müşteri etkileşimlerini ölçülebilir performans göstergeleriyle izler."],
        ["AI-Yapay Zeka", "Karar destek katmanı; risk, öngörü ve öneri sinyallerini kurumsal veriyle üretir."],
        ["Veri Analizi", "Yönetim kontrol panelleri, veri bütünlüğünü karşılaştırılabilir göstergelere dönüştürür."],
      ]
    : [
        ["ERP", "Unifies operations, inventory, finance and order workflows under a manageable process model."],
        ["CRM", "Tracks sales pipeline, proposals and customer interactions through measurable indicators."],
        ["AI", "The decision-support layer produces risk, forecast and recommendation signals from enterprise data."],
        ["Data Analytics", "Management dashboards convert data integrity into comparable indicators."],
      ];

  return (
    <>
      <PageHero pageKey="home" />
      <section className="bg-navy-deep py-16">
        <div className="container-page">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <div className="grid gap-3 sm:grid-cols-2">
                {tabs.map((tab, index) => (
                  <button
                    key={tab[0]}
                    type="button"
                    onClick={() => setActiveTab(index)}
                    className={`rounded-xl border p-5 text-left transition hover:-translate-y-1 ${
                      activeTab === index ? "border-electric-bright/60 bg-electric/15 shadow-glow" : "border-white/10 bg-white/[0.04] hover:border-electric-bright/40"
                    }`}
                  >
                    <div className="text-xs uppercase tracking-[0.18em] text-white/45">{tab[0]}</div>
                    <div className="mt-3 text-3xl font-semibold text-white">{["94%", "38", "12", "7/24"][index]}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.05] p-8 backdrop-blur-xl">
              <div className="text-xs uppercase tracking-[0.18em] text-electric-bright">{tabs[activeTab][0]}</div>
              <h2 className="mt-4 text-2xl font-semibold text-white">{lang === "tr" ? "Kurumsal yazılım mimarisinde aktif katman" : "Active layer in enterprise software architecture"}</h2>
              <p className="mt-4 text-lg leading-relaxed text-white/64">{tabs[activeTab][1]}</p>
              <div className="mt-6 h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full bg-gradient-to-r from-electric to-electric-bright transition-all duration-500" style={{ width: `${[86, 68, 52, 74][activeTab]}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#061321] py-20 md:py-28">
        <div className="container-page">
          <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <span className="eyebrow">{sections[6][0]}</span>
              <h2 className="mt-4 text-3xl font-semibold text-white md:text-5xl">
                {lang === "tr" ? "Dijital Dönüşüm için yatay süreç mimarisi." : "A horizontal process architecture for Digital Transformation."}
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-white/58">{sections[6][1]}</p>
          </div>
          <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 md:p-8">
            <div className="absolute left-8 right-8 top-1/2 hidden h-px bg-gradient-to-r from-electric/20 via-electric-bright/70 to-electric/20 md:block" aria-hidden />
            <div className="relative grid gap-4 md:grid-cols-5">
              {(lang === "tr"
                ? ["Süreç analizi", "Mimari planlama", "Modül yapılandırma", "Veri modeli", "Ölçekleme"]
                : ["Process analysis", "Architecture planning", "Module configuration", "Data model", "Scaling"]).map((step, index) => (
                <div key={step} className="rounded-xl border border-white/10 bg-navy-deep/80 p-5 transition hover:-translate-y-1 hover:border-electric-bright/45">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-electric-bright/40 bg-electric/15 text-sm font-semibold text-electric-bright">{index + 1}</div>
                  <h3 className="mt-5 text-base font-semibold text-white">{step}</h3>
                  <div className="mt-4 h-1.5 rounded-full bg-white/10">
                    <div className="h-1.5 rounded-full bg-electric-bright" style={{ width: `${[48, 62, 74, 84, 92][index]}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#071827] py-20 md:py-28">
        <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-electric-bright/40 to-transparent" aria-hidden />
        <div className="container-page">
          <div className="mb-10 max-w-3xl">
            <span className="eyebrow">{lang === "tr" ? "Canlı kontrol mimarisi" : "Live control architecture"}</span>
            <h2 className="mt-4 text-3xl font-semibold text-white md:text-5xl">
              {lang === "tr" ? "Operasyonel veriyi tek yönetim yüzeyinde birleştiren geniş kontrol paneli." : "A wide control surface that unifies operational data."}
            </h2>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-5 shadow-elevated backdrop-blur-xl md:p-8">
            <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr_0.8fr]">
              <DashboardVisual kind="finance" />
              <DashboardVisual kind="analytics" />
              <div className="grid gap-4">
                {(lang === "tr" ? ["Canlı veri", "Öngörü", "Risk sinyali", "Performans uyarısı"] : ["Live data", "Forecast", "Risk signal", "KPI alert"]).map((label, index) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-navy-deep/70 p-4 transition hover:border-electric-bright/40">
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-electric-bright" />
                      <span className="text-sm font-medium text-white">{label}</span>
                    </div>
                    <div className="mt-3 h-1.5 rounded-full bg-white/10">
                      <div className="h-1.5 rounded-full bg-electric-bright" style={{ width: `${[86, 64, 48, 72][index]}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-navy-deep py-20 md:py-28">
        <div className="container-page">
          <div className="mb-10 max-w-3xl">
            <span className="eyebrow">{lang === "tr" ? "Farklı kontrol yüzeyleri" : "Distinct control surfaces"}</span>
            <h2 className="mt-4 text-3xl font-semibold text-white md:text-5xl">
              {lang === "tr" ? "CRM, stok ve AI-Yapay Zeka katmanları ayrı görsel mantıklarla çalışır." : "CRM, inventory and AI layers operate with distinct visual logic."}
            </h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:translate-y-8">
              <DashboardVisual kind="pipeline" />
            </div>
            <DashboardVisual kind="ai" />
            <div className="lg:-translate-y-8">
              <DashboardVisual kind="stock" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-navy-deep py-20 md:py-28">
        <div className="container-page">
          <div className="mb-10 max-w-3xl">
            <span className="eyebrow">{lang === "tr" ? "Modül etkileşimi" : "Module interaction"}</span>
            <h2 className="mt-4 text-3xl font-semibold text-white md:text-5xl">
              {lang === "tr" ? "Hover ile genişleyen modül kartları." : "Module cards that expand on hover."}
            </h2>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {(lang === "tr"
              ? [
                  ["ERP", "Operasyonel görünürlük", "Süreç mimarisi, stok, finans ve sipariş yönetimi aynı veri modeline bağlanır."],
                  ["CRM", "Satış hattı yönetimi", "Fırsat, teklif ve müşteri etkileşimleri ölçülebilir hale gelir."],
                  ["AI-Yapay Zeka", "Karar destek katmanı", "Risk, öngörü ve öneri sinyalleri kurumsal veriden üretilir."],
                  ["Veri Analizi", "Yönetici göstergeleri", "Performans göstergeleri karşılaştırılabilir kontrol panellerine taşınır."],
                ]
              : [
                  ["ERP", "Operational visibility", "Process architecture, inventory, finance and orders connect to one data model."],
                  ["CRM", "Pipeline management", "Opportunities, proposals and customer interactions become measurable."],
                  ["AI", "Decision-support layer", "Risk, forecast and recommendation signals are generated from enterprise data."],
                  ["Data Analytics", "Executive indicators", "Performance indicators move into comparable dashboards."],
                ]).map((card) => (
              <article key={card[0]} className="group min-h-48 rounded-xl border border-white/10 bg-white/[0.04] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-electric-bright/50 hover:bg-white/[0.08]">
                <div className="text-xs uppercase tracking-[0.18em] text-electric-bright">{card[0]}</div>
                <h3 className="mt-4 text-xl font-semibold text-white">{card[1]}</h3>
                <p className="mt-4 max-h-0 overflow-hidden text-sm leading-relaxed text-white/58 transition-all duration-300 group-hover:max-h-32">{card[2]}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#071827] py-20 md:py-28">
        <div className="container-page">
          <div className="mb-10 max-w-3xl">
            <span className="eyebrow">{lang === "tr" ? "Senaryo seçimi" : "Scenario selection"}</span>
            <h2 className="mt-4 text-3xl font-semibold text-white md:text-5xl">
              {lang === "tr" ? "Tıklanabilir kurumsal kullanım senaryoları." : "Clickable enterprise usage scenarios."}
            </h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {(lang === "tr"
              ? [
                  ["Satış yönetimi", "CRM satış hattı, teklif disiplini ve AI-Yapay Zeka öngörüleri birlikte çalışır."],
                  ["Finansal kontrol", "Nakit akışı, geciken tahsilat ve risk sinyalleri yönetim kontrol paneline taşınır."],
                  ["Saha operasyonu", "Mobil kayıtlar ERP, CRM ve Veri Analizi katmanlarına gerçek zamanlı aktarılır."],
                ]
              : [
                  ["Sales management", "CRM pipeline, proposal discipline and AI forecasts operate together."],
                  ["Financial control", "Cash flow, overdue collections and risk signals move into the management panel."],
                  ["Field operations", "Mobile records flow into ERP, CRM and Data Analytics layers in real time."],
                ]).map((scenario, index) => (
              <button key={scenario[0]} type="button" className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-left transition hover:-translate-y-1 hover:border-electric-bright/50 hover:bg-white/[0.08]">
                <div className="text-xs uppercase tracking-[0.18em] text-electric-bright">0{index + 1}</div>
                <h3 className="mt-4 text-xl font-semibold text-white">{scenario[0]}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/58">{scenario[1]}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-navy-deep py-20 md:py-28">
        <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <span className="eyebrow">{lang === "tr" ? "Veri akışı" : "Data flow"}</span>
            <h2 className="mt-4 text-3xl font-semibold text-white md:text-5xl">
              {lang === "tr" ? "Katmanlar arasında akan ölçeklenebilir mimari." : "Scalable architecture with flowing data between layers."}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-white/64">
              {lang === "tr" ? "ERP, CRM, AI-Yapay Zeka ve Veri Analizi katmanları rol bazlı erişim ve API hazır veri akışlarıyla birlikte çalışır." : "ERP, CRM, AI and Data Analytics layers operate with role-based access and API-ready data flows."}
            </p>
          </div>
          <DashboardVisual kind="architecture" />
        </div>
      </section>
      
      <section className="bg-[#071827] py-20 md:py-28">
        <div className="container-page grid gap-12 lg:grid-cols-2 lg:items-center">
          <DashboardVisual kind="mobile" />
          <div>
            <span className="eyebrow">{lang === "tr" ? "Mobil kullanım" : "Mobile usage"}</span>
            <h2 className="mt-4 text-3xl font-semibold text-white md:text-5xl">
              {lang === "tr" ? "Saha ve merkez arasında gerçek zamanlı operasyonel süreklilik." : "Real-time operational continuity between field and headquarters."}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-white/64">
              {lang === "tr" ? "Mobil kullanım, görev, stok, müşteri ve servis kayıtlarının kurumsal yazılım mimarisine doğrudan aktarılmasını sağlar." : "Mobile usage transfers task, inventory, customer and service records directly into the enterprise software architecture."}
            </p>
          </div>
        </div>
      </section>
      
      <section className="bg-navy-deep py-20 md:py-28">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <span className="eyebrow">{lang === "tr" ? "Güvenlik ve yetkilendirme" : "Security and permissions"}</span>
            <h2 className="mt-4 text-3xl font-semibold text-white md:text-5xl">
              {lang === "tr" ? "Rol bazlı erişim ile kontrollü veri görünürlüğü." : "Controlled data visibility through role-based access."}
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-white/64">
              {lang === "tr" ? "Kullanıcı rolleri, departman sorumlulukları ve veri erişim sınırları kurumsal güvenlik mimarisi içinde tanımlanır." : "User roles, department responsibilities and data access boundaries are defined within the enterprise security architecture."}
            </p>
          </div>
          <DashboardVisual kind="security" />
        </div>
      </section>

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
