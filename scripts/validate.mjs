import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extension = path.join(root, "extension");
const failures = [];
const fail = message => failures.push(message);
const exists = rel => fs.existsSync(path.join(root, rel));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const VERSION = packageJson.version;
const siteLinks = JSON.parse(fs.readFileSync(path.join(root, "scripts", "site-links.json"), "utf8"));

const required = [
  "extension/manifest.json","extension/lib/core.js","extension/THIRD_PARTY_NOTICES.txt","extension/fonts/OFL.txt","extension/background.js","extension/popup/popup.html","extension/popup/popup.js",
  "extension/options/options.html","extension/options/options.js","extension/onboarding/onboarding.html","extension/onboarding/onboarding.js",
  "extension/notification/notification.html","extension/notification/notification.js","extension/content/content.js",
  "AMO_SUBMISSION.md","STORE_LISTING.md","RELEASE_NOTES.md","SECURITY.md","PRIVACY.md","QUALITY_GATE.md"
];
for (const rel of required) if (!exists(rel)) fail(`Missing required file: ${rel}`);

const manifest = JSON.parse(fs.readFileSync(path.join(extension, "manifest.json"), "utf8"));
if (manifest.version !== VERSION) fail(`Manifest version is ${manifest.version}, expected ${VERSION}`);
if (manifest.homepage_url !== siteLinks.publicSiteUrl) fail("Manifest homepage_url must match scripts/site-links.json");
if (!fs.readFileSync(path.join(extension, "options", "options.html"), "utf8").includes(`href="${siteLinks.publicSiteUrl}"`)) fail("Options page website link must match scripts/site-links.json");
if (!fs.readFileSync(path.join(extension, "options", "options.html"), "utf8").includes(`href="${siteLinks.supportPageUrl}"`)) fail("Options page support link must match scripts/site-links.json");
if (manifest.manifest_version !== 3) fail("Manifest must use Manifest V3");
if (!manifest.background?.scripts?.includes("background.js")) fail("Firefox background.scripts missing");
if (!manifest.permissions?.includes("scripting")) fail("Scripting permission missing");
if (!manifest.optional_host_permissions?.length) fail("Optional host permissions missing");
if (manifest.content_scripts) fail("Static content_scripts must not be used; in-page injection is runtime/permission based");
if (!manifest.content_security_policy?.extension_pages?.includes("script-src 'self'")) fail("Extension CSP must restrict scripts to self");
if (!manifest.browser_specific_settings?.gecko?.id) fail("Firefox MV3 publishing requires browser_specific_settings.gecko.id");
if (manifest.browser_specific_settings.gecko.id.includes("example") || manifest.browser_specific_settings.gecko.id.includes("local")) fail("Gecko ID still contains a placeholder domain");
if (JSON.stringify(manifest).includes("example.com")) fail("Manifest still contains an example.com placeholder");

const jsFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith(".js")) jsFiles.push(full);
  }
}
walk(extension);
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) fail(`JavaScript syntax error: ${path.relative(root, file)}\n${result.stderr}`);
  const source = fs.readFileSync(file, "utf8");
  if (/\beval\s*\(|\bnew\s+Function\s*\(|\bWebSocket\s*\(|\bXMLHttpRequest\b/.test(source)) fail(`Disallowed dynamic/network API found in ${path.relative(root, file)}`);
}

for (const icon of ["16", "32", "48", "96", "128"]) {
  if (!fs.existsSync(path.join(extension, "icons", `icon-${icon}.png`))) fail(`Missing PNG icon: extension/icons/icon-${icon}.png`);
}

function checkLocalRefs(file) {
  const html = fs.readFileSync(file, "utf8");
  const refs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m => m[1]);
  for (const ref of refs) {
    if (/^(?:https?:|mailto:|#|data:|javascript:)/i.test(ref)) continue;
    if (ref === `../dist/vmes-firefox-extension-v${VERSION}.xpi`) continue;
    const target = path.resolve(path.dirname(file), ref.split("#")[0].split("?")[0]);
    if (!fs.existsSync(target)) fail(`Broken local ref in ${path.relative(root, file)}: ${ref}`);
  }
}
for (const dir of ["popup","options","onboarding","notification","content","exercises"]) {
  const abs = path.join(extension, dir);
  for (const name of fs.readdirSync(abs)) if (name.endsWith(".html")) checkLocalRefs(path.join(abs, name));
}
for (const htmlRel of ["extension/popup/popup.html","extension/options/options.html","extension/onboarding/onboarding.html","extension/notification/notification.html"]) {
  const html = fs.readFileSync(path.join(root, htmlRel), "utf8");
  if (/\son[a-z]+\s*=\s*["']/.test(html)) fail(`Inline event handler found in ${htmlRel}`);
}

for (const htmlRel of ["extension/popup/popup.html","extension/options/options.html","extension/onboarding/onboarding.html","extension/notification/notification.html","extension/exercises/breathing.html"]) {
  const html = fs.readFileSync(path.join(root, htmlRel), "utf8");
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  for (const id of new Set(duplicates)) fail(`Duplicate HTML id in ${htmlRel}: ${id}`);
  if (/TODO|FIXME|example\.com|placeholder\.invalid/i.test(html)) fail(`Placeholder/TODO text found in ${htmlRel}`);
}

if (!manifest.description || manifest.description.length < 20) fail("Manifest description is missing or too short");
if (!manifest.author) fail("Manifest author is missing");

const packageFiles = [];
function walkAll(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkAll(full); else packageFiles.push(path.relative(root, full));
  }
}
walkAll(root);
if (packageFiles.some(f => f.includes("node_modules/"))) fail("node_modules must not be committed to the project package");

if (failures.length) {
  console.error(`Validation failed with ${failures.length} issue(s):\n` + failures.map(x => `- ${x}`).join("\n"));
  process.exit(1);
}
console.log(`Vmes ${VERSION} validation passed. JS files checked: ${jsFiles.length}.`);
