/**
 * Converts any PNG/JPG files in public/article-heroes/ to WebP at display-appropriate
 * dimensions, then regenerates public/article-heroes/manifest.json.
 *
 * Run: node scripts/prep-hero-images.mjs
 * Hooked into: npm run build (via "prebuild") and npm run generate:hero-manifest
 */

import { createRequire } from "module";
import { readdirSync, statSync, existsSync, rmSync, writeFileSync } from "fs";
import { join, extname, basename } from "path";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const HEROES_DIR = "public/article-heroes";
const ASPECT_RATIOS = ["16_9", "3_4", "1_1"];
const KNOWN_CATEGORIES = [
  "consumer-electronics",
  "culture-entertainment",
  "digest-cover",
  "finance",
  "food-dining",
  "general-news",
  "industry-news",
  "programming-software",
  "retail-commerce",
  "science-technology",
  "travel",
];

const RATIO_DIMENSIONS = {
  "16_9": { width: 1440, height: 810 },
  "3_4": { width: 600, height: 800 },
  "1_1": { width: 600, height: 600 },
};

const SOURCE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg"]);

async function convertImages() {
  let converted = 0;

  for (const cat of readdirSync(HEROES_DIR)) {
    const catPath = join(HEROES_DIR, cat);
    if (!statSync(catPath).isDirectory() || cat.startsWith(".")) continue;

    if (!KNOWN_CATEGORIES.includes(cat)) {
      console.warn(`Warning: unknown category dir "${cat}" — add to KNOWN_CATEGORIES if intentional`);
    }

    for (const ratio of ASPECT_RATIOS) {
      const ratioPath = join(catPath, ratio);
      if (!existsSync(ratioPath)) continue;

      const dims = RATIO_DIMENSIONS[ratio];

      for (const file of readdirSync(ratioPath)) {
        if (file.startsWith(".")) continue;
        const ext = extname(file).toLowerCase();
        if (!SOURCE_EXTENSIONS.has(ext)) continue;

        const src = join(ratioPath, file);
        const dest = join(ratioPath, basename(file, ext) + ".webp");

        await sharp(src)
          .resize(dims.width, dims.height, { fit: "cover", position: "centre" })
          .webp({ quality: 82 })
          .toFile(dest);

        rmSync(src);
        console.log(`  converted: ${src} → ${dest}`);
        converted++;
      }
    }
  }

  if (converted > 0) console.log(`\nConverted ${converted} image(s) to WebP.`);
  return converted;
}

function generateManifest() {
  const categories = {};

  for (const cat of readdirSync(HEROES_DIR)) {
    const catPath = join(HEROES_DIR, cat);
    if (!statSync(catPath).isDirectory() || cat.startsWith(".")) continue;

    categories[cat] = {};

    for (const ratio of ASPECT_RATIOS) {
      const ratioPath = join(catPath, ratio);
      let files = [];
      if (existsSync(ratioPath)) {
        files = readdirSync(ratioPath)
          .filter((f) => f.endsWith(".webp") && !f.startsWith("."))
          .map((f) => `${cat}/${ratio}/${f}`);
      }
      categories[cat][ratio] = files;
    }
  }

  const manifest = {
    version: 1,
    generated: new Date().toISOString(),
    categories,
  };

  const outPath = join(HEROES_DIR, "manifest.json");
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");

  const totalImages = Object.values(categories).flatMap(Object.values).flat().length;
  console.log(`Manifest written → ${outPath} (${totalImages} image(s) across ${Object.keys(categories).length} categories)`);
}

console.log("Preparing article hero images…");
await convertImages();
generateManifest();
