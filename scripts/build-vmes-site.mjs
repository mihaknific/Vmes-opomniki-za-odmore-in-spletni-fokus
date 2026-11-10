import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extension = path.join(root, "extension");
const output = path.join(root, "dist", "vmes-site");
const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const navigationTemplatePath = path.join(extension, "vmes-navigation.html");
const siteLinks = JSON.parse(fs.readFileSync(path.join(root, "scripts", "site-links.json"), "utf8"));

if (!output.startsWith(`${path.join(root, "dist")}${path.sep}`)) {
  throw new Error("Vmes site output path must stay inside dist.");
}

if (fs.existsSync(output)) fs.rmSync(output, { recursive: true, force: true });

function copyFile(source, target) {
  if (!fs.existsSync(source)) throw new Error(`Missing Vmes site source: ${path.relative(root, source)}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) throw new Error(`Missing Vmes site source: ${path.relative(root, source)}`);
  fs.cpSync(source, target, { recursive: true });
}

function writeRoute(route, filename, content) {
  const target = path.join(output, route, "index.html");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  console.log(`  ${route || "/"} -> ${path.relative(root, target)}`);
}

function renderNavigation(page) {
  const pageDetails = {
    home: { section: "Vmes za Firefox", prefix: "", active: "" },
    breathing: { section: "Dihanje", prefix: "../", active: "breathing" },
    eyes: { section: "Vaje za oči", prefix: "../", active: "eyes" },
    movement: { section: "Gibanje", prefix: "../", active: "movement" }
  }[page];
  if (!pageDetails) throw new Error(`Unknown Vmes navigation page: ${page}`);

  const template = fs.readFileSync(navigationTemplatePath, "utf8");
  const activeAttributes = name => pageDetails.active === name
    ? { className: " active", current: ' aria-current="page"' }
    : { className: "", current: "" };
  const breathing = activeAttributes("breathing");
  const eyes = activeAttributes("eyes");
  const movement = activeAttributes("movement");
  const homeLink = pageDetails.prefix || "./";
  const settingsButton = page === "breathing"
    ? '<button id="settings-nav-btn" class="nav-btn breathing-settings-nav-button" type="button" aria-label="Prikaži nastavitve dihanja" aria-controls="settings-content" aria-expanded="false" title="Nastavitve dihanja"><svg class="breathing-settings-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="var(--surface)"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><circle cx="10" cy="18" r="2" fill="var(--surface)"/></svg></button>'
    : "";
  const addonNavigation = page === "home"
    ? `<a href="${pageDetails.prefix}#namestitev" class="nav-btn nav-btn-addon" aria-label="Več o Firefox dodatku" title="Več o Firefox dodatku"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3"/><path d="M8 12h8m-4-4v8"/></svg><span>Dodatek</span></a>`
    : "";

  return template
    .replaceAll("{{HOME_LINK}}", homeLink)
    .replaceAll("{{LOGO_PATH}}", `${pageDetails.prefix}extension/icons/icon-48.svg?v=20261029-2`)
    .replaceAll("{{SECTION}}", pageDetails.section)
    .replaceAll("{{BREATHING_LINK}}", `${pageDetails.prefix}dihanje/`)
    .replaceAll("{{EYES_LINK}}", `${pageDetails.prefix}oci/`)
    .replaceAll("{{MOVEMENT_LINK}}", `${pageDetails.prefix}gibanje/`)
    .replaceAll("{{ADDON_NAVIGATION}}", addonNavigation)
    .replaceAll("{{BREATHING_ACTIVE}}", breathing.className)
    .replaceAll("{{BREATHING_CURRENT}}", breathing.current)
    .replaceAll("{{EYES_ACTIVE}}", eyes.className)
    .replaceAll("{{EYES_CURRENT}}", eyes.current)
    .replaceAll("{{MOVEMENT_ACTIVE}}", movement.className)
    .replaceAll("{{MOVEMENT_CURRENT}}", movement.current)
    .replaceAll("{{SETTINGS_BUTTON}}", settingsButton);
}

function replaceHeader(html, page, headerClass) {
  const headerPattern = new RegExp(`<header class="[^"]*${headerClass}[^"]*">[\\s\\S]*?<\\/header>`);
  const updated = html.replace(headerPattern, renderNavigation(page));
  if (updated === html) throw new Error(`Could not insert shared navigation in ${page}.`);
  return updated;
}

function buildExerciseRoute(route, page, script) {
  const pagePath = path.join(extension, "exercises", page);
  if (!fs.existsSync(pagePath)) throw new Error(`Missing Vmes exercise page: ${page}`);

  const pageType = { "breathing.html": "breathing", "eyes.html": "eyes", "stretches.html": "movement" }[page];
  if (!pageType) throw new Error(`Unknown Vmes exercise page: ${page}`);

  const html = replaceHeader(fs.readFileSync(pagePath, "utf8"), pageType, "top-bar")
    .replace('href="exercises.css"', 'href="../assets/exercises.css"')
    .replace('href="../lib/appearance.css"', 'href="../assets/appearance.css"')
    .replace('href="../index.html"', 'href="../"')
    .replace('href="breathing.html"', 'href="../dihanje/"')
    .replace('href="eyes.html"', 'href="../oci/"')
    .replace('href="stretches.html"', 'href="../gibanje/"')
    .replaceAll('src="images/', 'src="../images/')
    .replaceAll('src="../lib/appearance.js"', 'src="../assets/appearance.js"')
    .replaceAll('src="../lib/sounds.js"', 'src="../assets/sounds.js"')
    .replaceAll('src="tab-controls.js"', 'src="../assets/tab-controls.js"')
    .replaceAll('src="breathing-preferences.js"', 'src="../assets/breathing-preferences.js"')
    .replaceAll(`src="${script}"`, `src="../assets/${script}"`);

  if (html.includes('href="exercises.css"')
    || html.includes('href="../index.html"')
    || html.includes('href="../lib/appearance.css"')
    || html.includes('src="../lib/')
    || html.includes('src="tab-controls.js"')
    || html.includes('src="breathing-preferences.js"')
    || html.includes(`src="${script}"`)) {
    throw new Error(`Could not rewrite all standalone links in ${page}.`);
  }
  writeRoute(route, page, html);
}

fs.mkdirSync(output, { recursive: true });

let homepage = replaceHeader(fs.readFileSync(path.join(extension, "index.html"), "utf8"), "home", "site-header")
  .replaceAll('href="https://addons.mozilla.org/en-US/firefox/addon/spletni-opomnik/"', `href="${siteLinks.addonListingUrl}"`)
  .replaceAll('href="exercises/breathing.html"', 'href="dihanje/"')
  .replaceAll('href="exercises/eyes.html"', 'href="oci/"')
  .replaceAll('href="exercises/stretches.html"', 'href="gibanje/"')
  .replaceAll('src="exercises/breathing.html"', 'src="dihanje/"')
  .replace('src="vmes-home.js"', 'src="assets/vmes-home.js"')
  .replace('href="lib/appearance.css"', 'href="assets/appearance.css"')
  .replaceAll('src="exercises/images/vmes-popup-preview.png"', 'src="images/vmes-popup-preview.png"')
  .replaceAll('src="exercises/images/vmes-site-limit-preview.png"', 'src="images/vmes-site-limit-preview.png"')
  .replaceAll('href="https://github.com/mihaknific/Vmes-opomniki-za-odmore-in-spletni-fokus"', `href="${siteLinks.repositoryUrl}"`)
  .replaceAll('href="https://mihaknific.github.io/podpora.html"', `href="${siteLinks.supportPageUrl}"`);
if (/href="(?:exercises\/|website\/|lib\/appearance\.css)|src="exercises\/|href="[^"]*dodatek\//.test(homepage)) {
  throw new Error("Could not rewrite all standalone Vmes homepage links.");
}
fs.writeFileSync(path.join(output, "index.html"), homepage, "utf8");
copyFile(path.join(extension, "vmes.css"), path.join(output, "vmes.css"));
copyFile(path.join(extension, "vmes-navigation.css"), path.join(output, "vmes-navigation.css"));
copyFile(path.join(extension, "vmes-home.js"), path.join(output, "assets", "vmes-home.js"));

