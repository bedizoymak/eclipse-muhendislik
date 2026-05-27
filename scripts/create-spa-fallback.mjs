import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve("dist");
const indexPath = resolve(distDir, "index.html");
const fallbackPath = resolve(distDir, "404.html");

if (existsSync(indexPath)) {
  copyFileSync(indexPath, fallbackPath);
}
