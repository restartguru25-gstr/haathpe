/**
 * Generate PWA PNG icons from public/icons/icon.svg (orange "h" logo).
 * Run: node scripts/generate-pwa-icons.mjs
 * Requires: npm install -D sharp
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "public", "icons", "icon.svg");
const outDir = join(root, "public", "icons");

const sizes = [
  { size: 180, name: "apple-touch-icon.png" },
  { size: 192, name: "icon-192.png" },
  { size: 512, name: "icon-512.png" },
  { size: 120, name: "icon-120.png" },
  { size: 152, name: "icon-152.png" },
];

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.warn("Run: npm install -D sharp");
    process.exit(1);
  }
  if (!existsSync(svgPath)) {
    console.warn("Missing public/icons/icon.svg");
    process.exit(1);
  }
  const svg = readFileSync(svgPath);
  for (const { size, name } of sizes) {
    const buf = await sharp(svg).resize(size, size).png().toBuffer();
    writeFileSync(join(outDir, name), buf);
    console.log("Wrote", name);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
