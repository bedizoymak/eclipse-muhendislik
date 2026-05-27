const adminRoot = import.meta.env.MODE === "erp" ? "" : "/admin";

export const adminLoginPath = `${adminRoot}/giris` || "/giris";

export function adminPath(path = "") {
  return `${adminRoot}${path}` || "/";
}
