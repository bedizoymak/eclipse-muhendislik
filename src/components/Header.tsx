import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./Logo";

const nav = [
  { label: "Çözümler", href: "#solutions" },
  { label: "Modüller", href: "#modules" },
  { label: "Sektörler", href: "#industries" },
  { label: "Süreç", href: "#process" },
  { label: "Demo", href: "#contact" },
];

const erpLoginUrl = "https://erp.eclipsemuhendislik.com/giris";

export const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "border-b border-white/10 bg-navy-deep/88 shadow-soft backdrop-blur-xl" : "bg-transparent"
      }`}
    >
      <div className="container-page flex h-16 items-center justify-between md:h-20 lg:h-[5.5rem]">
        <Logo light />

        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-white/76 transition-colors hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Button variant="outline-light" size="sm" asChild>
            <a href={erpLoginUrl}>ERP Girişi</a>
          </Button>
          <Button variant="hero" size="sm" asChild>
            <a href="#contact">Demo Talep Et</a>
          </Button>
        </div>

        <button
          aria-label="Menüyü aç"
          className="p-2 -mr-2 text-white lg:hidden"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-navy-deep/96 backdrop-blur-xl lg:hidden">
          <nav className="container-page flex flex-col gap-1 py-4">
            {nav.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-sm font-semibold text-white/82 hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </a>
            ))}
            <a
              href={erpLoginUrl}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-3 text-sm font-semibold text-white/82 hover:bg-white/5 hover:text-white"
            >
              ERP Girişi
            </a>
            <Button variant="hero" size="sm" className="mt-3" asChild>
              <a href="#contact" onClick={() => setOpen(false)}>Demo Talep Et</a>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
};
