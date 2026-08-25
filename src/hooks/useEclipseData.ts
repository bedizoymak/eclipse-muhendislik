import { defaultProjects, defaultServices } from "@/lib/eclipseContent";

export function usePublicServices() {
  return { services: defaultServices, loading: false };
}

export function usePublicProjects() {
  return { projects: defaultProjects, loading: false };
}
