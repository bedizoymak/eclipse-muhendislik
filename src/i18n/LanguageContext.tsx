import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { translations, type Lang, type Translations } from "./translations";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
};

const STORAGE_KEY = "eclipse.lang";
const LanguageContext = createContext<Ctx | undefined>(undefined);

const detectLanguage = (): Lang => {
  if (typeof window === "undefined") return "en";

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "tr" || saved === "en") return saved;

  const locale = window.navigator.language.toLowerCase();
  const languages = window.navigator.languages?.map((item) => item.toLowerCase()) ?? [];
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isTurkey = locale.startsWith("tr") || languages.some((item) => item.startsWith("tr")) || timezone === "Europe/Istanbul";

  return isTurkey ? "tr" : "en";
};

export const getSavedLanguage = () => {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "tr" || saved === "en" ? saved : null;
};

export const getDetectedLanguage = detectLanguage;

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => detectLanguage());

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<Ctx>(() => {
    const setLang = (next: Lang) => {
      window.localStorage.setItem(STORAGE_KEY, next);
      setLangState(next);
    };

    return { lang, setLang, t: translations[lang] };
  }, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLang = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
};
