import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createVmesSiteServer } from "./serve-vmes-site.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = path.join(root, "dist", "vmes-site");
const siteLinks = JSON.parse(fs.readFileSync(path.join(root, "scripts", "site-links.json"), "utf8"));

const read = relativePath => fs.readFileSync(path.join(site, relativePath), "utf8");
const exists = relativePath => fs.existsSync(path.join(site, relativePath));

assert.ok(exists("index.html"), "Vmes homepage should be at the published site root");
assert.ok(exists("dihanje/index.html"), "Breathing should have its own clean route");
assert.ok(exists("oci/index.html"), "Eye exercises should have their own clean route");
assert.ok(exists("gibanje/index.html"), "Movement exercises should have their own clean route");
assert.ok(exists("dodatek/index.html"), "The old add-on route should remain as a redirect to the unified homepage");
assert.ok(exists("assets/exercises.css"), "Exercise styles should be shared from the published assets folder");
assert.ok(exists("assets/appearance.css"), "The canonical appearance palette should be published once with site assets");
assert.ok(exists("assets/vmes-home.js"), "The published homepage should include its interactive reminder preview");
assert.ok(exists("vmes-navigation.css"), "The unified Vmes navigation styles should be published once and shared by every route");
assert.ok(exists("icons/icon-96.svg"), "The published website should expose the shared SVG favicon");
assert.ok(exists("icons/icon-32.png"), "The published website should expose the PNG favicon fallback");
assert.ok(exists("extension/icons/icon-128.png"), "The published website should include the browser add-on icon assets");
assert.ok(exists("assets/breathing.js"), "The breathing route should use the shared exercise code");
assert.ok(exists("assets/breathing-preferences.js"), "The breathing preference transfer codec should be published");
assert.ok(exists("images/dihanje/Meditirajoči menih v oranžni halji.png"), "Breathing figure images should be published");
assert.ok(exists("images/vmes-popup-preview.png"), "The published homepage should include the real add-on popup screenshot");
assert.ok(exists("images/vmes-site-limit-preview.png"), "The published homepage should include the real site-limit settings screenshot");

const home = read("index.html");
const homeStyles = read("vmes.css");
const exerciseStyles = read("assets/exercises.css");
const breathing = read("dihanje/index.html");
const eyes = read("oci/index.html");
const legacyAddonRoute = read("dodatek/index.html");

