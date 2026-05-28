import { Mail, MessageCircle, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useLang } from "@/i18n/LanguageContext";
import { CONTACT } from "@/i18n/translations";
import { erpLoginUrl, navKeys, routes, siteContent } from "@/content/site";

export const Footer = () => {
  const { lang } = useLang();
  const t = siteContent[lang];

  return (
    <footer className="border-t border-white/10 bg-navy-deep text-white/70">
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_0.9fr_1fr]">
          <div>
            <Link to={routes[lang].home}>
              <Logo light size="footer" className="inline-flex" />
            </Link>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/55">
              {lang === "tr"
                ? "Eclipse; ERP, CRM, AI-Yapay Zeka, Veri Analizi ve Dijital Dönüşüm çözümleri geliştiren kurumsal yazılım mühendisliği şirketidir."
                : "Eclipse is an enterprise software engineering company building ERP, CRM, AI, Data Analytics and Digital Transformation solutions."}
            </p>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-white">Platform</h4>
            <ul className="mt-5 space-y-3 text-sm">
              {navKeys.map((key) => (
                <li key={key}>
                  <Link to={routes[lang][key]} className="transition-colors hover:text-white">
                    {t.nav[key]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-white">{t.nav.contact}</h4>
            <ul className="mt-5 space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-electric-bright" />
                <a href={`tel:${CONTACT.phoneTel}`} className="hover:text-white">{CONTACT.phone}</a>
              </li>
              <li className="flex items-start gap-2.5">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-electric-bright" />
                <a href={CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">WhatsApp</a>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-electric-bright" />
                <a href={`mailto:${CONTACT.email}`} className="break-all hover:text-white">{CONTACT.email}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/42 sm:flex-row">
          <p>© {new Date().getFullYear()} {CONTACT.company}. {lang === "tr" ? "Tüm hakları saklıdır." : "All rights reserved."}</p>
          <a href={erpLoginUrl} className="hover:text-white">{t.nav.erp}</a>
        </div>
      </div>
    </footer>
  );
};
