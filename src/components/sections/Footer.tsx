import { Mail, MessageCircle, Phone } from "lucide-react";
import { Logo } from "@/components/Logo";
import { CONTACT } from "@/i18n/translations";

const platformLinks = [
  { label: "Çözümler", href: "#solutions" },
  { label: "Modüller", href: "#modules" },
  { label: "Yapay Zeka", href: "#ai" },
  { label: "Sektörler", href: "#industries" },
  { label: "Demo", href: "#contact" },
];

export const Footer = () => {
  return (
    <footer className="border-t border-white/10 bg-navy-deep text-white/70">
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_0.8fr_1fr]">
          <div>
            <Logo light size="footer" className="inline-flex" />
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/55">
              Eclipse; ERP, CRM ve Yapay Zeka modülleriyle işletmeleri tek panelden yöneten modüler iş sistemi.
            </p>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-white">Platform</h4>
            <ul className="mt-5 space-y-3 text-sm">
              {platformLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-white">İletişim</h4>
            <ul className="mt-5 space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-electric-bright" />
                <a href={`tel:${CONTACT.phoneTel}`} className="hover:text-white">{CONTACT.phone}</a>
              </li>
              <li className="flex items-start gap-2.5">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-electric-bright" />
                <a href={CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  WhatsApp
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-electric-bright" />
                <a href={`mailto:${CONTACT.email}`} className="break-all hover:text-white">{CONTACT.email}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/42 sm:flex-row">
          <p>© {new Date().getFullYear()} {CONTACT.company}. Tüm hakları saklıdır.</p>
          <a href="https://erp.eclipsemuhendislik.com/giris" className="hover:text-white">ERP Girişi</a>
        </div>
      </div>
    </footer>
  );
};
