import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const pageRegistryPath = path.join(repoRoot, "features", "help", "page-help-registry.ts");
const walkthroughPath = path.join(repoRoot, "features", "help", "walkthrough-registry.ts");
const termPath = path.join(repoRoot, "features", "help", "term-registry.ts");

function extractRoutes(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return [...source.matchAll(/route:\s*"([^"]+)"/g)].map((match) => match[1]);
}

function extractTerms(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  return [...source.matchAll(/term:\s*"([^"]+)"/g)].map((match) => match[1]);
}

function routeExists(route) {
  const normalized = route === "/" ? ["app/page.tsx"] : [
    `app${route}/page.tsx`,
    `app${route}/route.ts`,
  ];
  return normalized.some((relativePath) => fs.existsSync(path.join(repoRoot, relativePath)));
}

const pageRoutes = extractRoutes(pageRegistryPath);
const walkthroughRoutes = extractRoutes(walkthroughPath);
const terms = extractTerms(termPath);

const missingPageRoutes = pageRoutes.filter((route) => !routeExists(route));
const missingWalkthroughRoutes = walkthroughRoutes.filter((route) => !routeExists(route));

if (missingPageRoutes.length > 0) {
  console.error("Missing help routes:", missingPageRoutes.join(", "));
  process.exit(1);
}

if (missingWalkthroughRoutes.length > 0) {
  console.error("Missing walkthrough routes:", missingWalkthroughRoutes.join(", "));
  process.exit(1);
}

if (terms.length === 0) {
  console.error("No help terms were found in term registry.");
  process.exit(1);
}

console.log(`Validated ${pageRoutes.length} help routes, ${walkthroughRoutes.length} walkthrough routes, and ${terms.length} glossary terms.`);