assert.match(legacyAddonRoute, /<link rel="icon" type="image\/svg\+xml" href="\.\.\/icons\/icon-96\.svg\?v=20261029-2">/, "The legacy redirect should use the cache-busted shared favicon");
assert.match(breathing, /<link rel="icon" type="image\/svg\+xml" href="\.\.\/icons\/icon-96\.svg\?v=20261029-2">/, "Exercise routes should use the cache-busted shared root favicon");
assert.match(breathing, /<link rel="stylesheet" href="\.\.\/assets\/appearance\.css">/, "Published exercises should load the canonical appearance palette");
assert.match(breathing, /class="vmes-mark" src="\.\.\/extension\/icons\/icon-48\.svg\?v=20261029-2" alt=""/, "Exercise navigation should use the cache-busted Vmes brand mark");
assert.match(home, /href="dihanje\/"/, "Homepage links should use a clean breathing route");
assert.match(home, /<h1 id="hero-title">Opomniki za odmore\.<br><em>Omejitve za splet\.<\/em><\/h1>/, "The homepage should lead with the Firefox add-on's concrete purpose");
assert.match(home, /<title>Vmes: opomniki za odmore in spletni fokus za Firefox<\/title>/, "The published homepage should use the SEO-friendly title");
assert.match(home, /<meta name="description" content="Vmes je Firefoxov dodatek[^"]*opomniki za oči, vodo in odmore[^"]*omejitvami in blokiranjem[^"]*lokalno\."/i, "The published homepage should describe the Firefox reminder and website-focus features for search");
assert.match(home, /<link rel="icon" type="image\/svg\+xml" href="icons\/icon-96\.svg\?v=20261029-2">/, "The published homepage should use the cache-busted Vmes favicon");
assert.match(home, /<link rel="stylesheet" href="assets\/appearance\.css">/, "The published homepage should load the canonical appearance palette");
assert.match(home, /class="vmes-mark" src="extension\/icons\/icon-48\.svg\?v=20261029-2" alt=""/, "The homepage navigation should use the cache-busted Vmes brand mark");
assert.match(home, new RegExp(`href="${siteLinks.addonListingUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>\\s*Namesti v Firefox`), "The primary homepage action should install the add-on from the configured Mozilla listing");
assert.ok(home.includes(`href="${siteLinks.repositoryUrl}"`), "The published homepage should link to the configured source repository");
assert.match(home, new RegExp(`class="site-support-link" href="${siteLinks.supportPageUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" target="_blank" rel="noopener noreferrer"><svg[\\s\\S]*?Podprite Vmes`), "The published homepage should provide a visible, heart-marked support link");
assert.match(home, /href="#vaje"[^>]*>[\s\S]*?Preizkusi vaje/, "The secondary homepage action should lead to web exercises");
assert.match(home, new RegExp(`href="${siteLinks.addonListingUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>Odpri Mozilla Add-ons`), "The installation instructions should link to the signed Mozilla add-on listing");
assert.doesNotMatch(home, /detail-package-link|releases\/latest\/download/, "The website should not link to an unpublished or unsigned XPI");
assert.match(home, /class="addon-reminder-preview"[\s\S]*?data-preview-name>Odmor za oči[\s\S]*?data-preview-countdown>Čez 10 min[\s\S]*?Opomniki so vključeni/, "The homepage's first view should show the reminder preview with its enabled-state control and exact default interval");
assert.match(home, /class="preview-carousel-indicator" aria-hidden="true">[\s\S]*<span class="is-active"><\/span>[\s\S]*<span><\/span>[\s\S]*<span><\/span>/, "The published homepage should show a three-step indicator for the automatic carousel");
assert.doesNotMatch(home, /data-preview-example|preview-examples/, "The homepage should not show manual reminder selection controls");
assert.match(home, /<script src="assets\/vmes-home\.js" defer><\/script>/, "The published homepage should load its local interactive preview script");
assert.match(read("assets/vmes-home.js"), /window\.setInterval\(showNextPreview, previewInterval\)/, "The published homepage should rotate reminder examples automatically");
assert.match(read("assets/vmes-home.js"), /previewIndicators\.forEach\(\(indicator, index\) => \{\s*indicator\.classList\.toggle\("is-active", index === currentPreview\)/, "The carousel indicator should stay synchronized with the automatic preview");
assert.match(read("assets/vmes-home.js"), /!reducedMotionPreference\.matches && !document\.hidden/, "The automatic preview should stop for users who request reduced motion");
assert.match(read("assets/vmes-home.js"), /previewName\.textContent = example\.name;[\s\S]*previewCountdown\.textContent = example\.countdown;/, "The automatic preview should update its title and countdown");
assert.match(home, /class="android-install-note"[\s\S]*Firefox za Android[\s\S]*Dodatki/, "The homepage should explain how to find the add-on on Firefox for Android");
assert.match(home, /id="podrobnosti-opomniki"[\s\S]*id="podrobnosti-omejitev"/, "Detailed reminder and website-limit information should remain available below the simplified hero");
assert.match(home, /src="images\/vmes-popup-preview\.png"[^>]*alt="Posnetek pojavnega okna Vmes z vzorčnimi opomniki/, "The popup screenshot should identify its sample data");
assert.match(home, /src="images\/vmes-site-limit-preview\.png"[^>]*alt="Posnetek nastavitev omejitve za youtube\.com/, "The site-limit screenshot should be described accurately");
assert.doesNotMatch(home, /<iframe|Živi predogled/, "The homepage should not frame an exercise as part of the Firefox add-on");
assert.match(home, /href="oci\/"/, "The homepage should link directly to eye exercises");
assert.match(home, /href="gibanje\/"/, "The homepage should link directly to movement exercises");
assert.match(home, /id="namestitev"[\s\S]*id="funkcije"[\s\S]*id="obvestila"[\s\S]*id="zasebnost"[\s\S]*id="github"/, "Installation, features, notification channels, privacy and source details should share the homepage");
assert.match(home, /Vse tri vaje lahko odpreš tudi brez dodatka/, "The homepage should make clear that web exercises work without the add-on");
assert.doesNotMatch(home, /hero-benefits|Brez računa[\s\S]*Lokalne nastavitve/, "The homepage should avoid repeating feature and privacy claims in the hero");
assert.doesNotMatch(home, /href="[^"]*website\/index\.html|href="[^"]*dodatek\//, "Homepage links should not send visitors to a separate add-on page");
assert.match(homeStyles, /--paper: #f5f8f0;[\s\S]*--accent: #267c68;/, "The homepage should use the updated fresh green palette");
assert.match(homeStyles, /\.practice:nth-child\(2\) \.practice-icon[\s\S]*var\(--sun-soft\)/, "Exercise icons should use distinct, meaningful accent colors");
assert.match(exerciseStyles, /--bg: #f5f8f0;[\s\S]*--accent: #267c68;/, "Exercise routes should share the homepage's fresh green palette by default");
assert.match(breathing, /<strong>Sveža<\/strong><small>Zelena, sončno rumena in sivkasti poudarki\.<\/small>/, "The default breathing theme should match the shared site palette");
assert.match(breathing, /href="\.\.\/oci\/"/, "Exercise navigation should use clean sibling routes");
assert.match(breathing, /href="\.\.\/"/, "Exercise brand should lead back to the Vmes homepage");
assert.match(home, /<header class="top-bar site-header vmes-site-top-bar">[\s\S]*href="#namestitev" class="nav-btn nav-btn-addon"[\s\S]*href="dihanje\/" class="nav-btn"/, "Homepage should place the add-on link before the shared exercise navigation");
assert.match(home, /href="\.?\/?#namestitev" class="nav-btn nav-btn-addon"[^>]*>[\s\S]*?<span>Dodatek<\/span>/, "The homepage navigation should link to add-on installation");
assert.match(home, /href="vmes-navigation\.css"/, "Homepage should use the shared navigation stylesheet");
for (const page of [breathing, eyes, read("gibanje/index.html")]) {
  assert.match(page, /<header class="top-bar site-header vmes-site-top-bar">/, "Every exercise route should use the shared Vmes navigation template");
  assert.match(page, /href="\.\.\/vmes-navigation\.css"/, "Every exercise route should use the same published navigation stylesheet");
  assert.match(page, /href="\.\.\/" class="brand vmes-brand"/, "The Vmes brand should return to the site root from every exercise");
  assert.doesNotMatch(page, /nav-btn-addon|Več o Firefox dodatku/, "Exercise navigation should not include a separate add-on link");
}
assert.match(breathing, /href="\.\.\/dihanje\/" class="nav-btn active"[^>]*aria-current="page"[\s\S]*?<span>Dihanje<\/span>/, "The active exercise should be indicated accessibly in shared navigation");
assert.match(eyes, /href="\.\.\/oci\/" class="nav-btn active"[^>]*aria-current="page"[\s\S]*?<span>Vaje za oči<\/span>/, "The active eye exercise should be indicated accessibly in shared navigation");
assert.match(read("gibanje/index.html"), /href="\.\.\/gibanje\/" class="nav-btn active"[^>]*aria-current="page"[\s\S]*?<span>Gibanje<\/span>/, "The active movement exercise should be indicated accessibly in shared navigation");
assert.match(breathing, /id="settings-nav-btn"/, "The shared navigation should preserve the breathing settings control");
assert.match(breathing, /src="\.\.\/assets\/breathing\.js"/, "Breathing route should load its shared exercise script");
assert.match(breathing, /src="\.\.\/assets\/breathing-preferences\.js"/, "Breathing route should load the portable preference transfer codec");
assert.match(read("assets/breathing.js"), /"monk-orange": "\.\.\/images\/dihanje\//, "Breathing route should load its figures from the shared image directory");
assert.match(eyes, /src="\.\.\/images\/vaje_oci\//, "Eye exercise route should load its images from the shared image directory");
assert.match(legacyAddonRoute, /http-equiv="refresh" content="0; url=\.\.\/index\.html#namestitev"/, "Old add-on links should automatically return visitors to the unified homepage");
assert.match(legacyAddonRoute, /href="\.\.\/index\.html#namestitev"/, "The legacy route should provide a fallback link to installation details");
assert.ok(exists(".nojekyll"), "GitHub Pages should publish all generated asset directories");

const server = createVmesSiteServer(site);
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

try {
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  for (const [route, heading] of [
    ["/", "Opomniki za odmore."],
    ["/dihanje/", "Dihanje"],
    ["/oci/", "Vaje za oči"],
    ["/gibanje/", "Obrnite glavo levo in desno"],
    ["/dodatek/", "vse na eni strani"]
  ]) {
    const response = await fetch(`${origin}${route}`);
    assert.equal(response.status, 200, `Local server should return ${route}`);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/, `${route} should be served as HTML`);
    assert.match(await response.text(), new RegExp(heading), `${route} should serve its expected page`);
  }

  const stylesResponse = await fetch(`${origin}/vmes.css`);
  assert.equal(stylesResponse.status, 200, "The local server should serve shared styles");
  assert.match(stylesResponse.headers.get("content-type") ?? "", /text\/css/, "Styles should be served with a CSS content type");
  for (const screenshot of ["vmes-popup-preview.png", "vmes-site-limit-preview.png"]) {
    const imageResponse = await fetch(`${origin}/images/${screenshot}`);
    assert.equal(imageResponse.status, 200, `The local server should serve ${screenshot}`);
    assert.match(imageResponse.headers.get("content-type") ?? "", /image\/png/, `${screenshot} should be served as a PNG`);
  }
  assert.equal((await fetch(`${origin}/missing/`)).status, 404, "Missing local routes should return 404");
  assert.equal((await fetch(origin, { method: "POST" })).status, 405, "The local static server should reject unsupported methods");
} finally {
  const closed = new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  server.closeAllConnections?.();
  await closed;
}

console.log("Vmes site tests passed: build, clean routes, shared assets, and localhost navigation.");
