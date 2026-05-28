import { useLocation, useNavigate } from "react-router-dom";
import { useLang } from "@/i18n/LanguageContext";
import type { Lang } from "@/i18n/translations";
import { routes, type PageKey } from "@/content/site";

const findPageKey = (pathname: string): PageKey => {
  for (const lang of ["tr", "en"] as const) {
    const match = Object.entries(routes[lang]).find(([, path]) => path === pathname);
    if (match) return match[0] as PageKey;
  }
  return "home";
};

export const LanguageSwitcher = (_props: { light?: boolean }) => {
  const { lang, setLang } = useLang();
  const navigate = useNavigate();
  const location = useLocation();

  const changeLanguage = (next: Lang) => {
    const key = findPageKey(location.pathname);
    setLang(next);
    navigate(routes[next][key]);
  };

  return (
    <div className="inline-flex rounded-md border border-white/12 bg-white/[0.04] p-1 text-xs font-semibold text-white/70">
      {(["tr", "en"] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => changeLanguage(item)}
          className={`rounded px-2.5 py-1 transition ${lang === item ? "bg-electric text-white" : "hover:text-white"}`}
        >
          {item.toUpperCase()}
        </button>
      ))}
    </div>
  );
};
