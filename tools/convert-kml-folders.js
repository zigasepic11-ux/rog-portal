import fs from "fs";
import path from "path";
import { DOMParser } from "xmldom";
import { kml as toGeoJSON } from "@tmcw/togeojson";

/**
 * Usage:
 * node tools/convert-kml-folders.js data/boundaries-kml public/boundaries
 *
 * Input (example):
 * data/boundaries-kml/primorska/ld_izola.kml
 *
 * Output:
 * public/boundaries/primorska/ld_izola.geojson
 * + public/boundaries/manifest.json
 */

const inRoot = process.argv[2];
const outRoot = process.argv[3];

if (!inRoot || !outRoot) {
  console.log("Usage: node tools/convert-kml-folders.js <inRoot> <outRoot>");
  process.exit(1);
}

function listKmlFilesRecursive(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listKmlFilesRecursive(p));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".kml")) out.push(p);
  }
  return out;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function relPathNoExt(absPath, root) {
  const rel = path.relative(root, absPath);
  return rel.replace(/\.kml$/i, "");
}

ensureDir(outRoot);

const kmlFiles = listKmlFilesRecursive(inRoot);
const manifest = [];

let ok = 0;
let failed = 0;

for (const kmlFile of kmlFiles) {
  try {
    const relNoExt = relPathNoExt(kmlFile, inRoot); // e.g. primorska/ld_izola
    const outFile = path.join(outRoot, `${relNoExt}.geojson`);
    ensureDir(path.dirname(outFile));

    const kmlText = fs.readFileSync(kmlFile, "utf8");
    const dom = new DOMParser().parseFromString(kmlText, "text/xml");

    if (dom.getElementsByTagName("parsererror").length > 0) {
      throw new Error("Invalid XML / KML parse error");
    }

    const geo = toGeoJSON(dom);

    fs.writeFileSync(outFile, JSON.stringify(geo));
    manifest.push({
      region: relNoExt.split(path.sep)[0],              // primorska
      slug: relNoExt.split(path.sep).slice(1).join("/"),// ld_izola (ali podmape)
      kmlSource: kmlFile.replace(/\\/g, "/"),
      geojsonUrl: (`/boundaries/${relNoExt}.geojson`).replace(/\\/g, "/"),
    });

    ok++;
    console.log("✅", kmlFile, "->", outFile);
  } catch (e) {
    failed++;
    console.log("❌", kmlFile, "-", e?.message || String(e));
  }
}

manifest.sort((a, b) =>
  (a.region + "/" + a.slug).localeCompare(b.region + "/" + b.slug, "sl")
);

fs.writeFileSync(path.join(outRoot, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log("\nDone.");
console.log("Converted:", ok);
console.log("Failed:", failed);
console.log("Manifest:", path.join(outRoot, "manifest.json"));