buildExerciseRoute("dihanje", "breathing.html", "breathing.js");
buildExerciseRoute("oci", "eyes.html", "eyes.js");
buildExerciseRoute("gibanje", "stretches.html", "stretches.js");

const assets = path.join(output, "assets");
fs.mkdirSync(assets, { recursive: true });
for (const file of [
  "exercises/exercises.css",
  "exercises/breathing.js",
  "exercises/breathing-preferences.js",
  "exercises/eyes.js",
  "exercises/stretches.js",
  "exercises/tab-controls.js",
  "lib/appearance.js",
  "lib/appearance.css",
  "lib/sounds.js"
]) {
  const targetName = path.basename(file);
  let contents = fs.readFileSync(path.join(extension, file), "utf8");
  if (file.startsWith("exercises/") && file.endsWith(".js")) {
    contents = contents.replaceAll("images/", "../images/");
  }
  copyFile(path.join(extension, file), path.join(assets, targetName));
  if (contents !== fs.readFileSync(path.join(extension, file), "utf8")) {
    fs.writeFileSync(path.join(assets, targetName), contents, "utf8");
  }
}

copyDirectory(path.join(extension, "exercises", "images"), path.join(output, "images"));
copyDirectory(path.join(extension, "fonts"), path.join(output, "fonts"));
copyDirectory(path.join(extension, "sounds"), path.join(output, "sounds"));

copyDirectory(path.join(extension, "icons"), path.join(output, "icons"));
copyDirectory(path.join(extension, "icons"), path.join(output, "extension", "icons"));

const legacyAddonRoute = path.join(output, "dodatek", "index.html");
fs.mkdirSync(path.dirname(legacyAddonRoute), { recursive: true });
fs.writeFileSync(legacyAddonRoute, `<!doctype html>
<html lang="sl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/svg+xml" href="../icons/icon-96.svg?v=20261029-2">
  <meta http-equiv="refresh" content="0; url=../index.html#namestitev">
  <link rel="canonical" href="../index.html#namestitev">
  <title>Vmes — vse na eni strani</title>
</head>
<body>
  <p>Vsebina dodatka Vmes je zdaj na domači strani. <a href="../index.html#namestitev">Odpri namestitev in podrobnosti</a>.</p>
</body>
</html>
`, "utf8");

fs.writeFileSync(path.join(output, ".nojekyll"), "", "utf8");
console.log(`Vmes site built to ${path.relative(root, output)}.`);
