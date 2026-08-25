import { translations } from "@/i18n/translations";

export type ServiceItem = {
  title: string;
  short_description: string;
  detail_description: string;
};

export type ProjectItem = {
  title: string;
  category: string;
  short_description: string;
  detail_description: string;
};

export const defaultServices: ServiceItem[] = translations.tr.services.items.map((item) => ({
  title: item.title,
  short_description: item.desc,
  detail_description: item.desc,
}));

export const defaultProjects: ProjectItem[] = translations.tr.cases.items.map((item) => ({
  title: item.company,
  category: item.sector,
  short_description: item.challenge,
  detail_description: `${item.challenge}\n\nSonuç: ${item.outcome}`,
}));

export function normalizeWhatsapp(value: string) {
  return value.replace(/\D/g, "");
}

export function getWhatsappUrl(value: string) {
  return `https://wa.me/${normalizeWhatsapp(value)}`;
}
