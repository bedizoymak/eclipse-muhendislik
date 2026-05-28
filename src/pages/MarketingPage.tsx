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

const StandardPage = ({ pageKey }: { pageKey: PageKey }) => {
  const { lang } = useLang();
  const t = siteContent[lang];

  if (pageKey === "contact") return <ContactPage />;

  const content =
    pageKey === "solutions" || pageKey === "home" ? t.solutionCards :
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
          {pageKey === "home" && <p className="mb-12 max-w-4xl text-xl leading-relaxed text-white/70">{t.pages.home.intro}</p>}
          {pageKey === "solutions" && <p className="mb-12 max-w-4xl text-xl leading-relaxed text-white/70">{t.pages.solutions.intro}</p>}
          <Cards items={content} />
        </div>
      </section>
      {pageKey !== "home" && (
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
