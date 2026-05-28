import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "./Logo";
import { useLang } from "@/i18n/LanguageContext";
import { erpLoginUrl, navKeys, routes, siteContent } from "@/content/site";

export const Header = () => {
  const { lang } = useLang();
  const t = siteContent[lang];
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? "border-b border-white/10 bg-navy-deep/88 shadow-soft backdrop-blur-xl" : "bg-transparent"}`}>
      <div className="container-page flex h-16 items-center justify-between md:h-20 lg:h-[5.5rem]">
        <Link to={routes[lang].home} aria-label="Eclipse">
          <Logo light />
        </Link>

        <nav className="hidden items-center gap-1 xl:flex">
          {navKeys.map((key) => (
            <Link key={key} to={routes[lang][key]} className="rounded-md px-2.5 py-2 text-sm font-medium text-white/76 transition-colors hover:text-white">
              {t.nav[key]}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <LanguageSwitcher light />
          <Button variant="outline-light" size="sm" asChild>
            <a href={erpLoginUrl}>{t.nav.erp}</a>
          </Button>
          <Button variant="hero" size="sm" asChild>
            <Link to={routes[lang].contact}>{t.nav.demo}</Link>
          </Button>
        </div>

        <button aria-label="Menüyü aç" className="p-2 -mr-2 text-white xl:hidden" onClick={() => setOpen((value) => !value)}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-navy-deep/96 backdrop-blur-xl xl:hidden">
          <nav className="container-page flex flex-col gap-1 py-4">
            {navKeys.map((key) => (
              <Link key={key} to={routes[lang][key]} onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-sm font-semibold text-white/82 hover:bg-white/5 hover:text-white">
                {t.nav[key]}
              </Link>
            ))}
            <a href={erpLoginUrl} onClick={() => setOpen(false)} className="rounded-md px-3 py-3 text-sm font-semibold text-white/82 hover:bg-white/5 hover:text-white">
              {t.nav.erp}
            </a>
            <div className="mt-3 flex items-center justify-between gap-3">
              <LanguageSwitcher light />
              <Button variant="hero" size="sm" asChild>
                <Link to={routes[lang].contact} onClick={() => setOpen(false)}>{t.nav.demo}</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
