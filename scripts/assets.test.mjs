import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sharedAppearancePath = path.join(root, "extension", "lib", "appearance.css");
const sharedAppearance = fs.readFileSync(sharedAppearancePath, "utf8");
const appearancePages = [
  ["extension/index.html", 'href="lib/appearance.css"'],
  ["extension/options/options.html", 'href="../lib/appearance.css"'],
  ["extension/popup/popup.html", 'href="../lib/appearance.css"'],
  ["extension/notification/notification.html", 'href="../lib/appearance.css"'],
  ["extension/onboarding/onboarding.html", 'href="../lib/appearance.css"'],
  ["extension/exercises/blocked.html", 'href="../lib/appearance.css"'],
  ["extension/exercises/breathing.html", 'href="../lib/appearance.css"'],
  ["extension/exercises/eyes.html", 'href="../lib/appearance.css"'],
  ["extension/exercises/stretches.html", 'href="../lib/appearance.css"']
];
for (const [file, link] of appearancePages) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.ok(html.includes(link), `${file} should load the shared appearance palette`);
  assert.equal(
    html.lastIndexOf('<link rel="stylesheet"'),
    html.lastIndexOf(`<link rel="stylesheet" ${link}`),
    `${file} should load the shared palette after page styles`
  );
}
for (const palette of ["indigo", "lagoon", "forest", "sunset", "mono", "mono-dark", "dark-color", "ocean", "cyber", "synth", "system"]) {
  assert.match(sharedAppearance, new RegExp(`body\\[data-palette="${palette}"\\]`), `Shared appearance palette missing: ${palette}`);
}
assert.match(sharedAppearance, /--primary:\s*#267c68/, "The shared default palette should use Vmes green");
assert.match(sharedAppearance, /body\[data-palette="system"\]\[data-theme="dark"\]/, "System theme should resolve to the shared dark palette");
assert.doesNotMatch(fs.readFileSync(path.join(root, "extension/notification/notification.css"), "utf8"), /#5545d3|#7668ed|prefers-color-scheme:dark/i, "Notifications should not define a separate hard-coded theme");

const context = { window: {}, document: { currentScript: { src: "moz-extension://test/lib/sounds.js" } } };
context.globalThis = context;
vm.createContext(context);

const exerciseImageSets = [
  {
    script: "extension/exercises/eyes.js",
    paths: [
      "images/vaje_oci/01_levo-desno_levo.png", "images/vaje_oci/01_levo-desno_desno.png",
      "images/vaje_oci/02_gor-dol_gor.png", "images/vaje_oci/02_gor-dol_dol.png",
      "images/vaje_oci/03_diagonala_levo-zgoraj.png", "images/vaje_oci/03_diagonala_desno-spodaj.png",
      "images/vaje_oci/04_diagonala_desno-zgoraj.png", "images/vaje_oci/04_diagonala_levo-spodaj.png",
      "images/vaje_oci/01_levo-desno_desno.png", "images/vaje_oci/01_levo-desno_desno.png",
      "images/vaje_oci/01_levo-desno_desno.png", "images/vaje_oci/01_levo-desno_desno.png",
      "images/vaje_oci/05_blizu-dalec.png", "images/vaje_oci/06_pocitek_zaprte-oci.png"
    ]
  },
  {
    script: "extension/exercises/stretches.js",
    paths: Array.from({ length: 11 }, (_, index) => `images/vaje_telo/${String(index + 1).padStart(2, "0")}.png`)
  }
];
for (const { script, paths } of exerciseImageSets) {
  const source = fs.readFileSync(path.join(root, script), "utf8");
  const mappedPaths = [...source.matchAll(/(?:image|pairedImage):\s*"([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(mappedPaths, paths, `Exercise image mapping changed: ${script}`);
  for (const imagePath of paths) {
    const fullPath = path.join(root, "extension/exercises", imagePath);
    const png = fs.readFileSync(fullPath);
    assert.equal(png.toString("ascii", 1, 4), "PNG", `Invalid exercise image: ${imagePath}`);
    assert.ok(png.readUInt32BE(16) > 0 && png.readUInt32BE(20) > 0, `Empty exercise image: ${imagePath}`);
  }
  if (script.endsWith("stretches.js")) {
    assert.match(source, /classList\.toggle\("is-mirrored",\s*\w+\.mirror === true\)/, `Optional mirroring missing: ${script}`);
  }
}
const seatedSource = fs.readFileSync(path.join(root, "extension/exercises/stretches.js"), "utf8");
const seatedGroups = [...new Set([...seatedSource.matchAll(/group:\s*"([^"]+)"/g)].map(match => match[1]))];
assert.deepEqual(seatedGroups, ["neck", "upper", "legs"], "Body exercise groups should match reminder rotation");
assert.equal([...seatedSource.matchAll(/id:\s*"stretch-/g)].length, 11, "Body exercise guide should contain exactly 11 exercises");
assert.equal([...seatedSource.matchAll(/image:\s*"images\/vaje_telo\/\d{2}\.png"/g)].length, 11, "Every body exercise should use its current numbered illustration");
assert.match(fs.readFileSync(path.join(root, "extension/exercises/stretches.html"), "utf8"), /src="images\/vaje_telo\/01\.png"/, "Body exercise guide should start with the first current illustration");
assert.match(fs.readFileSync(path.join(root, "extension/exercises/stretches.html"), "utf8"), /Vaja 1 od 11/, "Body exercise guide should show the updated total");
const exercisePages = ["eyes.html", "stretches.html"].map(file => ({
  file,
  page: fs.readFileSync(path.join(root, "extension/exercises", file), "utf8")
}));
for (const { file, page } of exercisePages) {
  assert.match(page, /<body class="exercise-page-body(?: [^"]*)?">/, "Exercise pages should use the shared minimal header styling");
  assert.doesNotMatch(page, /style="/, "Exercise pages should not use inline presentation styles");
  if (file === "eyes.html") {
    assert.match(page, /<main class="exercise-workspace">[\s\S]*?<section class="exercise-stage"[\s\S]*?class="exercise-image-frame"[\s\S]*?class="exercise-caption-box"[\s\S]*?class="exercise-navigation"/, "Eye exercises should use the simple shared exercise layout");
    assert.match(page, /class="stepper-main-controls">\s*<button id="btn-prev"[\s\S]*?<button id="btn-next"/, "Eye exercises should use previous and next controls");
    const eyeGuide = fs.readFileSync(path.join(root, "extension/exercises/eyes.js"), "utf8");
    assert.match(page, /id="exercise-image-paired"[^>]*src="images\/vaje_oci\/01_levo-desno_desno\.png"[^>]*hidden/, "The first eye exercise should provide a second direction image");
    assert.match(eyeGuide, /title: "Pogled levo in desno"[\s\S]*?Ponovite 10-krat\.[\s\S]*?pairedImage:/, "The first eye exercise should repeat the left-right movement ten times");
    assert.match(eyeGuide, /title: "Pogled gor in dol"[\s\S]*?Ponovite 10-krat\.[\s\S]*?pairedImage:/, "The up-down eye exercise should repeat the movement ten times");
    assert.match(eyeGuide, /title: "Diagonalno: levo zgoraj – desno spodaj"[\s\S]*?Ponovite 10-krat\.[\s\S]*?pairedImage:/, "The first diagonal exercise should pair upper-left and lower-right");
    assert.match(eyeGuide, /title: "Diagonalno: desno zgoraj – levo spodaj"[\s\S]*?Ponovite 10-krat\.[\s\S]*?pairedImage:/, "The second diagonal exercise should pair upper-right and lower-left");
    assert.match(eyeGuide, /title: "Sledenje kvadratu"[\s\S]*?2-krat v smeri urinega kazalca, nato 5-krat v nasprotni smeri\.[\s\S]*?diagram: "square"/, "Square tracking should show both directions and the requested repetition counts");
    assert.match(eyeGuide, /title: "Kroženje po krogu"[\s\S]*?2-krat sledite smeri urinega kazalca, nato 5-krat nasprotni smeri\.[\s\S]*?diagram: "circle"/, "Circle tracking should show both directions and the requested repetition counts");
    assert.match(eyeGuide, /title: "Sledenje trikotniku"[\s\S]*?2-krat v smeri urinega kazalca, nato 5-krat v nasprotni smeri\.[\s\S]*?diagram: "triangle"/, "Triangle tracking should show both directions and the requested repetition counts");
    assert.match(eyeGuide, /title: "Sledenje obrnjenemu trikotniku"[\s\S]*?2-krat v smeri urinega kazalca, nato 5-krat v nasprotni smeri\.[\s\S]*?diagram: "inverted-triangle"/, "Inverted triangle tracking should show both directions and the requested repetition counts");
    assert.equal([...eyeGuide.matchAll(/image: "images\/vaje_oci\/01_levo-desno_desno\.png",\s*diagram:/g)].length, 4, "Shape-tracking exercises should use the existing right-gazing image next to each diagram");
    assert.match(eyeGuide, /exerciseImg\.classList\.toggle\("is-mirrored",\s*exercise\.mirror === true\)/, "Eye exercise mirroring should update with the selected exercise");
    assert.match(page, /orbit-arrow-head[\s\S]*?marker-end=/, "Shape tracking diagrams should show outlined arrowheads at the ends of their paths");
    const eyeStyles = fs.readFileSync(path.join(root, "extension/exercises/exercises.css"), "utf8");
    assert.match(eyeStyles, /\.orbit-direction\s*\{[^}]*stroke:\s*var\(--muted\)/s, "Shape tracking paths should follow the shape outline");
    assert.doesNotMatch(eyeStyles, /\.orbit-direction\s*\{[^}]*stroke-dasharray/s, "Shape tracking paths should not add an external dashed loop");
    assert.match(eyeStyles, /@keyframes show-clockwise-orbit[\s\S]*?@keyframes show-counterclockwise-orbit/, "Shape directions should alternate instead of showing both arrows together");
    assert.doesNotMatch(page, /eyes-guided-page|exercise-progress|countdown|session-status|eyes-safety-note/, "Eye exercises should avoid unnecessary session UI");
    assert.match(page, /id="exercise-title" aria-live="polite"/, "Exercise title changes should be announced accessibly");
  } else {
    assert.match(page, /<main class="exercise-workspace">[\s\S]*?<section class="exercise-stage"[\s\S]*?class="exercise-image-frame"[\s\S]*?class="exercise-caption-box"[\s\S]*?class="exercise-navigation"/, "The seated guide should use the shared, semantic exercise layout");
    assert.match(page, /class="stepper-main-controls">\s*<button id="btn-prev"/, "Exercise navigation should use the shared stylesheet instead of inline layout styles");
    assert.match(page, /id="exercise-title" aria-live="polite"/, "Exercise title changes should be announced accessibly");
  }
}
const breathingPage = fs.readFileSync(path.join(root, "extension/exercises/breathing.html"), "utf8");
const breathingSource = fs.readFileSync(path.join(root, "extension/exercises/breathing.js"), "utf8");
const breathingStyles = fs.readFileSync(path.join(root, "extension/exercises/exercises.css"), "utf8");
const vmesPage = fs.readFileSync(path.join(root, "extension/index.html"), "utf8");
const vmesStyles = fs.readFileSync(path.join(root, "extension/vmes.css"), "utf8");
const vmesBuildSource = fs.readFileSync(path.join(root, "scripts/build-vmes-site.mjs"), "utf8");
const packageSource = fs.readFileSync(path.join(root, "scripts/package.mjs"), "utf8");
const siteLinks = JSON.parse(fs.readFileSync(path.join(root, "scripts/site-links.json"), "utf8"));
const soundSource = fs.readFileSync(path.join(root, "extension/lib/sounds.js"), "utf8");
assert.match(breathingStyles, /\.exercise-workspace\s*\{[^}]*display:\s*grid[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s*auto/s, "Exercise pages should keep navigation anchored below the exercise area");
assert.match(breathingStyles, /@media \(max-height: 520px\)[\s\S]*?\.exercise-photo-art\s*\{[^}]*max-height:\s*min\(30svh,\s*140px\)/s, "Exercise layouts should adapt to short landscape viewports");
assert.match(breathingStyles, /\.stepper-main-controls #btn-next:not\(\.btn-finish\)\s*\{[^}]*background:\s*var\(--accent\)/s, "The next action should use the active accent while preserving the finish state");
const techniqueOptions = [...breathingPage.matchAll(/data-technique-choice="([^"]+)"/g)].map(match => match[1]);
const techniqueSource = breathingSource.split("const SHAPE_MODES")[0];
const techniqueDefinitions = [...techniqueSource.matchAll(/^[ \t]{4}([a-z]+): \{/gm)].map(match => match[1]);
const shapeModeBlock = breathingSource.match(/const SHAPE_MODES = \{([\s\S]*?)\n  \};/)?.[1] ?? "";
const shapeModes = [...shapeModeBlock.matchAll(/^[ \t]{4}([a-z]+):\s*"([^"]+)"/gm)].map(match => match[1]);
const shapeChoices = [...breathingPage.matchAll(/data-shape="([^"]+)"/g)].map(match => match[1]);
const durationChoices = [...breathingPage.matchAll(/data-duration="([^"]+)"/g)].map(match => match[1]);
const breathingPhaseNames = [...techniqueSource.matchAll(/name:\s*"([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(techniqueOptions, techniqueDefinitions, "Breathing selector options should have matching technique definitions");
assert.equal(techniqueOptions.length, 13, "Breathing guide should offer all twelve unique requested techniques and a custom rhythm");
assert.equal(techniqueOptions.at(-1), "custom", "Custom rhythm should be available as the last breathing option");
assert.deepEqual(techniqueOptions, ["box", "relax", "coherent", "sigh", "wimhof", "pursed", "nadi", "ujjayi", "belly", "buteyko", "tummo", "fire", "custom"], "Rhythm picker should provide each unique requested breathing technique without duplicate Wim Hof entries");
assert.match(breathingPage, /<strong id="technique-current-label">Trebušno dihanje<\/strong>[\s\S]*?<span id="technique-current-pattern">4 · 0 · 6 · 0 s<\/span>/, "The beginner default should be relaxed belly breathing with no holds");
assert.match(breathingPage, /data-technique-choice="belly"[^>]*aria-pressed="true"/, "Belly breathing should be the selected rhythm for first-time visitors");
assert.match(breathingPage, /data-technique-choice="box" data-label="Kvadratno dihanje" data-pattern="4 · 4 · 4 · 4 s"/, "The four-phase box breathing rhythm should be identified directly");
assert.match(breathingPage, /data-technique-choice="relax"[^>]*data-pattern="4 · 7 · 8 · 0 s"/, "The 4-7-8 rhythm should include its zero-length final phase");
assert.match(breathingPage, /data-technique-choice="coherent"[^>]*data-pattern="5,5 · 0 · 5,5 · 0 s"/, "Coherent breathing should show its requested equal five-and-a-half-second phases");
assert.match(breathingPage, /data-technique-choice="sigh"[^>]*data-pattern="2,5 · 1,5 · 0 · 6 · 1 s"/, "The physiological sigh should show the complete supplied phase pattern");
assert.match(breathingPage, /data-technique-choice="wimhof"[^>]*data-pattern="1,5 · 0 · 1,5 · 0 · 30 vdihov × 3 krogi"/, "Wim Hof breathing should include its three rounds of thirty breaths");
assert.match(breathingPage, /data-technique-choice="nadi"[^>]*Izmenično nosno dihanje/, "Nadi Shodhana should coach alternating nostrils rather than only copy its timing");
assert.match(breathingPage, /data-technique-choice="fire"[^>]*data-pattern="0,75 · 0 · 0,75 · 0 s"/, "Breath of Fire should expose the requested fast interval");
assert.match(breathingPage, /id="technique-guidance"[^>]*aria-live="polite"/, "Technique-specific instructions and safety guidance should be announced accessibly");
assert.match(breathingSource, /breathsInRound >= TECHNIQUES\[techniqueKey\]\.breathsPerRound[\s\S]*?roundNumber >= TECHNIQUES\[techniqueKey\]\.rounds[\s\S]*?finishTechniqueSession\(currentElapsed\)/, "The guided Wim Hof session should count breaths and end after three rounds");
assert.match(breathingSource, /awaitingRoundStart = true;[\s\S]*?Vzemi si premor[\s\S]*?Nadaljuj, ko si pripravljen/, "The guided Wim Hof session should offer a user-controlled rest between rounds instead of inventing a fixed hold");
assert.match(breathingSource, /button\[data-shape="\$\{shapeKey\}"\]/, "Restored shape labels should use the selected shape button rather than reading the whole visual");
assert.match(breathingPage, /<details id="technique-accordion"[^>]*class="breathing-accordion breathing-rhythm-picker"[\s\S]*?<summary id="technique-button"[^>]*aria-expanded="false"[^>]*>[\s\S]*?<div id="technique-options" class="breathing-rhythm-options" role="group"/, "Rhythm choices should expand in place as part of the settings accordion");
assert.match(breathingPage, /<details id="shape-accordion"[\s\S]*?id="shape-current-value"[\s\S]*?data-shape="circle"[\s\S]*?data-shape="blob"/, "Shape choices should live in their own value-summary accordion");
assert.match(breathingPage, /data-technique-choice="sigh"[^>]*aria-pressed="false">[\s\S]*?Fiziološki vzdih/, "The double-inhale rhythm should be presented under its technique name");
assert.ok(breathingPhaseNames.every(name => typeof name === "string" && name.length > 0), "Breathing phase labels should be present for every technique");
assert.deepEqual(shapeChoices, ["circle", "square", "oval", "blob"], "Breathing guide should offer circle, square, oval, and organic visual shapes");
assert.deepEqual(shapeModes, shapeChoices, "Each selectable visual shape should have a corresponding shape mode");
assert.deepEqual([...breathingPage.matchAll(/data-visual-style="([^"]+)"/g)].map(match => match[1]), ["grow", "fill", "duotone", "rings", "ripple", "none"], "Breathing guide should offer distinct breathing-synchronized and outward ripple visuals, plus a no-background option");
const breathingMotifs = [...breathingPage.matchAll(/data-setting-target="motif-select" data-value="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(breathingMotifs, ["none", "monk-orange", "monk-gold", "meditator-woman"], "Breathing guide should provide independent figure choices");
assert.match(breathingPage, /id="breathing-monk-image" class="breathing-monk-image"/, "Breathing guide should have an image layer for the selected meditation figure");
assert.match(breathingSource, /monkImage\.style\.setProperty\("--motif-scale", String\(0\.96 \+ \(scale - 0\.78\) \* 0\.2\)\)/, "Meditation images should breathe with a gentler scale range than the background");
assert.match(breathingSource, /const glowProgress = Math\.max\(0, Math\.min\(1, \(scale - 0\.78\) \/ 0\.26\)\)[\s\S]*?setProperty\("--breathing-glow-opacity"[\s\S]*?setProperty\("--breathing-halo-scale"/, "The halo should subtly expand and brighten with the breathing animation");
assert.match(breathingStyles, /\.breathing-halo\s*\{[^}]*opacity:\s*var\(--breathing-glow-opacity,\s*0\.72\)[^}]*transform:\s*scale\(var\(--breathing-halo-scale,\s*1\)\)/s, "The halo should expose the breathing-synchronized opacity and size");
assert.match(breathingStyles, /\.breathing-monk-image\s*\{[^}]*top:\s*21%;[^}]*left:\s*21%;[^}]*width:\s*58%;[^}]*height:\s*58%;/s, "Image figures should stay smaller than the full breathing visual and be centered in the animation");
assert.match(breathingStyles, /\.breathing-visual\[data-motif\]:not\(\[data-motif="none"\]\) \.breathing-readout\s*\{[^}]*bottom:\s*8%;[^}]*transform:\s*translateX\(-50%\)/s, "The breathing phase readout should sit below the selected figure");
assert.match(breathingStyles, /\.breathing-visual\[data-motif\]:not\(\[data-motif="none"\]\) \.breathing-phase\s*\{[^}]*color:\s*var\(--text\)/s, "Phase labels below a figure should use readable foreground contrast");
assert.match(breathingStyles, /@media \(min-width: 761px\)\s*\{\s*\.breathing-settings\s*\{[^}]*width:\s*min\(420px,\s*94vw\)/s, "The desktop settings drawer should use a deliberate responsive width");
assert.match(breathingStyles, /\.breathing-settings-heading h2\s*\{[^}]*font-size:\s*19px[^}]*letter-spacing:\s*-0\.035em/s, "The settings drawer should use a clear modern heading");
assert.match(breathingStyles, /\.breathing-accordion-summary\s*\{[^}]*min-height:\s*56px[^}]*grid-template-columns:\s*minmax\(74px,\s*0\.72fr\)\s*minmax\(0,\s*1\.5fr\)\s*22px/s, "Settings should use calm, compact rows with clear label and value alignment");
assert.match(breathingStyles, /\.breathing-rhythm-picker,\s*\.breathing-settings-section\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*background:\s*transparent/s, "Settings choices should not be boxed into repeated cards");
assert.match(breathingStyles, /\.breathing-accordion\s*\{[^}]*border-bottom:\s*0;/s, "Settings rows should not be separated by repeated divider lines");
assert.match(breathingStyles, /\.breathing-words-toggle\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*999px;[^}]*background:\s*var\(--surface-alt\)/s, "Phase word visibility should use a clear button-style toggle");
assert.match(breathingStyles, /^@charset ["']UTF-8["'];/, "Breathing styles should explicitly declare UTF-8 for generated interface glyphs");
assert.match(breathingPage, /class="breathing-settings-heading"[\s\S]*?<h2>Nastavitve<\/h2>/, "The settings drawer should retain a concise heading");
assert.doesNotMatch(breathingPage, /<p>Prilagodite dihalno vajo<\/p>/, "The settings drawer should not repeat its purpose in a redundant subtitle");
assert.match(breathingPage, /id="shape-accordion"[\s\S]*?class="breathing-accordion-options breathing-choice-group"[^>]*role="group" aria-label="Oblika animacije"/, "Shape options should remain a grouped, accessible choice");
assert.match(breathingStyles, /\.breathing-shape-choices \.breathing-accordion-options\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);[^}]*width:\s*100%;[^}]*justify-self:\s*stretch/s, "Shape choices should align evenly in a responsive four-column grid");
assert.match(breathingStyles, /\.breathing-shape-choices \.breathing-choice\s*\{[^}]*min-height:\s*44px/s, "Shape choices should have comfortable touch targets");
assert.match(breathingStyles, /@media \(max-width: 360px\)\s*\{[\s\S]*?\.breathing-shape-choices \.breathing-accordion-options\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s, "Shape choices should use two balanced columns on very narrow screens");
assert.match(breathingSource, /document\.querySelectorAll\("button\[data-shape\]"\)\.forEach\(button => \{[\s\S]*?drawShape\(currentScale, performance\.now\(\) \* 0\.0007\);[\s\S]*?restartAfterSettingsChange\(\);[\s\S]*?\}\);/, "Selecting a shape should update the preview and restart the breathing cycle");
const shapeSelectionHandler = [...breathingSource.matchAll(/document\.querySelectorAll\("button\[data-shape\]"\)\.forEach\(button => \{[\s\S]*?\n  \}\);/g)].at(-1)?.[0] ?? "";
assert.doesNotMatch(shapeSelectionHandler, /closeSettingsAccordion/, "Selecting a shape should leave its options open for further comparison");
assert.match(breathingStyles, /\.breathing-shape-choices \.breathing-accordion-options\s*\{[^}]*gap:\s*6px;[^}]*padding:\s*4px 18px 8px/s, "Shape options should not waste vertical space when expanded");
assert.match(breathingStyles, /\.breathing-shape-choices \.breathing-choice-group\s*\{[^}]*background:\s*transparent/s, "Shape options should not sit inside a redundant second background");
assert.match(breathingStyles, /\.breathing-shape-choices \.breathing-choice\.is-selected\s*\{[^}]*background:\s*var\(--accent-soft\);[^}]*animation:\s*breathing-shape-choice-select/s, "Shape changes should use a soft highlight and brief feedback animation");
assert.match(breathingPage, /<p class="breathing-setting-hint">Lik se z dihom nežno povečuje in zmanjšuje\.<\/p>/, "The figure hint should use concise, natural language");
assert.match(breathingStyles, /\.breathing-settings-group-title\s*\{[^}]*font-size:\s*13px[^}]*text-transform:\s*none/s, "Settings groups should use calm, readable title case rather than all-caps labels");
assert.match(breathingStyles, /@media \(max-width: 760px\)\s*\{[\s\S]*?\.breathing-settings-content\s*\{[\s\S]*?gap:\s*16px;[\s\S]*?padding-top:\s*4px;[\s\S]*?\.breathing-settings-group-title\s*\{[\s\S]*?font-size:\s*14px;[\s\S]*?font-weight:\s*600;/s, "Compact settings should give section headings more emphasis and breathing room");
assert.match(breathingPage, /id="words-toggle" class="breathing-words-toggle" type="button" aria-pressed="true"/, "Phase word visibility should be an accessible toggle button enabled by default");
assert.match(breathingSource, /wordsToggle\.addEventListener\("click",[\s\S]*?setWordsVisible\(!isWordsVisible\(\)\)[\s\S]*?saveBreathingPreferences\(\)/, "The phase-word button should toggle visibility and persist its state");
assert.match(breathingSource, /function setWordsVisible\(visible\)[\s\S]*?setAttribute\("aria-pressed", String\(visible\)\)[\s\S]*?visual\.dataset\.showWords = String\(visible\)/, "The phase-word toggle should keep its accessible state and visual in sync");
assert.match(breathingPage, /id="reset-btn" class="breathing-reset-button" type="button">Ponastavi vajo/, "Session reset should remain a separate button beside the visibility toggle");
assert.match(breathingStyles, /\.breathing-preferences-transfer\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent/s, "Settings import and export should use a simple unboxed layout");
assert.match(breathingStyles, /\.breathing-preferences-actions \.btn-secondary\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*999px/s, "Import and export actions should use simple borderless buttons");
assert.deepEqual([...breathingPage.matchAll(/data-phase="([^"]+)"/g)].map(match => match[1]), ["inhale", "holdIn", "exhale", "holdOut"], "Custom rhythm should expose sliders for all four breathing phases");
const settingsSection = breathingPage.match(/<section class="breathing-settings"[\s\S]*?<\/section>/)?.[0] ?? "";
assert.ok(["id=\"technique-button\"", "data-shape=\"circle\"", "data-shape=\"blob\"", "id=\"duration-select\"", "id=\"visual-style\"", "id=\"background-mode\"", "data-phase=\"inhale\""].every(control => settingsSection.includes(control)), "All breathing controls should live together in the settings section below the animation");
assert.match(breathingPage, /id="settings-btn"[^>]*aria-controls="settings-content" aria-expanded="false"/, "The settings section should have one accessible expand and collapse control");
assert.match(breathingPage, /id="settings-nav-btn"[^>]*aria-controls="settings-content" aria-expanded="false"[\s\S]*?class="breathing-settings-icon"/, "The desktop settings trigger should use a centered, accessible settings icon");
assert.match(breathingStyles, /\.breathing-settings-toggle\s*\{[^}]*top:\s*12\.5px;[^}]*right:\s*28px;[^}]*width:\s*40px;[^}]*height:\s*40px;/s, "The drawer close button should occupy the same top-right position and dimensions as its navigation trigger");
assert.doesNotMatch(breathingPage, /<dialog\b|settings-dialog/, "Breathing settings should no longer open a separate dialog");
assert.deepEqual(durationChoices, ["60000", "180000", "300000", "infinite"], "Advanced duration choices should be concise and list infinite duration last");
assert.match(breathingPage, /<option value="infinite" data-duration="infinite" selected>Brez omejitve/, "Unlimited duration should be the quiet default without displaying an infinity symbol");
assert.match(breathingPage, /id="session-progress"[^>]*hidden><span id="session-elapsed">0:00<\/span><span id="time-remaining" hidden><\/span><\/p>/, "Elapsed and remaining time should be hidden until needed and should not display an infinity symbol by default");
const breathingNavigation = breathingPage.match(/<nav class="nav-links"[\s\S]*?<\/nav>/)?.[0] ?? "";
assert.match(breathingStyles, /\.breathing-page-body \.top-bar,\s*\.exercise-page-body \.top-bar\s*\{[^}]*border:\s*0[^}]*background:\s*transparent/s, "Exercise headers should share the breathing page's borderless, transparent style");
assert.match(breathingStyles, /\.breathing-page-body \.nav-btn,\s*\.exercise-page-body \.nav-btn,\s*\.breathing-page-body \.nav-btn-close\s*\{[^}]*border:\s*0[^}]*background:\s*transparent/s, "Exercise navigation links should share the breathing page's minimal icon style");
const sharedNavigationStyles = fs.readFileSync(path.join(root, "extension/vmes-navigation.css"), "utf8");
assert.match(sharedNavigationStyles, /\.vmes-site-top-bar \.vmes-brand\s*\{[^}]*align-items:\s*center;[^}]*gap:\s*7px;/s, "Vmes branding should space the logo mark, wordmark, and section title consistently");
assert.match(sharedNavigationStyles, /\.vmes-site-top-bar \.vmes-mark\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px/s, "Shared navigation should use the new Vmes brand mark");
assert.match(sharedNavigationStyles, /\.vmes-site-top-bar \.vmes-section\s*\{[^}]*align-self:\s*center;[^}]*margin-left:\s*10px;[^}]*padding-left:\s*10px;[^}]*border-left:\s*1px solid var\(--border\);[^}]*line-height:\s*1\.2;/s, "Section titles should have explicit spacing and vertical centering on every shared route");
assert.match(sharedNavigationStyles, /\.vmes-site-top-bar \.nav-btn\s*\{[^}]*border:\s*0[^}]*background:\s*transparent/s, "All Vmes routes should use a shared minimal borderless navigation style");
assert.match(sharedNavigationStyles, /\.vmes-site-top-bar \.nav-btn\s*\{[^}]*height:\s*40px;[^}]*min-height:\s*40px;/s, "All desktop navigation items should have the same height as the breathing settings button");
assert.match(sharedNavigationStyles, /@media \(max-width: 600px\)[\s\S]*?\.vmes-site-top-bar \.nav-links \.nav-btn\s*\{[^}]*height:\s*36px;[^}]*min-height:\s*36px;/s, "All compact navigation items should keep a shared mobile height");
assert.match(sharedNavigationStyles, /@media \(max-width: 600px\)[\s\S]*?\.nav-btn-addon span\s*\{[^}]*display:\s*inline/s, "The Firefox add-on button should keep its label visible on mobile");
assert.match(breathingStyles, /\.breathing-page-body\s*\{[^}]*height:\s*100svh;[^}]*overflow:\s*hidden;/s, "The breathing page should fit the viewport without an outer page scrollbar");
assert.match(breathingStyles, /\.exercise-navigation\s*\{[^}]*width:\s*100%/s, "Exercise navigation should align with the edges of its content area");
assert.match(breathingStyles, /\.stepper-main-controls\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*space-between/s, "Exercise navigation should place previous and next actions at opposite ends");
assert.match(breathingStyles, /\.btn-ctrl\s*\{[^}]*min-width:\s*148px;[^}]*min-height:\s*50px;[^}]*border-radius:\s*14px;[^}]*transition:[^;]*transform 180ms cubic-bezier/s, "Exercise actions should use touch-friendly proportions and refined motion");
assert.match(breathingStyles, /\.stepper-main-controls #btn-next:not\(\.btn-finish\)\s*\{[^}]*background:\s*var\(--accent\);[^}]*color:\s*#fff/s, "The next exercise action should use the active accent");
assert.match(breathingStyles, /\.stepper-main-controls #btn-prev:not\(:disabled\):hover\s*\{[^}]*background:\s*var\(--surface-soft\);[^}]*color:\s*var\(--accent\)/s, "The previous action should have a restrained hover state");
assert.match(breathingStyles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.stepper-main-controls \.btn-ctrl:hover,[\s\S]*?transform:\s*none/s, "Exercise button motion should respect reduced-motion preferences");
assert.match(fs.readFileSync(path.join(root, "extension/exercises/eyes.html"), "utf8"), /id="btn-next"[^]*?<span>Naslednja<\/span>/, "The eye guide should keep its concise next action label");
assert.match(fs.readFileSync(path.join(root, "extension/exercises/stretches.html"), "utf8"), /id="btn-next"[^]*?<span>Naslednja<\/span>/, "The seated guide should keep its concise next action label");
assert.match(seatedSource, /<span>Naslednja<\/span>/, "The seated guide should keep its concise next action label when advancing");
assert.doesNotMatch(breathingStyles, /\.stepper-main-controls #btn-next:not\(\.btn-finish\):hover svg\s*\{/, "The next arrow should not animate independently on hover");
assert.match(breathingStyles, /\.breathing-page\s*\{[^}]*min-height:\s*0;/s, "The breathing page should flex into the space below the header instead of adding a second viewport-based height");
assert.doesNotMatch(breathingStyles, /scrollbar-gutter:\s*stable/, "Settings should not reserve a scrollbar gutter when the content fits");
assert.doesNotMatch(breathingNavigation, /id="settings-btn"/, "The settings control should be in the settings section rather than the navigation");
assert.doesNotMatch(breathingPage, /id="close-tab-btn"/, "Breathing view should not have a confusing close-tab button");
assert.doesNotMatch(fs.readFileSync(path.join(root, "extension/exercises/eyes.html"), "utf8"), /id="close-tab-btn"/, "Eye exercises should not need a close-tab button");
assert.doesNotMatch(fs.readFileSync(path.join(root, "extension/exercises/stretches.html"), "utf8"), /id="close-tab-btn"/, "Seated exercises should not need a close-tab button");
const phaseDurations = [...breathingSource.matchAll(/duration:\s*(\d+(?:\.\d+)?)/g)].map(match => Number(match[1]));
assert.ok(phaseDurations.length > 0 && phaseDurations.every(duration => duration > 0), "Breathing phases should have positive durations");
assert.match(breathingPage, /id="breathing-shape-path"/, "Breathing guide should use an SVG shape controlled by the shape selector");
assert.deepEqual([...breathingPage.matchAll(/data-setting-target="sound-mode-select" data-value="([^"]+)"/g)].map(match => match[1]), ["off", "cues", "ambience", "both"], "Breathing audio should support silence, phase cues, ambience, and both together");
assert.deepEqual([...breathingPage.matchAll(/data-setting-target="sound-style-select" data-value="([^"]+)"/g)].map(match => match[1]), ["glass", "warm", "drop", "air"], "Breathing audio should offer four distinct synthesized sound styles");
assert.match(breathingPage, /id="breathing-sound-volume" type="range" min="0" max="60" step="5"/, "Breathing audio should include a user-adjustable volume control");
assert.match(breathingPage, /data-setting-value="sound-mode-select">Brez zvoka/, "The first-time breathing session should be silent until the user chooses a sound");
assert.match(breathingPage, /id="sound-mode-select"[^]*?<option value="off" selected>Brez zvoka/, "Silent mode should be the selected sound default for new visitors");
assert.match(breathingPage, /id="sound-preview"[^>]*>Poslušaj izbrani ton/, "Users should be able to preview the selected sound before starting");
assert.match(breathingPage, /id="breathing-tempo" type="range" min="0\.5" max="1\.5" step="0\.1"/, "Breathing pace should have a visible adjustable speed control");
assert.match(breathingPage, /id="breathing-color-select"/, "The figure should support a separate optional color override");
assert.match(breathingPage, /id="exercise-appearance"/, "The breathing page should provide a separate theme selector");
assert.match(breathingPage, /id="export-breathing-preferences"/, "Breathing preferences should be exportable to a portable file");
assert.match(breathingPage, /id="import-breathing-preferences"/, "Breathing preferences should be importable on another device");
assert.match(breathingPage, /id="breathing-preferences-file" type="file" accept="application\/json,\.json"/, "Breathing preference import should accept JSON backups");
assert.match(breathingPage, /src="breathing-preferences\.js"><\/script>[\s\S]*?src="breathing\.js"><\/script>/, "The preference validation codec should load before the breathing page logic");
assert.match(breathingPage, /Datoteka ostane pri vas; nastavitve se ne pošiljajo na strežnik/, "Preference transfer should be described as local and offline");
const breathingThemes = ["color", "lagoon", "forest", "sunset", "mono", "mono-dark", "dark-color", "ocean", "cyber", "synth", "system"];
assert.deepEqual(
  [...breathingPage.matchAll(/data-setting-target="exercise-appearance" data-value="([^"]+)"/g)].map(match => match[1]),
  breathingThemes,
  "Breathing themes should match the complete grouped Kognicija theme set"
);
assert.deepEqual(
  [...breathingPage.matchAll(/data-setting-target="breathing-color-select" data-value="([^"]+)"/g)].map(match => match[1]),
  ["theme", "red", "orange", "amber", "teal", "green", "coral", "blue", "violet", "pink", "yellow", "mint", "sky", "lavender", "fuchsia"],
  "Breathing figure colors should include the theme color and distinct user-selectable hues"
);
assert.match(breathingPage, /<summary>Svetle teme<\/summary>[\s\S]*?<summary>Temne teme<\/summary>[\s\S]*?<summary>Samodejno<\/summary>/, "Breathing themes should be grouped into light, dark, and automatic choices");
assert.match(breathingPage, /data-value="red"[^>]*>[\s\S]*?Rdeča/, "The breathing figure should offer a distinct red override");
assert.match(breathingSource, /red:\s*"#e11d48"/, "The red figure color should match the reference site's exact #e11d48 color");
assert.match(breathingSource, /breathingColorSelect\.value === "red"[\s\S]*?solidColor/, "The exact red figure should not be lightened or hue-shifted by its gradient");
assert.match(breathingPage, /id="breathing-glow-select"[\s\S]*?value="on" selected[\s\S]*?value="off"/, "Users should be able to switch the breathing figure's colored glow on and off");
assert.match(breathingSource, /glow: breathingGlowSelect\.value === "on"/, "The colored glow choice should be persisted with breathing preferences");
assert.match(breathingStyles, /\.breathing-visual\[data-glow="false"\] \.breathing-halo[\s\S]*?opacity:\s*0[\s\S]*?\.breathing-visual\[data-glow="false"\] \.breathing-shape[\s\S]*?filter:\s*none/, "Disabling glow should remove both halo and shape shadow");
assert.match(breathingSource, /yellow:\s*"#ca8a04"[\s\S]*mint:\s*"#10b981"[\s\S]*sky:\s*"#0ea5e9"[\s\S]*lavender:\s*"#8b5cf6"[\s\S]*fuchsia:\s*"#d946ef"/, "New cheerful figure colors should map to distinct accessible hues");
assert.match(breathingPage, /data-breathing-theme="color"/, "The breathing page should have a local default theme");
for (const theme of breathingThemes) {
  assert.match(breathingStyles, new RegExp(`body\\[data-breathing-theme="${theme}"\\]`), `Breathing theme styling missing: ${theme}`);
}
assert.match(breathingStyles, /@media \(prefers-color-scheme: dark\)[\s\S]*?body\[data-breathing-theme="system"\]/, "The automatic breathing theme should follow the system color scheme");
assert.match(breathingSource, /LEGACY_BREATHING_THEMES[\s\S]*?theme:\s*"system"[\s\S]*?light:\s*"color"[\s\S]*?dark:\s*"dark-color"/, "Previously saved breathing appearance values should migrate without being discarded");
assert.match(breathingSource, /document\.body\.dataset\.breathingTheme = exerciseAppearanceSelect\.value/, "Theme selection should stay local to the breathing page rather than changing the extension theme");
assert.match(breathingSource, /file\.size > 1024 \* 1024/, "Preference imports should enforce a reasonable file size limit");
assert.match(breathingSource, /breathingPreferencesCodec\.parseBackup\(JSON\.parse\(await file\.text\(\)\)\)/, "Preference imports should validate the complete schema before saving");
assert.match(breathingSource, /window\.confirm\("Uvoz bo zamenjal trenutne nastavitve/, "Preference imports should require confirmation before replacing local settings");
assert.match(breathingSource, /catch \(error\)[\s\S]*?Nastavitev dihalne vaje ni bilo mogoče uvoziti/, "Preference import errors should be reported explicitly");
assert.match(breathingSource, /function updateElapsedTime\([\s\S]*?sessionElapsedEl\.textContent = `Pretečeno \$\{formatElapsedTime\(milliseconds\)\}`/, "Session progress should display elapsed time in a readable form");
assert.match(breathingSource, /function loadBreathingPreferences\([\s\S]*?browser\.storage\.local\.get\(breathingPreferenceKey\)[\s\S]*?localStorage\.getItem\(breathingPreferenceKey\)/, "Breathing settings should persist in extension storage or standalone-site local storage");
assert.match(breathingSource, /async function persistBreathingPreferences\(preferences\)[\s\S]*?browser\.storage\.local\.set\(\{ \[breathingPreferenceKey\]: preferences \}\)[\s\S]*?localStorage\.setItem\(breathingPreferenceKey/, "Breathing settings should be saved locally without claiming cross-device sync");
assert.match(breathingSource, /async function saveBreathingPreferences\(\)[\s\S]*?await persistBreathingPreferences\(preferences\)/, "Breathing preference changes should use the shared local persistence helper");
assert.match(breathingSource, /soundMode: soundModeSelect\.value,[\s\S]*?soundStyle: soundStyleSelect\.value,[\s\S]*?soundVolume: Number\(soundVolumeSlider\.value\)/, "Sound mode, timbre, and volume should persist with the rest of the breathing preferences");
assert.match(breathingPage, /prenehajte/i, "Breathing guide should include a comfort and stop instruction");
assert.match(breathingPage, /id="instruction" aria-live="polite"/, "Breathing phase changes should be announced accessibly");
assert.match(breathingPage, /id="countdown" aria-hidden="true"/, "Fast-changing countdown should not be announced continuously");
assert.match(breathingPage, /id="toggle-btn" class="breathing-orb-button"/, "Breathing visual should be the primary start and pause control");
assert.match(breathingPage, /breathing-safety breathing-sr-only/, "Breathing safety guidance should remain available to screen readers without adding visible copy");
assert.match(breathingPage, /id="breathing-atmosphere"/, "Breathing guide should include its ambient particle canvas");
assert.match(breathingSource, /function makeBlobPath/, "Breathing shape should morph as the session progresses");
assert.match(breathingSource, /if \(shapeKey === "square"\) \{[\s\S]*?return `M \$\{left\} \$\{top\} L \$\{right\} \$\{top\} L \$\{right\} \$\{bottom\} L \$\{left\} \$\{bottom\} Z`;/, "The square option should use straight sides and sharp corners");
assert.match(breathingSource, /shapeKey === "oval" \? 82 : 70[\s\S]*?shapeKey === "oval" \? 56 : 70/, "The oval option should use a wider horizontal radius than vertical radius");
assert.match(breathingSource, /function drawAtmosphere/, "Breathing atmosphere should animate independently behind the main visual");
assert.match(breathingSource, /particles = Array\.from\(\{ length: 900 \}/, "Breathing atmosphere should use a denser field of 900 particles");
assert.match(breathingSource, /speedTier < 0\.45[\s\S]*?0\.00065 \+ Math\.random\(\) \* 0\.00185[\s\S]*?speedTier < 0\.72[\s\S]*?speedTier < 0\.9[\s\S]*?speedTier < 0\.98[\s\S]*?0\.000003 \+ Math\.random\(\) \* 0\.000012/, "Ambient particles should use five varied motion tiers, including barely drifting particles");
assert.match(breathingSource, /flowTier < 0\.5[\s\S]*?0\.0025 \+ Math\.random\(\) \* 0\.0065[\s\S]*?flowTier < 0\.78[\s\S]*?flowTier < 0\.95[\s\S]*?0\.000015 \+ Math\.random\(\) \* 0\.000085[\s\S]*?flow: particleFlow,[\s\S]*?flowSpeed,/, "Particles should respond to breathing at four distinct rates, with a few retaining a very slow drift");
assert.match(breathingSource, /maxRadius,[\s\S]*?inwardSpeed: spread \* \(0\.00002 \+ depth \* 0\.00004\),[\s\S]*?depth,[\s\S]*?size: 0\.35 \+ depth \* 1\.95 \+ Math\.random\(\) \* 0\.4,[\s\S]*?speed: speed \*/, "Ambient particles should use depth-linked size and retain varied signed speeds");
assert.match(breathingSource, /alpha: 0\.2 \+ depth \* 0\.35/, "Nearby particles should be brighter while distant particles remain subtle");
assert.match(breathingSource, /function parseColorChannels\(color\)[\s\S]*?color\.match\(\/\^#\(\[\\da-f\]\{3\}\|\[\\da-f\]\{6\}\)\$\/i\)[\s\S]*?Number\.parseInt\(digits\.slice\(index,\s*index \+ 2\),\s*16\)/, "Ambient particle colors should correctly parse hexadecimal theme accents");
assert.match(breathingSource, /function updateAccent\(\)[\s\S]*?accentChannels = parseColorChannels\(color\);\s*accentRgb = accentChannels\.join\(", "\)/, "Ambient particles should use the current theme's parsed accent channels");
assert.match(breathingSource, /radialDepth = Math\.min\(1, radius \/ atmosphereSpread\)[\s\S]*?softenedProgress = gradientProgress \* gradientProgress \* \(3 - 2 \* gradientProgress\)[\s\S]*?accentWeight = 1 - softenedProgress[\s\S]*?\[148,\s*157,\s*170\][\s\S]*?distanceFade = 1 - radialDepth \* 0\.38/, "Particle colors should blend from the selected accent near the center to a soft neutral gray at the edges");
assert.match(breathingSource, /durationMs = Infinity/, "Breathing session should use an unbounded duration by default");
assert.match(breathingSource, /durationMs = durationKey === "infinite" \? Infinity : Number\(durationKey\)/, "Breathing duration buttons should control session length");
assert.match(breathingSource, /const timed = Number\.isFinite\(durationMs\);\s*if \(timeRemainingEl\.hidden === timed\) timeRemainingEl\.hidden = !timed;\s*const hideProgress = !hasStarted && !timed/, "Remaining session time should only be visible for a timed session");
assert.doesNotMatch(breathingSource, /countdownEl\.textContent = "—"/, "The phase countdown should not show a placeholder dash before or after a session");
assert.match(breathingSource, /function setSettingsExpanded\(expanded\)/, "The settings section should support opening and closing in place");
assert.match(breathingSource, /setSettingsExpanded\(!compactSettingsViewport\.matches && !desktopSettingsViewport\.matches\)/, "Settings should start collapsed across viewport sizes");
assert.match(breathingSource, /compactSettingsViewport\.addEventListener\("change", \(\) =>\s*\{\s*setSettingsExpanded\(!compactSettingsViewport\.matches && !desktopSettingsViewport\.matches\);\s*\}\)/, "Settings visibility should stay in sync when the viewport crosses the compact breakpoint");
assert.match(breathingStyles, /\.breathing-settings-header\s*\{[^}]*min-height:\s*52px/, "The settings section should have a compact inline heading");
assert.match(breathingStyles, /\.breathing-settings-section\s*\{[^}]*grid-template-columns:\s*minmax\(130px,\s*0\.72fr\)\s+minmax\(0,\s*1\.8fr\)/, "Each setting should use a label-and-choice row layout");
assert.match(breathingStyles, /\.breathing-settings-content\[hidden\]\s*\{\s*display:\s*none/, "The full settings list should be collapsible without leaving background content behind");
assert.match(breathingPage, /id="settings-backdrop" class="breathing-settings-backdrop"[^>]*hidden/, "Mobile settings should have an accessible dismissible backdrop");
assert.match(breathingSource, /settingsBackdrop\.addEventListener\("click", \(\) => setSettingsExpanded\(false\)\)/, "Tapping outside the mobile settings sheet should close it");
assert.match(breathingSource, /event\.key === "Escape" && settingsButton\.getAttribute\("aria-expanded"\) === "true"/, "Escape should close the settings sheet");
assert.match(breathingSource, /!compactSettingsViewport\.matches[\s\S]*?settingsButton\.getAttribute\("aria-expanded"\) === "true"[\s\S]*?!event\.target\.closest\("\.breathing-settings"\)[\s\S]*?setSettingsExpanded\(false\)/, "Clicking outside the desktop settings card should close it");
assert.match(breathingSource, /event\.key === "Escape" && settingsAccordions\.some\(accordion => accordion\.open\)[\s\S]*?closeSettingsAccordion\(openAccordion\)/, "Escape should collapse an open inner settings accordion before dismissing the sheet");
assert.match(breathingStyles, /@media \(max-width: 600px\)[\s\S]*?\.breathing-settings\s*\{[^}]*position:\s*fixed[^}]*bottom:\s*0/s, "Mobile settings should open as a fixed bottom sheet");
assert.match(breathingStyles, /\.breathing-settings\[data-expanded="true"\]\s*\{[^}]*max-height:\s*74svh/, "The mobile settings sheet should grow upward but remain height-limited");
assert.match(breathingStyles, /@media \(max-width: 600px\)[\s\S]*?\.breathing-settings\[data-expanded="true"\]\s*\{[^}]*height:\s*min\(450px,\s*74svh\)/s, "The expanded mobile settings sheet should keep a stable height when irrelevant controls are hidden");
assert.match(breathingStyles, /@media \(max-width: 600px\)[\s\S]*?\.breathing-settings-toggle\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s, "The whole mobile settings header row should be clickable");
assert.match(breathingStyles, /@media \(max-width: 600px\)[\s\S]*?\.breathing-settings-toggle\[aria-expanded="false"\] \.breathing-settings-chevron\s*\{\s*transform:\s*rotate\(180deg\)/s, "The mobile drawer arrow should point up while the drawer is collapsed");
assert.match(breathingStyles, /@media \(max-width: 600px\)[\s\S]*?\.breathing-settings-toggle\[aria-expanded="true"\] \.breathing-settings-chevron\s*\{\s*transform:\s*rotate\(0\)/s, "The mobile drawer arrow should point down while the drawer is expanded");
assert.match(breathingStyles, /background:\s*color-mix\(in srgb,\s*var\(--surface\)\s*90%,\s*transparent\)/, "The mobile settings sheet should reveal the animation subtly behind a readable surface");
assert.match(breathingStyles, /@media \(max-width: 600px\)[\s\S]*?\.breathing-settings-footer > \.breathing-setting-label\s*\{\s*display:\s*none/s, "Mobile settings should omit the redundant additional-settings label");
assert.match(breathingStyles, /@media \(max-width: 600px\)[\s\S]*?\.breathing-settings-footer \.breathing-reset-button\s*\{[^}]*background:\s*transparent[^}]*color:\s*var\(--muted\)/s, "Reset should remain a quiet secondary action in the mobile settings sheet");
assert.match(breathingStyles, /\.breathing-rhythm-options\s*\{[^}]*position:\s*static[^}]*max-height:\s*none/s, "Rhythm options should expand in the settings flow instead of overlaying the other rows");
assert.match(breathingStyles, /@media \(min-width: 761px\)\s*\{[\s\S]*?\.breathing-rhythm-options\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[\s\S]*?\.breathing-rhythm-option\[data-technique-choice="custom"\]\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;/s, "Desktop rhythm options should use two clear columns and give the custom rhythm a full-width row");
assert.match(breathingStyles, /@media \(max-width: 760px\)\s*\{[\s\S]*?\.breathing-rhythm-options\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[\s\S]*?\.breathing-rhythm-option\s*\{[^}]*min-height:\s*44px/s, "Mobile rhythm options should remain a readable single column with comfortable touch targets");
assert.match(vmesPage, /<title>Vmes: opomniki za odmore in spletni fokus za Firefox<\/title>[\s\S]*?<h1 id="hero-title">Opomniki za odmore\.<br><em>Omejitve za splet\.<\/em><\/h1>/, "The Vmes homepage should use a search-friendly title and clear headline");
assert.match(vmesPage, /<meta name="description" content="Vmes je Firefoxov dodatek[^"]*opomniki za oči, vodo in odmore[^"]*omejitvami in blokiranjem[^"]*lokalno\."/i, "The homepage description should cover Firefox reminder and website-focus search terms");
assert.doesNotMatch(vmesPage, /Web Nudge/i, "The public homepage should use the Vmes name without the former product label");
assert.match(vmesPage, /OPOMNIK NA TVOJ NAČIN[\s\S]*Za prikaz opomnika na spletni strani Firefox zahteva dovoljenje/, "The notification section should explain its permission requirement");
assert.match(vmesPage, /<h3>Obvestilo na strani<\/h3><p>Opomnik se prikaže na spletni strani, ki jo uporabljaš, če za to dovoliš dostop\.<\/p>/, "The in-page notification option should explain where it appears");
assert.match(vmesPage, /PREDOGLED VMES[\s\S]*TUDI BREZ DODATKA[\s\S]*POGLED V VMES[\s\S]*Priporočena je namestitev iz uradne Mozilline zbirke dodatkov[\s\S]*Kaj vključuje Vmes[\s\S]*Koda dodatka je javno dostopna na GitHubu/, "The homepage should retain its section labels and supporting descriptions");
assert.match(vmesPage, /Vse tri vaje lahko odpreš tudi brez dodatka/, "The practice section should explain standalone access");
assert.ok(['href="exercises/breathing.html"', 'href="exercises/eyes.html"', 'href="exercises/stretches.html"'].every(page => vmesPage.includes(page)), "The source homepage should link directly to its exercise pages when opened locally");
assert.doesNotMatch(vmesPage, /<iframe|Živi predogled/, "The homepage should not present a web exercise as part of the Firefox add-on");
assert.match(vmesPage, new RegExp(`href="${siteLinks.addonListingUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" class="nav-btn nav-btn-addon"[^>]*target="_blank" rel="noopener noreferrer"`), "The source homepage add-on link should open the configured Mozilla listing safely");
assert.ok(vmesPage.indexOf('class="nav-btn nav-btn-addon"') < vmesPage.indexOf('aria-label="Dihanje"'), "The source homepage should place the add-on link before exercise links");
assert.match(vmesPage, /class="addon-reminder-preview"[\s\S]*data-preview-name>Odmor za oči[\s\S]*data-preview-countdown>Čez 10 min[\s\S]*Opomniki so vključeni/, "The homepage hero should show the reminder preview with its enabled-state control and exact default interval");
assert.match(vmesPage, /class="preview-carousel-indicator" aria-hidden="true">[\s\S]*<span class="is-active"><\/span>[\s\S]*<span><\/span>[\s\S]*<span><\/span>/, "The reminder preview should show a clean three-step carousel indicator");
assert.doesNotMatch(vmesPage, /data-preview-example|preview-examples/, "The homepage reminder preview should not display manual selection controls");
assert.match(vmesPage, /<script src="vmes-home\.js" defer><\/script>/, "The homepage should load its interactive reminder preview");
const homePreviewScript = fs.readFileSync(path.join(root, "extension/vmes-home.js"), "utf8");
assert.match(homePreviewScript, /name: "Odmor za oči"[\s\S]*countdown: "Čez 10 min"[\s\S]*name: "Kozarec vode"[\s\S]*countdown: "Čez 5 min"[\s\S]*name: "Kratek razteg"[\s\S]*countdown: "Čez 20 min"/, "The automatic preview should match each starter reminder's displayed interval");
assert.match(homePreviewScript, /window\.setInterval\(showNextPreview, previewInterval\)/, "The homepage preview should rotate automatically");
assert.equal(JSON.parse(fs.readFileSync(path.join(root, "extension/manifest.json"), "utf8")).homepage_url, siteLinks.publicSiteUrl, "The add-on homepage metadata should point to the public Vmes site");
assert.match(vmesPage, new RegExp(`href="${siteLinks.addonListingUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>\\s*Namesti v Firefox`), "The source homepage install action should use the configured Mozilla listing");
assert.match(vmesPage, new RegExp(`href="${siteLinks.repositoryUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`), "The source homepage should use the configured GitHub repository URL");
assert.match(vmesPage, new RegExp(`class="site-support-link" href="${siteLinks.supportPageUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" target="_blank" rel="noopener noreferrer"><svg[\\s\\S]*?Podprite Vmes`), "The source homepage should provide a visible, heart-marked support link");
assert.match(packageSource, /fs\.copyFileSync\(xpi,\s*latestXpi\)/, "Packaging should produce a stable XPI asset for the latest GitHub release URL");
assert.match(homePreviewScript, /previewIndicators\.forEach\(\(indicator, index\) => \{\s*indicator\.classList\.toggle\("is-active", index === currentPreview\)/, "The carousel indicator should follow the automatically selected reminder");
assert.match(homePreviewScript, /!reducedMotionPreference\.matches && !document\.hidden/, "Automatic rotation should stop when reduced motion is requested");
assert.match(homePreviewScript, /addEventListener\("mouseenter", stopRotation\)[\s\S]*addEventListener\("mouseleave", startRotation\)[\s\S]*addEventListener\("visibilitychange", startRotation\)/, "Automatic rotation should pause while hovered or hidden");
assert.match(homePreviewScript, /const resetProgress = \(animate = false\) => \{[\s\S]*previewProgress\.style\.width = "0";[\s\S]*if \(animate\)[\s\S]*previewProgress\.style\.width = "100%";/, "The progress bar should restart from zero whenever the carousel resumes");
assert.match(homePreviewScript, /else \{\s*resetProgress\(\);\s*\}\s*\};\s*\n\s*preview\.addEventListener/, "The progress bar should remain still while the carousel is paused");
assert.match(vmesStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation:\s*none !important;[\s\S]*transition:\s*none !important;/, "Homepage animations and transitions should respect reduced-motion preferences");
assert.match(vmesPage, /class="android-install-note"[\s\S]*Firefox za Android[\s\S]*Dodatki/, "The homepage should explain where to find the add-on in Firefox for Android");
assert.match(vmesPage, /id="namestitev"[\s\S]*id="funkcije"[\s\S]*id="obvestila"[\s\S]*id="zasebnost"/, "Add-on information should be integrated into the Vmes homepage");
assert.match(vmesStyles, /\.practice-list\s*\{[^}]*display:\s*grid;[^}]*gap:\s*8px/s, "The homepage should group exercises with open spacing instead of repeated dividers");
assert.match(vmesBuildSource, /buildExerciseRoute\("dihanje", "breathing\.html", "breathing\.js"\)[\s\S]*?buildExerciseRoute\("oci", "eyes\.html", "eyes\.js"\)[\s\S]*?buildExerciseRoute\("gibanje", "stretches\.html", "stretches\.js"\)/, "The standalone site build should publish each exercise at its own clean route");
assert.doesNotMatch(vmesBuildSource, /copyDirectory\(path\.join\(root, "website"\), addonOutput\)/, "The build should not publish the old separate add-on website");
assert.match(vmesBuildSource, /url=\.\.\/index\.html#namestitev/, "The old add-on URL should redirect back to the unified homepage");
assert.match(vmesBuildSource, /\.replace\('href="breathing\.html"', 'href="\.\.\/dihanje\/"'\)/, "Exercise navigation should use stable clean URLs rather than file-specific page paths");
assert.doesNotMatch(packageSource, /fs\.rmSync\(dist,\s*\{\s*recursive:\s*true/, "Packaging the browser extension should preserve the independently built Vmes site");
assert.match(packageSource, /readdirSync\(dist,\s*\{\s*withFileTypes:\s*true\s*\}\)/, "Extension packaging should only clean its own archive files from dist");
assert.match(soundSource, /new URL\(`\.\.\/\$\{sound\.asset\}`, soundsScriptUrl\)\.href/, "Recorded breathing cues should resolve from the standalone website as well as the extension");
assert.match(breathingStyles, /@media \(max-width: 600px\)[\s\S]*?\.breathing-visual\s*\{[^}]*position:\s*fixed[^}]*top:\s*50%[^}]*left:\s*50%[^}]*transform:\s*translate\(-50%,\s*-50%\)/s, "The breathing animation should stay centered in the viewport on mobile");
assert.match(breathingStyles, /@media \(min-width: 601px\)[\s\S]*?\.breathing-visual\s*\{[^}]*position:\s*fixed[^}]*top:\s*50%[^}]*left:\s*50%[^}]*transform:\s*translate\(-50%,\s*-50%\)/s, "The breathing animation should stay centered in the viewport on desktop");
assert.doesNotMatch(breathingStyles, /\.breathing-page-body\[data-settings-open="true"\]\s+\.breathing-visual/, "Opening settings should not reposition or resize the breathing animation");
assert.match(breathingStyles, /\.breathing-accordion-summary\s*\{[^}]*min-height:\s*56px[^}]*display:\s*grid/s, "Settings accordions should use a clear, touch-friendly summary row");
assert.match(breathingStyles, /@media \(min-width: 601px\)[\s\S]*?\.breathing-settings\s*\{[^}]*position:\s*fixed[^}]*bottom:\s*20px[^}]*width:\s*min\(520px,\s*calc\(100vw - 32px\)\)/s, "Desktop breathing settings should open as a compact floating bottom sheet instead of a wide inline panel");
assert.match(breathingStyles, /@media \(min-width: 601px\)[\s\S]*?\.breathing-settings-content\s*\{[^}]*overflow-y:\s*auto/s, "Desktop settings should scroll within the bottom sheet");
assert.match(breathingStyles, /@media \(min-width: 601px\)[\s\S]*?\.breathing-settings\s*\{[^}]*right:\s*50%[^}]*width:\s*min\(520px,\s*calc\(100vw - 32px\)\)[^}]*transform:\s*translateX\(50%\)/s, "Desktop settings should stay in a compact bottom sheet that does not cover the centered breathing visual");
assert.match(breathingStyles, /\.breathing-rhythm-current\s*\{[^}]*align-items:\s*baseline[^}]*justify-content:\s*flex-end[^}]*gap:\s*9px[^}]*text-align:\s*right/s, "Selected rhythm name and timing should share one compact, right-aligned line");
assert.match(breathingStyles, /\.breathing-accordion-option\s*\{[^}]*min-height:\s*42px/s, "Setting choices should be presented as touch-friendly in-flow rows");
assert.doesNotMatch(breathingPage.match(/id="technique-options"[\s\S]*?<\/div>/)?.[0] ?? "", /<small>/, "Rhythm options should not repeat descriptions as a second text line");
assert.match(breathingSource, /document\.addEventListener\("keydown", event => \{\s*if \(event\.key === "Escape" && !techniqueOptionsPanel\.hidden\)/, "Escape should close an open rhythm list");
assert.match(breathingSource, /customRhythmSection\.hidden = techniqueKey !== "custom"/, "Custom phase sliders should stay hidden until the user chooses their own rhythm");
assert.match(breathingSource, /function updateTechniquePicker\(\)/, "The selected rhythm name and timing should stay synchronized with the custom picker");
assert.match(breathingSource, /function getSteps\(\)/, "Breathing guide should construct session phases from the custom sliders");
assert.match(breathingSource, /visualStyle === "fill" \? 1\.04 : scale/, "Edge-fill animation should use a fixed outer contour");
assert.match(breathingPage, /id="breathing-rings" class="breathing-rings"/, "Breathing guide should include its original concentric-ring animation");
assert.match(breathingPage, /id="breathing-ripples" class="breathing-ripples"/, "Breathing guide should include its layered outward-wave visual");
assert.match(breathingPage, /class="breathing-ripple breathing-ripple-outer"[\s\S]*?class="breathing-ripple breathing-ripple-middle"[\s\S]*?class="breathing-ripple breathing-ripple-inner"[\s\S]*?id="breathing-ripple-core"[^>]*r="30"/, "Outward waves should use nested filled circles with an animated center on top");
assert.match(breathingStyles, /\.breathing-ripple-core\s*\{[^}]*opacity:\s*1/s, "The growing center wave should fully cover the rings beneath it");
assert.doesNotMatch(breathingPage, /breathing-meditator|Stilizirani meditant/, "The disliked code-drawn meditator should be fully removed");
assert.match(breathingPage, /<\/defs>\s*<g id="breathing-rings"[\s\S]*?<\/g>\s*<g id="breathing-ripples"/, "Breathing animations should be visible SVG content outside definitions");
assert.match(breathingPage, /data-technique-choice="custom" data-label="Moj ritem"/, "Manual breathing controls should be clearly identified as the user's own rhythm");
const backgroundOptions = breathingPage.match(/<select id="background-mode"[\s\S]*?<\/select>/)?.[0] ?? "";
assert.deepEqual([...backgroundOptions.matchAll(/<option value="(breath|orbit|combined|center|still|off)"/g)].map(match => match[1]), ["breath", "orbit", "combined", "center", "still", "off"], "Ambient particles should offer breathing, orbiting, converging, still, and disabled modes");
assert.match(breathingSource, /backgroundMode === "center"[\s\S]*?particle\.radius -= particle\.inwardSpeed \* delta[\s\S]*?particle\.radius = particle\.maxRadius[\s\S]*?const centerFade = followsCenter \? Math\.min\(1, convergence \* 5, \(1 - convergence\) \* 7\)/, "The center mode should softly stream particles to the center and recycle them without visible popping");
assert.match(breathingPage, /id="background-mode"[^>]*hidden[\s\S]*?<option value="breath" selected>Navznoter in navzven/, "Ambient particles should breathe in and out by default");
assert.match(breathingPage, /data-setting-target="visual-style" data-value="ripple"[^>]*aria-pressed="false">Valovi navzven/, "Visual styles should be selectable directly from their accordion option rows");
assert.match(breathingSource, /settingsAccordions\.forEach\(accordion => \{\s*accordion\.addEventListener\("toggle"/, "Only one settings accordion should remain open at a time");
assert.match(breathingSource, /select\.dispatchEvent\(new Event\("change", \{ bubbles: true \}\)\)/, "Accordion options should keep existing setting-change behavior");
assert.match(breathingSource, /value\.textContent = selectedOption\.textContent/, "Accordion summaries should show the active setting value");
assert.match(breathingStyles, /\.breathing-accordion\[open\]\s*\{[^}]*background:\s*transparent/, "Expanded settings should stay visually quiet instead of adding another card background");
assert.match(breathingPage, /Spremembe med vajo začnejo veljati takoj/, "Breathing controls should explain that phase edits apply immediately");
assert.match(breathingSource, /shapeChoices\.hidden = \["rings", "ripple", "none"\]\.includes\(visualStyle\)/, "Irrelevant shape controls should be hidden for wave and no-shape visuals");
assert.match(breathingSource, /function restartAfterSettingsChange\(\)\s*\{\s*const resume = isRunning;\s*resetSession\(\);\s*if \(resume\) startSession\(\);\s*\}/, "Changing an exercise setting should restart the current session from the beginning");
assert.doesNotMatch(breathingSource, /techniqueButton\.disabled\s*=\s*isRunning|durationSelect\.disabled\s*=\s*isRunning|option\.disabled\s*=\s*isRunning/, "Breathing options should stay available while a session is running");
assert.match(breathingSource, /option\.addEventListener\("click", \(\) => selectTechnique\(option\.dataset\.techniqueChoice\)\)/, "Selecting a new rhythm should restart the session through the shared selection handler");
assert.match(breathingSource, /slider\.addEventListener\("input", updateSliderOutputs\);\s*slider\.addEventListener\("change", \(\) => \{\s*restartAfterSettingsChange\(\);\s*saveBreathingPreferences\(\);/, "Custom phase edits should update their values, restart the current session, and save when committed");
assert.match(breathingSource, /shapeChoices\.hidden = \["rings", "ripple", "none"\]\.includes\(visualStyle\);\s*drawShape\(currentScale, performance\.now\(\) \* 0\.0007\);[\s\S]*?restartAfterSettingsChange\(\);/, "Visual style changes should be applied before restarting the exercise");
assert.match(breathingSource, /particleFlow = 0\.86;\s*particleFlowStart = particleFlow;\s*particleFlowEnd = particleFlow;/, "Restarting an exercise should restore the particle flow to its initial state");
assert.match(breathingSource, /function drawShape\(scale = currentScale, phase = 0, breathProgress = currentWaveProgress\)/, "Shape drawing should preserve and update the current breathing-wave position");
assert.match(breathingSource, /let currentWaveProgress = 0\.35/, "Outward waves should be visible before a session starts");
assert.match(breathingSource, /rippleCore\.setAttribute\("r", String\(30 \+ currentWaveProgress \* 58\)\)/, "The center wave should expand over the nested circles on inhale and reveal them on exhale");
assert.match(breathingSource, /const waveProgress = step\.scale > fromScale[\s\S]*?1 - easedProgress[\s\S]*?step\.scale > 0\.9 \? 1 : 0/, "Outward ripples should follow inhale, exhale, and held phases");
assert.match(breathingSource, /monkImage\.style\.setProperty\("--motif-scale", String\(0\.96 \+ \(scale - 0\.78\) \* 0\.2\)\)/, "Meditation images should retain a gentler breathing scale");
assert.match(breathingSource, /Array\.from\(\{ length: 900 \}/, "Breathing atmosphere should use a denser field of visible particles");
assert.match(breathingSource, /speedTier < 0\.45[\s\S]*?speedTier < 0\.72[\s\S]*?speedTier < 0\.9[\s\S]*?speedTier < 0\.98/, "Ambient particles should use five speed groups ranging from swift to nearly still");
assert.match(breathingSource, /backgroundMode = backgroundModeSelect\.value;\s*backgroundEnabled = backgroundMode !== "off";\s*atmosphereCanvas\.hidden = !backgroundEnabled/, "Ambient motion should be adjustable without leaving the breathing page");
assert.match(breathingSource, /backgroundMode === "breath" \|\| backgroundMode === "combined"/, "Breathing particle modes should follow the inhale/exhale flow");
assert.match(breathingSource, /backgroundMode === "orbit" \|\| backgroundMode === "combined"/, "Orbit particle modes should move around the visual");
assert.match(breathingSource, /const orbitSpeed = backgroundMode === "combined" \? 0\.08 : 0\.22/, "Particle orbiting should remain very slow, especially when combined with radial breathing");
assert.match(breathingSource, /Math\.sin\(now \* 0\.000045\) \* width \* 0\.008[\s\S]*?Math\.cos\(now \* 0\.00004\) \* height \* 0\.006/, "Combined particles should keep their center almost fixed so radial breathing remains dominant");
assert.match(breathingSource, /const trail = 2 \+ Math\.min\(particle\.speed \* 900,\s*2\.5\)[\s\S]*?alpha \* 0\.22/, "Orbit trails should stay short and subtle");
assert.match(breathingSource, /particle\.flow \+= \(idlePulse - particle\.flow\) \* \(1 - Math\.exp\(-particle\.flowSpeed \* delta\)\)/, "Each particle should respond to the breath cycle at its own speed");
assert.match(breathingSource, /particleFlowEnd = step\.scale > currentScale \? 1\.38 : step\.scale < currentScale \? 0\.58/, "Particles should expand clearly on inhale and contract clearly on exhale");
assert.match(breathingSource, /backgroundMode !== "still"/, "Still particles should avoid a continuous animation frame loop");
assert.match(breathingSource, /followsOrbit \? Math\.sin\(now \* 0\.000045\)[\s\S]*?followsOrbit \? Math\.cos\(now \* 0\.00004\)/, "Radial-only particles should not drift their center around the visual");
assert.match(breathingSource, /slider\.addEventListener\("input", updateSliderOutputs\)/, "Phase durations should update while their sliders are dragged");
assert.doesNotMatch(breathingSource, /slider\.disabled\s*=\s*isRunning/, "Phase sliders should remain available during a session");
assert.match(breathingSource, /restartAfterSettingsChange\(\);/, "Changing a setting should restart a running exercise from the beginning");
assert.match(breathingStyles, /\.breathing-visual\s*\{[^}]*width:\s*min\(87svh,\s*750px\)/s, "Breathing visual should be about 50% larger on desktop while scaling with the viewport");
assert.match(breathingStyles, /@media[^{]*\{[\s\S]*?\.breathing-visual\s*\{[^}]*width:\s*min\(100vw,\s*87svh,\s*750px\)/s, "Breathing visual should scale up on small screens without exceeding viewport width");
assert.match(breathingStyles, /\.breathing-phase\s*\{[^}]*font-size:\s*clamp\(15px,\s*2\.4vw,\s*22px\)/s, "Breathing phase text should stay restrained inside the enlarged visual");
assert.match(breathingStyles, /\.breathing-countdown\s*\{[^}]*font-size:\s*12px/s, "Breathing countdown text should be smaller than the phase instruction");
assert.doesNotMatch(breathingPage, /breathing-technique-note|breathing-heading|breathing-safety(?! breathing-sr-only)/, "Breathing page should not add visible explanatory copy below the controls");
assert.match(breathingStyles, /\.breathing-readout\s*\{[^}]*position:\s*absolute/s, "Breathing phase should be displayed over the breathing visual");
assert.match(breathingSource, /prefers-reduced-motion/, "Breathing animation should respect reduced-motion preferences");
assert.match(breathingStyles, /\.breathing-page-body \.top-bar,\s*\.exercise-page-body \.top-bar\s*\{[^}]*border:\s*0/s, "Breathing and exercise headers should not have a border");
assert.match(breathingStyles, /\.breathing-tool\s*\{[^}]*background:\s*transparent/s, "Breathing controls should sit directly on the page background");
assert.match(breathingStyles, /\.breathing-page-body \.nav-btn,\s*\.exercise-page-body \.nav-btn,[\s\S]*?\.breathing-page-body \.nav-btn-close\s*\{[^}]*border:\s*0/s, "Breathing and exercise navigation should not have borders");
assert.match(breathingStyles, /@media \(max-width: 760px\)[\s\S]*?\.top-bar,[\s\S]*?flex-wrap:\s*wrap/s, "Exercise navigation should move to a clean second row on narrower screens");
assert.match(breathingStyles, /@media \(max-width: 520px\)[\s\S]*?\.nav-links \.nav-btn span\s*\{\s*display:\s*none/s, "Narrow-screen navigation should retain compact accessible icon controls");
assert.match(breathingStyles, /\.breathing-choice\.is-selected\s*\{[^}]*background:\s*var\(--accent\)[^}]*color:\s*#fff/s, "Selected breathing options should use one consistent segmented-control style");
assert.match(breathingStyles, /\.breathing-accordion-option\s*\{[^}]*min-height:\s*42px/s, "Accordion option rows should have a comfortable touch target");
const eyeExercisesSource = fs.readFileSync(path.join(root, "extension/exercises/eyes.js"), "utf8");
const stretchesSource = fs.readFileSync(path.join(root, "extension/exercises/stretches.js"), "utf8");
const blockedPageSource = fs.readFileSync(path.join(root, "extension/exercises/blocked.js"), "utf8");
const tabControlsSource = fs.readFileSync(path.join(root, "extension/exercises/tab-controls.js"), "utf8");
for (const page of ["breathing.html", "eyes.html", "stretches.html", "blocked.html"]) {
  const html = fs.readFileSync(path.join(root, "extension/exercises", page), "utf8");
  assert.match(html, /<script src="tab-controls\.js"><\/script>/, `${page} should use the working extension tab-close control`);
}
assert.match(tabControlsSource, /type:\s*"CLOSE_EXERCISE_TAB"/, "Close button should delegate tab removal to the extension");
assert.match(tabControlsSource, /console\.error\("Zapiranje zavihka ni uspelo:"/, "Tab-close failures should be surfaced instead of silently ignored");
assert.doesNotMatch(`${eyeExercisesSource}\n${stretchesSource}\n${blockedPageSource}\n${breathingSource}`, /window\.close\(/, "Exercise pages should not rely on window.close()");
assert.doesNotMatch(breathingSource, /closeTabBtn/, "Breathing page should not retain an unused tab-close handler");
assert.match(eyeExercisesSource, /selectExercise\(0\)/, "Finishing eye exercises should keep the tab open and offer a restart");
assert.match(stretchesSource, /selectStretch\(0\)/, "Finishing seated exercises should keep the tab open and offer a restart");
assert.match(fs.readFileSync(path.join(root, "extension/background.js"), "utf8"), /message\.type === "CLOSE_EXERCISE_TAB"[\s\S]*?sender\?\.url\?\.startsWith\(exercisePagePrefix\)[\s\S]*?browser\.tabs\.remove\(sender\.tab\.id\)/, "Extension should close only the requesting exercise tab");
const backgroundSource = fs.readFileSync(path.join(root, "extension/background.js"), "utf8");
assert.match(backgroundSource, /STRETCH_GROUPS\s*=\s*\["neck",\s*"upper",\s*"legs"\]/, "Reminder rotation should include all body exercise groups");
const exerciseCss = fs.readFileSync(path.join(root, "extension/exercises/exercises.css"), "utf8");
assert.match(exerciseCss, /\.exercise-photo-art\.is-mirrored\s*\{\s*transform:\s*scaleX\(-1\)/, "Exercise image horizontal-mirror style missing");

for (const directory of ["extension"]) {
  for (const size of [16, 32, 48, 96, 128]) {
    const iconPath = path.join(root, directory, "icons", `icon-${size}.png`);
    const png = fs.readFileSync(iconPath);
    assert.equal(png.toString("ascii", 1, 4), "PNG", `Invalid PNG icon: ${iconPath}`);
    assert.equal(png.readUInt32BE(16), size, `Unexpected PNG width: ${iconPath}`);
    assert.equal(png.readUInt32BE(20), size, `Unexpected PNG height: ${iconPath}`);
  }
}
for (const iconPath of [
  "extension/icons/icon-48.svg", "extension/icons/icon-96.svg", "extension/icons/icon-128.svg"
]) {
  const svg = fs.readFileSync(path.join(root, iconPath), "utf8");
  assert.match(svg, /#267c68/i, `Vmes green background missing: ${iconPath}`);
  assert.match(svg, /#f5f8f0/i, `V monogram missing: ${iconPath}`);
  assert.match(svg, /#f2c66d/i, `Vmes accent dot missing: ${iconPath}`);
  assert.match(svg, /M34 30 64 88 94 30/, `Vmes monogram missing: ${iconPath}`);
  assert.match(svg, /<circle cx="64" cy="108" r="10"/, `Vmes accent dot missing: ${iconPath}`);
  assert.doesNotMatch(svg, /#23364a|#e27b5b|icon-window|clock-hand/i, `Old browser-window logo should be removed: ${iconPath}`);
  assert.doesNotMatch(svg, /linearGradient|feDropShadow/i, `Logo should use a restrained flat style: ${iconPath}`);
}
for (const file of ["extension/lib/icons.js", "extension/lib/sounds.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context);
}

let systemThemeChange;
const systemMedia = { matches: true, addEventListener: (_event, listener) => { systemThemeChange = listener; } };
const inlineStyles = new Map();
const appearanceContext = {
  window: { matchMedia: () => systemMedia },
  document: { body: {
    dataset: {},
    style: {
      removeProperty: property => inlineStyles.delete(property),
      setProperty: (property, value) => inlineStyles.set(property, value)
    }
  } }
};
appearanceContext.globalThis = appearanceContext;
vm.createContext(appearanceContext);
vm.runInContext(fs.readFileSync(path.join(root, "extension/lib/appearance.js"), "utf8"), appearanceContext);
appearanceContext.WebNudgeAppearance.apply({});
assert.equal(appearanceContext.document.body.dataset.palette, "forest", "The Vmes green palette should be the default appearance");
for (const palette of ["indigo", "lagoon", "forest", "sunset", "mono"]) {
  appearanceContext.WebNudgeAppearance.apply({ theme: palette, fontFamily: "serif", fontSize: "large" });
  assert.equal(appearanceContext.document.body.dataset.theme, "light", `Expected light theme: ${palette}`);
  assert.equal(appearanceContext.document.body.dataset.palette, palette);
  assert.equal(appearanceContext.document.body.dataset.fontFamily, "serif");
  assert.equal(appearanceContext.document.body.dataset.fontSize, "large");
}
for (const palette of ["mono-dark", "dark-color", "ocean", "cyber", "synth"]) {
  appearanceContext.WebNudgeAppearance.apply({ theme: palette });
  assert.equal(appearanceContext.document.body.dataset.theme, "dark", `Expected dark theme: ${palette}`);
}
appearanceContext.WebNudgeAppearance.apply({ theme: "system" });
assert.equal(appearanceContext.document.body.dataset.theme, "dark");
systemMedia.matches = false;
systemThemeChange();
assert.equal(appearanceContext.document.body.dataset.theme, "light");
appearanceContext.WebNudgeAppearance.apply({
  theme: "custom",
  customThemeBase: "ocean",
  customColors: { background: "#112233", surface: "#223344", accent: "#345678", text: "#eeeeee", muted: "#cccccc", border: "#445566" }
});
assert.equal(appearanceContext.document.body.dataset.theme, "dark", "Custom colors should preserve their selected dark base palette");
assert.equal(inlineStyles.get("--bg"), "#112233", "Custom background should be applied as a shared appearance token");
assert.equal(inlineStyles.get("--primary"), "#345678", "Custom accent should reach popup and exercise appearance tokens");
appearanceContext.WebNudgeAppearance.apply({ theme: "forest" });
assert.equal(inlineStyles.has("--bg"), false, "Selecting a preset palette should clear custom inline colors");

const icons = context.WebNudgeIcons.getAllIcons();
const iconKeys = icons.map(icon => icon.key);
assert.equal(new Set(iconKeys).size, iconKeys.length, "Icon keys must be unique");
for (const icon of icons) {
  assert.ok(icon.name && icon.category, `Icon metadata missing: ${icon.key}`);
  assert.doesNotMatch(icon.category, /&/, `Use Slovenian conjunctions in icon categories: ${icon.key}`);
  assert.match(icon.svg, /^<svg\b[\s\S]*<\/svg>$/, `Invalid SVG icon: ${icon.key}`);
}
for (const key of ["heart-pulse", "footprints", "dumbbell", "brain", "bed", "briefcase"]) {
  assert.ok(iconKeys.includes(key), `Expected curated icon: ${key}`);
}

const sounds = context.WebNudgeSounds.getAllSounds();
const soundIds = sounds.map(sound => sound.id);
assert.equal(new Set(soundIds).size, soundIds.length, "Sound IDs must be unique");
for (const sound of sounds) {
  assert.ok(sound.name && sound.category && sound.desc, `Sound metadata missing: ${sound.id}`);
  assert.doesNotMatch(sound.category, /&/, `Use Slovenian conjunctions in sound categories: ${sound.id}`);
  if (sound.asset) {
    const assetPath = path.join(root, "extension", sound.asset);
    assert.ok(fs.existsSync(assetPath), `Sound asset missing: ${sound.asset}`);
    assert.equal(fs.readFileSync(assetPath).toString("ascii", 0, 4), "OggS", `Sound asset is not a valid OGG container: ${sound.asset}`);
  } else {
    assert.ok(sound.frequencies.length > 0, `Synthesized sound must define tones: ${sound.id}`);
  }
}
for (const id of ["rising-chime", "soft-pulse", "wood-tap", "soft-click", "clear-click", "gentle-switch"]) {
  assert.ok(soundIds.includes(id), `Expected new sound: ${id}`);
}
for (const id of ["water-drop", "water-stream", "water-ripple", "rain-tap"]) {
  assert.doesNotMatch(fs.readFileSync(path.join(root, "extension/options/options.html"), "utf8"), new RegExp(`<option\\s+value="${id}"`), `Synthetic water sound must not be offered: ${id}`);
}

const scheduledNotes = [];
const createParam = () => ({
  setValueAtTime() {},
  setTargetAtTime() {},
  cancelScheduledValues() {},
  linearRampToValueAtTime() {},
  exponentialRampToValueAtTime() {}
});
const audioContext = {
  state: "running",
  currentTime: 1,
  destination: {},
  createGain: () => ({ gain: createParam(), connect() { return this; } }),
  createOscillator: () => ({
    frequency: createParam(),
    connect(node) { return node; },
    start(time) { scheduledNotes.push({ type: "start", time }); },
    stop(time) { scheduledNotes.push({ type: "stop", time }); }
  })
};
context.window.AudioContext = function () { return audioContext; };
for (const sound of sounds.filter(item => ["rising-chime", "soft-pulse", "wood-tap"].includes(item.id))) {
  const before = scheduledNotes.length;
  context.WebNudgeSounds.play(sound.id, 0.5);
  const events = scheduledNotes.slice(before);
  assert.equal(events.filter(event => event.type === "start").length, sound.frequencies.length, `Sound notes not scheduled: ${sound.id}`);
  assert.equal(events.filter(event => event.type === "stop").length, sound.frequencies.length, `Sound notes not stopped: ${sound.id}`);
  assert.ok(events.every(event => Number.isFinite(event.time)), `Invalid audio timing: ${sound.id}`);
}
for (const [style, partialCount] of [["glass", 3], ["warm", 3], ["drop", 2], ["air", 3]]) {
  for (const phase of ["inhale", "inhaleAgain", "exhale", "holdIn", "holdOut"]) {
    const before = scheduledNotes.length;
    context.WebNudgeSounds.playBreathingCue(phase, style, 0.2);
    const events = scheduledNotes.slice(before);
    assert.equal(events.filter(event => event.type === "start").length, partialCount, `Breathing cue should layer the intended harmonics: ${style}/${phase}`);
    assert.equal(events.filter(event => event.type === "stop").length, partialCount, `Breathing cue harmonics should all stop: ${style}/${phase}`);
    assert.ok(events.every(event => Number.isFinite(event.time)), `Invalid breathing cue timing: ${style}/${phase}`);
    assert.ok(events.filter(event => event.type === "stop").every(event => event.time - audioContext.currentTime >= 0.6), `Breathing cue should decay gently: ${style}/${phase}`);
  }
}
const ambienceStart = scheduledNotes.length;
assert.equal(context.WebNudgeSounds.startBreathingAmbience("warm", 0.3), true, "The breathing ambience should start when selected");
context.WebNudgeSounds.setBreathingAmbiencePhase("exhale", 4);
assert.equal(context.WebNudgeSounds.setBreathingAmbienceVolume(0.2), true, "The breathing ambience volume should be adjustable without restarting the session");
context.WebNudgeSounds.stopBreathingAmbience();
const ambienceEvents = scheduledNotes.slice(ambienceStart);
assert.equal(ambienceEvents.filter(event => event.type === "start").length, 3, "The continuous ambience should use three soft synthesized layers");
assert.equal(ambienceEvents.filter(event => event.type === "stop").length, 3, "All continuous ambience layers should stop cleanly");
assert.match(breathingSource, /WebNudgeSounds\.playBreathingCue\(phase,\s*soundStyleSelect\.value,\s*getBreathingSoundVolume\(\)\)/, "Phase cues should use the selected sound style and volume");
assert.match(breathingSource, /WebNudgeSounds\.startBreathingAmbience\(soundStyleSelect\.value,\s*volume\)/, "Continuous sound should use the selected ambience style and volume");
const audioSamples = [];
context.browser = { runtime: { getURL: asset => `moz-extension://test/${asset}` } };
context.Audio = function (src) {
  this.src = src;
  this.addEventListener = () => {};
  this.play = () => { audioSamples.push(this.src); return Promise.resolve(); };
};
for (const sound of sounds.filter(item => item.asset)) context.WebNudgeSounds.play(sound.id, 0.4);
assert.equal(JSON.stringify(audioSamples.sort()), JSON.stringify(sounds.filter(item => item.asset).map(sound => `moz-extension://test/${sound.asset}`).sort()));

const optionsHtml = fs.readFileSync(path.join(root, "extension/options/options.html"), "utf8");
const optionsCss = fs.readFileSync(path.join(root, "extension/options/options.css"), "utf8");
const siteIconPages = [
  ["extension/index.html", "icons/icon-96.svg"],
  ["extension/popup/popup.html", "../icons/icon-96.svg"],
  ["extension/notification/notification.html", "../icons/icon-96.svg"],
  ["extension/options/options.html", "../icons/icon-96.svg"],
  ["extension/onboarding/onboarding.html", "../icons/icon-96.svg"],
  ["extension/exercises/breathing.html", "../icons/icon-96.svg"],
  ["extension/exercises/eyes.html", "../icons/icon-96.svg"],
  ["extension/exercises/stretches.html", "../icons/icon-96.svg"],
  ["extension/exercises/blocked.html", "../icons/icon-96.svg"]
];
for (const [file, iconPath] of siteIconPages) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  assert.ok(html.includes(`<link rel="icon" type="image/svg+xml" href="${iconPath}?v=20261029-2">`), `Versioned Vmes favicon missing from ${file}`);
}
assert.match(vmesPage, /class="vmes-mark" src="icons\/icon-48\.svg\?v=20261029-2" alt=""/, "The Vmes homepage header should use the cache-busted brand mark");
const popupCss = fs.readFileSync(path.join(root, "extension/popup/popup.css"), "utf8");
for (const [palette, optionsRule] of [
  ["indigo", /:root\{[^}]*--accent:(#[0-9a-f]{6})/i],
  ["lagoon", /body\[data-palette="lagoon"\]\{[^}]*--accent:(#[0-9a-f]{6})/i],
  ["forest", /body\[data-palette="forest"\]\{[^}]*--accent:(#[0-9a-f]{6})/i],
  ["sunset", /body\[data-palette="sunset"\]\{[^}]*--accent:(#[0-9a-f]{6})/i],
  ["mono", /body\[data-palette="mono"\]\{[^}]*--accent:(#[0-9a-f]{3,6})/i],
  ["mono-dark", /body\[data-palette="mono-dark"\]\{[^}]*--accent:(#[0-9a-f]{3,6})/i],
  ["dark-color", /body\[data-palette="dark-color"\]\{--accent:(#[0-9a-f]{6})/i],
  ["ocean", /body\[data-palette="ocean"\]\{[^}]*--accent:(#[0-9a-f]{6})/i],
  ["cyber", /body\[data-palette="cyber"\]\{[^}]*--accent:(#[0-9a-f]{6})/i],
  ["synth", /body\[data-palette="synth"\]\{[^}]*--accent:(#[0-9a-f]{6})/i]
]) {
  const settingsMatch = optionsCss.match(optionsRule);
  const popupRule = new RegExp(`body\\[data-palette="${palette}"\\]\\s*\\{[^}]*--primary:\\s*(#[0-9a-f]{6})`, "i");
  const popupMatch = popupCss.match(popupRule);
  assert.ok(settingsMatch, `Appearance accent missing for ${palette}`);
  assert.ok(popupMatch, `Popup palette missing for ${palette}`);
  const normalizeHex = color => color.length === 4
    ? `#${[...color.slice(1)].map(channel => channel + channel).join("")}`.toLowerCase()
    : color.toLowerCase();
  assert.equal(normalizeHex(popupMatch[1]), normalizeHex(settingsMatch[1]), `Popup accent differs from settings for ${palette}`);
}
assert.doesNotMatch(popupCss, /body\[data-palette="forest"\]\s*\{[^}]*--primary:\s*#16a34a/i, "Popup must not use the old oversaturated forest green");
assert.match(popupCss, /\.hero-mini\s*\{[^}]*padding:\s*14px 0 8px;[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s, "The next reminder should be emphasized without another bordered card");
assert.match(popupCss, /width:\s*min\(440px,\s*100vw\)/, "The popup should be comfortably wide on desktop while still fitting narrow screens");
assert.match(popupCss, /\.items-list\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s, "The reminder list should use spacing instead of a bordered container");
assert.match(optionsHtml, /<link rel="icon" type="image\/svg\+xml" href="\.\.\/icons\/icon-96\.svg\?v=20261029-2">/, "Settings page must use the cache-busted extension logo as its favicon");
assert.match(optionsHtml, /role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-message"/, "Settings dialog should expose its title and description");
assert.match(optionsHtml, /<h2 id="modal-title"/, "Settings dialog title should use a heading");
assert.match(optionsHtml, /<details class="reminder-tools">[\s\S]*?<summary>Iskanje, filtri in množična dejanja<\/summary>[\s\S]*?<label for="reminder-search">[\s\S]*?<input id="reminder-search" type="search"/, "Optional reminder tools should be collapsed behind a disclosure with an explicit label");
assert.match(optionsHtml, /<label for="reminder-filter">Prikaži<\/label>[\s\S]*?<select id="reminder-filter">/, "Reminder filter should have a visible label");
assert.match(optionsHtml, /<div class="filter-pills" id="filter-pills" role="group" aria-label="Hitri filtri opomnikov">[\s\S]*?id="stat-all" data-filter="all" type="button" aria-pressed="true"[\s\S]*?id="stat-enabled" data-filter="enabled" type="button" aria-pressed="false"[\s\S]*?id="stat-disabled" data-filter="disabled" type="button" aria-pressed="false"/, "Quick reminder filters should be visible, accessible, and expose their selected state");
assert.match(optionsHtml, /<p id="reminder-summary" class="sr-only" aria-live="polite">/, "Reminder count changes should remain available to screen readers");
assert.match(optionsHtml, /<fieldset class="toolbar-bulk-actions">[\s\S]*?<legend>Upravljanje vseh opomnikov<\/legend>/, "Bulk reminder actions should be grouped and labeled accessibly");
assert.match(optionsHtml, /<\/details>\s*<div class="reminders-table" role="table"[\s\S]*?<div id="all-reminders"/, "Advanced reminder search and filters should stay separate from the visible quick controls");
assert.ok(fs.existsSync(path.join(root, "extension/icons/icon-96.svg")), "Settings favicon asset must exist");
const popupScript = fs.readFileSync(path.join(root, "extension/popup/popup.js"), "utf8");
const popupHtml = fs.readFileSync(path.join(root, "extension/popup/popup.html"), "utf8");
const optionsScript = fs.readFileSync(path.join(root, "extension/options/options.js"), "utf8");
const onboardingHtml = fs.readFileSync(path.join(root, "extension/onboarding/onboarding.html"), "utf8");
assert.match(popupScript, /setInterval\(refreshCountdowns,\s*1000\)/, "Popup countdown should refresh without rebuilding the reminder list");
assert.match(optionsScript, /setInterval\(updateLiveTimers,\s*1000\)/, "Options reminder countdowns should update once per second");
assert.match(popupScript, /pauseBtn\.innerHTML\s*=/, "Popup pause control should use a scalable icon");
assert.match(popupScript, /"Čez 15 min"|relativeCountdown\(due\.at,\s*now\)/, "The primary reminder should show a concise relative countdown");
assert.match(popupScript, /TRIGGER_REMINDER_NOW/, "The quiet per-reminder action should still allow an immediate preview");
assert.doesNotMatch(popupScript, /demo-[123]|Čez 23 min/, "The popup should not substitute fictional reminders when extension state cannot be loaded");
assert.match(popupHtml, /id="pause-all" class="hero-toggle"/, "The popup should present the all-reminders control beside the next reminder");
assert.match(popupHtml, /<details class="section focus-section">[\s\S]*id="focus-list"/, "Website restrictions should stay available but collapsed until requested");
assert.match(popupHtml, /<details class="quick-add">[\s\S]*data-minutes="20"/, "Quick-add actions should stay available in a collapsed section");
assert.doesNotMatch(popupHtml, /class="bottom-nav"|id="open-stats"|id="open-options"/, "The popup should avoid a redundant four-button navigation bar");
assert.equal([...popupHtml.matchAll(/data-minutes="(?:10|5|20)"[^>]*aria-label="[^"]+"/g)].length, 3, "Quick reminder buttons should clearly name the updated starter reminders");
assert.match(optionsScript, /eyes: \{[^}]*interval: 10/s, "The eye reminder preset should match the new default interval");
assert.match(optionsScript, /water: \{[^}]*interval: 5/s, "The water reminder preset should match the new default interval");
assert.match(optionsScript, /movement: \{[^}]*interval: 20/s, "The movement reminder preset should match the new default interval");
assert.match(optionsHtml, /id="message-mode"[\s\S]*?value="rotate">Samodejno menjaj sporočila[\s\S]*?value="custom">Uporabi moje besedilo/, "The reminder editor should let users choose rotating or fixed custom messages");
assert.match(optionsScript, /function updateMessageModeUi\(\)[\s\S]*?custom-message-field[\s\S]*?rotating-message-help[\s\S]*?getReminderMessagePool/, "The reminder editor should show the matching message controls and preview the selected message pool");
assert.match(optionsScript, /messageMode: \$\("message-mode"\)\?\.value === "rotate" \? "rotate" : "custom"/, "The selected message mode should be saved with the reminder");
assert.match(optionsScript, /messageCursor: Number\(\$\("reminder-form"\)\.dataset\.messageCursor\) \|\| 0/, "Editing a reminder should preserve its message rotation position");
assert.match(optionsScript, /if \(!res \|\| !Array\.isArray\(res\.reminders\)\) throw new Error/, "The options page should report missing extension state instead of showing preview data");
assert.match(onboardingHtml, /Odmor za oči[\s\S]*?Vsakih 10 min/, "Onboarding should describe the updated eye reminder interval");
assert.match(onboardingHtml, /odmor za oči \(10 min\), razteg \(20 min\) in voda \(5 min\)/, "Onboarding should list the updated built-in reminder intervals");
assert.match(popupHtml, /id="next-progress" role="progressbar"/, "Popup should expose the interval progress accessibly");
assert.match(popupHtml, /id="focus-list"/, "Popup should provide a space for configured website restrictions");
assert.match(popupScript, /function renderFocusRules\(/, "Popup should render actual focus rules");
assert.match(popupScript, /function siteUsageForRule\(/, "Popup should calculate today's usage for matching site rules");
for (const id of soundIds.filter(id => !["water-drop", "water-stream", "water-ripple", "rain-tap"].includes(id))) {
  assert.match(optionsHtml, new RegExp(`<option\\s+value="${id}"`), `Sound missing from selector: ${id}`);
}
for (const palette of ["indigo", "lagoon", "forest", "sunset", "mono", "mono-dark", "dark-color", "ocean", "cyber", "synth", "system"]) {
  assert.match(optionsHtml, new RegExp(`data-theme-choice="${palette}"`), `Theme missing from appearance settings: ${palette}`);
}
assert.match(optionsHtml, /Zelena tema Vmes je privzeta/);
assert.match(optionsHtml, /data-theme-choice="forest" aria-pressed="true"/);
assert.match(optionsHtml, /<strong>Vmes <span class="theme-default-tag">Privzeto<\/span><\/strong>/);
assert.doesNotMatch(optionsHtml, /data-theme-choice="color"/);
assert.match(optionsHtml, /class="theme-default-tag">Privzeto<\/span>/);
for (const id of ["background", "surface", "accent", "text", "muted", "border"]) {
  assert.match(optionsHtml, new RegExp(`id="custom-color-${id}"`), `Custom color input missing: ${id}`);
}
assert.match(optionsHtml, /id="reset-custom-colors"/);
const themeOptionsScript = fs.readFileSync(path.join(root, "extension/options/options.js"), "utf8");
assert.match(themeOptionsScript, /const selectedTheme = \["color", "light"\]\.includes\(theme\) \? "mono" : \(theme \|\| "forest"\)/, "Unspecified theme selection should resolve to the Vmes green palette");
assert.match(themeOptionsScript, /const STANDALONE_SETTINGS_KEY = "vmes-options-preview-settings"/, "Standalone settings should use a separate preview storage key");
assert.match(themeOptionsScript, /if \(typeof browser === "undefined" \|\| !browser\.runtime\?\.sendMessage\) \{[\s\S]*?localStorage\.setItem\(STANDALONE_SETTINGS_KEY, JSON\.stringify\(settings\)\)[\s\S]*?applyAppearance\(settings\)/, "Theme selection should work and persist in the standalone settings preview");
assert.match(themeOptionsScript, /customThemeBase: theme, customColors: null/, "Choosing a preset should reset custom colors to that palette");
assert.match(themeOptionsScript, /theme: "custom", customThemeBase, customColors/, "Changing a color should save a custom palette");
assert.match(themeOptionsScript, /saveSettings\(\{ theme, customThemeBase: theme, customColors: null \}\)/, "Resetting custom colors should restore the selected base palette");
assert.match(popupCss, /font-family: 'Google Sans', 'Segoe UI', sans-serif/, "The popup should use the bundled Google Sans font");
assert.match(popupCss, /body\[data-palette="forest"\]\s*\{[^}]*--primary:\s*#267c68/s, "The Vmes palette should use the homepage's green accent in the popup");
assert.match(optionsCss, /body\[data-palette="forest"\]\{[^}]*--bg:#f5f8f0;[^}]*--accent:#267c68/, "The Vmes palette should match the homepage's green background and accent in settings");
assert.match(optionsCss, /body\[data-theme="light"\] \.primary\{background:var\(--accent\);color:#fff\}body\[data-theme="light"\] \.primary:hover\{background:var\(--accent-dark\)\}/, "Light-theme primary buttons should use the selected palette accent");
for (const choice of ["system", "humanist", "readable", "serif"]) {
  assert.match(optionsHtml, new RegExp(`<option\\s+value="${choice}"`), `Font missing from appearance settings: ${choice}`);
}
for (const choice of ["compact", "standard", "large", "larger"]) {
  assert.match(optionsHtml, new RegExp(`<option\\s+value="${choice}"`), `Text size missing from appearance settings: ${choice}`);
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, "extension/manifest.json"), "utf8"));
assert.equal(manifest.name, "Vmes: opomniki za odmore in spletni fokus");
assert.equal(manifest.action.default_title, manifest.name, "Firefox toolbar should use the full add-on name");
assert.match(vmesPage, /<meta name="description" content="Vmes je Firefoxov dodatek/, "The homepage description should introduce the brand and Firefox category");
for (const file of [
  "extension/popup/popup.html",
  "extension/onboarding/onboarding.html",
  "extension/notification/notification.html",
  "extension/options/options.html"
]) {
  const page = fs.readFileSync(path.join(root, file), "utf8");
  assert.match(page, /Vmes: opomniki za odmore in spletni fokus/, `${file} should use the official add-on name`);
}
assert.match(fs.readFileSync(path.join(root, "STORE_LISTING.md"), "utf8"), /## Name\s+Vmes: opomniki za odmore in spletni fokus/, "The Mozilla Add-ons listing should use the official Slovenian name");
assert.match(fs.readFileSync(path.join(root, "STORE_LISTING_EN.md"), "utf8"), /Vmes: Break Reminders & Website Focus/, "The English listing should use the translated Vmes name");
const fontLicense = fs.readFileSync(path.join(root, "extension/fonts/OFL.txt"), "utf8");
assert.match(fontLicense, /Copyright 2025 The Google Sans Project Authors/, "The bundled font license should retain the font copyright notice");
assert.match(fontLicense, /SIL OPEN FONT LICENSE Version 1\.1/, "The bundled font license should be included");
assert.match(manifest.description, /časovne omejitve|omejitv/);
assert.ok(manifest.web_accessible_resources.some(entry => entry.resources.includes("sounds/*.ogg")), "Bundled sounds must be accessible to the in-page reminder");
assert.ok(manifest.web_accessible_resources.some(entry => entry.resources.includes("fonts/*.ttf")), "Bundled fonts must be accessible to the in-page reminder");
for (const file of [
  "extension/options/options.css",
  "extension/popup/popup.css",
  "extension/onboarding/onboarding.css",
  "extension/notification/notification.css",
  "extension/exercises/exercises.css",
  "extension/vmes.css"
]) {
  const css = fs.readFileSync(path.join(root, file), "utf8");
  assert.match(css, /@font-face\s*\{[^}]*font-family:\s*["']Google Sans["']/s, `${file} should register the bundled Google Sans font`);
  assert.match(css, /font-family:\s*["']Google Sans["']/, `${file} should use Google Sans as its default typeface`);
}
const contentScript = fs.readFileSync(path.join(root, "extension/content/content.js"), "utf8");
assert.match(contentScript, /browser\.runtime\.getURL\("fonts\/GoogleSans-Variable\.ttf"\)/, "The in-page reminder should load the bundled regular font");
assert.match(contentScript, /browser\.runtime\.getURL\("fonts\/GoogleSans-Italic-Variable\.ttf"\)/, "The in-page reminder should load the bundled italic font");
assert.match(contentScript, /font: 14px\/1\.45 'Google Sans',"Segoe UI",sans-serif/, "The in-page reminder should use Google Sans");
assert.match(contentScript, /\.primary \{ background:#267c68/, "The in-page reminder should use Vmes green accents");
const onboardingCss = fs.readFileSync(path.join(root, "extension/onboarding/onboarding.css"), "utf8");
assert.match(onboardingCss, /font-family: 'Google Sans', 'Segoe UI', sans-serif/, "Onboarding should use the bundled Google Sans font");
assert.match(onboardingCss, /--primary: #267c68/, "Onboarding should use the Vmes green accent");
assert.match(onboardingCss, /--bg: #f5f8f0/, "Onboarding should use the Vmes green-tinted background");
const background = fs.readFileSync(path.join(root, "extension/background.js"), "utf8");
assert.match(background, /files:\s*\["lib\/sounds\.js",\s*"content\/content\.js"\]/, "In-page reminders must load the shared sound library first");
const reminderStyles = optionsCss.slice(optionsCss.lastIndexOf("/* Desktop list:"));
assert.match(optionsScript, /function closeModal\(confirmed\)[\s\S]*?modalReturnFocus\.focus\(\)/, "Settings dialogs should restore focus when closed");
assert.match(optionsScript, /if \(event\.key === "Tab"\)[\s\S]*?last\.focus\(\)/, "Settings dialogs should keep keyboard focus inside the dialog");
assert.match(optionsScript, /if \(event\.key === "Escape"\)[\s\S]*?closeModal\(false\)/, "Escape should cancel rather than confirm a dialog action");
assert.match(optionsScript, /const cardTitle = document\.createElement\("h2"\)/, "Each reminder card should have a semantic heading");
assert.match(optionsScript, /btnEdit\.title = "Uredi nastavitve opomnika";[\s\S]*?btnEdit\.textContent = "Uredi";[\s\S]*?actionsBtns\.appendChild\(btnEdit\)/, "Reminder cards should label their editor action as Uredi");
assert.match(optionsScript, /actionsBtns\.appendChild\(toggleLabel\)/, "Reminder toggles should sit beside the edit action");
assert.doesNotMatch(optionsScript, /TRIGGER_REMINDER_NOW|Zaženi/, "Reminder cards should not offer a redundant manual trigger button");
assert.match(optionsScript, /document\.visibilityState === "hidden"[\s\S]*?return;/, "The live countdown timer should not run while the settings page is hidden");
assert.match(optionsScript, /document\.addEventListener\("visibilitychange"[\s\S]*?clearInterval\(liveTimerInterval\)/, "Hiding the settings page should stop its live countdown timer");
assert.match(optionsScript, /setInterval\(updateLiveTimers, 1000\)/, "Reminder countdowns should update once per second to expose seconds accurately");
assert.match(optionsCss, /\.cards#all-reminders\{grid-template-columns:minmax\(0,1fr\)!important\}/, "Reminder cards should use one full-width card per row");
assert.match(optionsCss, /#reminders \.reminders-table-head,\s*#reminders \.cards#all-reminders>\.reminder-card\{[\s\S]*?grid-template-columns:var\(--reminder-columns\)/, "Desktop reminder headings and rows should share one table grid");
assert.match(optionsCss, /#reminders \.cards#all-reminders>\.reminder-card\{[\s\S]*?grid-template-areas:"header info timing edit";[\s\S]*?gap:10px;/, "Large screens should keep reminder details in a compact row with gaps small enough to prevent the controls overflowing");
assert.match(optionsCss, /#reminders \.reminders-table-head,\s*#reminders \.cards#all-reminders>\.reminder-card\{[\s\S]*?column-gap:10px;/, "Desktop table headers and reminder columns should use the same gap");
assert.match(optionsCss, /#reminders \.cards#all-reminders \.card-schedule-text\{[^}]*width:100%;[^}]*justify-self:start;[^}]*text-align:left;/, "Reminder schedule text should align to the left edge of its table column");
assert.match(optionsCss, /#reminders \.cards#all-reminders \.switch-slider::after\{[\s\S]*?content:"IZKLOP"/, "Reminder switches should label the off state in Slovenian");
assert.match(optionsCss, /#reminders \.cards#all-reminders \.toggle-switch input:checked\+\.switch-slider::after\{[\s\S]*?content:"VKLOP"/, "Reminder switches should label the on state in Slovenian");
assert.match(optionsCss, /#reminders \.cards#all-reminders \.switch-slider::after\{[\s\S]*?font-family:inherit;[\s\S]*?font-size:9px;[\s\S]*?font-weight:700;[\s\S]*?letter-spacing:\.01em;/, "Reminder toggle labels should use readable system type with restrained tracking");
assert.match(optionsCss, /#reminders \.cards#all-reminders \.switch-slider::before\{[\s\S]*?transition:transform/, "Reminder switch thumb should animate when toggled");
assert.match(optionsCss, /@media\(prefers-reduced-motion:reduce\)[\s\S]*?transition:none/, "Reminder switch animation should respect reduced-motion preferences");
assert.doesNotMatch(optionsCss, /@container|container-name:reminders-list|container-type:inline-size/, "Reminder layout should use simple viewport breakpoints instead of container queries");
assert.match(optionsCss, /@media\(max-width:900px\)\{[\s\S]*?\.app\{display:block\}[\s\S]*?\.mobile-menu-toggle\{/, "The settings sidebar should switch to a menu at 900px");
assert.match(optionsCss, /@media\(max-width:900px\)\{[\s\S]*?\.mobile-topbar\{position:fixed;inset:0 0 auto;z-index:70;display:flex;[\s\S]*?\.sidebar\{position:fixed;inset:64px auto 0 0;[\s\S]*?\.sidebar-backdrop\{position:fixed;inset:64px 0 0;/, "The mobile menu should live in a fixed top bar above a drawer that opens below it");
assert.match(optionsCss, /\.mobile-menu-toggle\[aria-expanded=true\] \.mobile-menu-icon::before\{transform:translateY\(3px\) rotate\(45deg\)\}[\s\S]*?\.mobile-menu-toggle\[aria-expanded=true\] \.mobile-menu-icon::after\{transform:translateY\(-3px\) rotate\(-45deg\)\}/, "The menu icon should animate into a close icon while the sidebar is open");
assert.match(optionsHtml, /<header class="mobile-topbar">\s*<button id="mobile-menu-toggle"[^>]*aria-label="Odpri meni"><span class="mobile-menu-icon" aria-hidden="true"><\/span><\/button>\s*<div class="mobile-topbar-brand"><img src="\.\.\/icons\/icon-96\.svg\?v=20261029-2" alt=""><strong>Vmes<\/strong><\/div>\s*<\/header>/, "Mobile navigation should use one accessible menu toggle in a branded top bar");
assert.match(optionsHtml, /<link rel="stylesheet" href="\.\.\/vmes-navigation\.css">/, "Settings should reuse the shared Vmes navigation styles");
assert.match(optionsHtml, /<header class="top-bar site-header vmes-site-top-bar vmes-options-nav">[\s\S]*?href="\.\.\/exercises\/breathing\.html"[\s\S]*?href="\.\.\/exercises\/eyes\.html"[\s\S]*?href="\.\.\/exercises\/stretches\.html"[\s\S]*?<\/nav>/, "Desktop settings should provide the shared exercise navigation");
assert.doesNotMatch(optionsHtml.match(/<header class="top-bar site-header vmes-site-top-bar vmes-options-nav">[\s\S]*?<\/header>/)?.[0] ?? "", /nav-btn-addon|Več o Firefox dodatku/, "Settings navigation should not link back to the add-on landing page");
assert.match(optionsHtml, new RegExp(`id="about"[\\s\\S]*?class="about-website-link" href="${siteLinks.publicSiteUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>Spletna stran Vmes`), "The about section should provide a quiet link to the public Vmes website");
assert.match(optionsHtml, new RegExp(`class="app-support-cta" href="${siteLinks.supportPageUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" target="_blank" rel="noopener noreferrer">\\s*<svg[\\s\\S]*?Prispevajte za razvoj`), "Settings should provide a heart-marked contribution CTA in the shared footer");
assert.match(optionsHtml, /Vam je Vmes v pomoč\?<\/strong><span>S prostovoljnim prispevkom podprite njegov nadaljnji razvoj\./, "The support footer should use natural, polite Slovenian and explain the contribution");
assert.match(optionsCss, /\.app-support-footer\{[\s\S]*?justify-content:space-between;[\s\S]*?\.app-support-cta svg\{[\s\S]*?\.app-support-cta:focus-visible\{/, "The support CTA should be styled as an accessible, restrained footer action");
assert.match(optionsCss, /\.app>\.vmes-options-nav\{grid-column:1\/-1;grid-row:1\}[\s\S]*?@media\(max-width:900px\)\{\.app>\.vmes-options-nav\{display:none\}/, "The shared navigation should span the desktop settings layout and yield to the existing mobile bar");
assert.match(optionsScript, /window\.matchMedia\("\(max-width: 900px\)"\)/, "Sidebar accessibility behavior should use the same 900px viewport breakpoint");
assert.match(optionsCss, /@media\(max-width:650px\)\{[\s\S]*?#reminders \.reminders-table-head\{[^}]*display:none!important;[\s\S]*?grid-template-columns:max-content max-content 96px 56px;[\s\S]*?grid-template-areas:"header timing switch open" "info timing \. \.";[\s\S]*?justify-content:space-between;[\s\S]*?\.card-actions-row,\s*#reminders \.cards#all-reminders \.card-actions-buttons\{[^}]*display:contents;/, "Compact reminder rows should start at 650px and distribute each item independently");
assert.match(optionsCss, /#reminders \.cards#all-reminders \.card-title-row h2\{[^}]*text-overflow:ellipsis;[^}]*white-space:nowrap;/, "Reminder titles should stay on one line in compact layouts");
assert.match(optionsCss, /#reminders \.cards#all-reminders \.card-schedule-text\{[^}]*text-overflow:ellipsis;[^}]*white-space:nowrap;/, "Reminder schedules should stay on one line in compact layouts");
assert.match(optionsCss, /#reminders \.cards#all-reminders \.timing-label,\s*#reminders \.cards#all-reminders \.timing-val\{[^}]*white-space:nowrap;/, "Countdown labels and values should not wrap in compact layouts");
assert.match(optionsCss, /@media\(max-width:400px\)\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) max-content;[\s\S]*?grid-template-areas:"header timing" "info timing" "edit edit";[\s\S]*?\.card-actions-buttons\{[^}]*justify-content:space-between;[^}]*width:100%/, "Below 400px, only the controls should move into a full-width bottom row");
assert.match(optionsCss, /@media\(max-width:300px\)\{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\);[\s\S]*?grid-template-areas:"header header" "info timing" "switch open";[\s\S]*?border-bottom:1px solid color-mix\(in srgb,var\(--border\) 65%,transparent\);[\s\S]*?\.card-main-info,\s*#reminders \.cards#all-reminders \.timing-strip\{[^}]*min-height:0;[^}]*padding:9px 0 11px;[^}]*background:transparent;[\s\S]*?\.card-main-info\{[^}]*border-right:1px solid var\(--border\);[\s\S]*?align-items:center;[\s\S]*?\.timing-cell\{[^}]*align-items:center;[\s\S]*?\.timing-strip\{[^}]*display:flex;[^}]*justify-content:center;[\s\S]*?\.card-actions-row,\s*#reminders \.cards#all-reminders \.card-actions-buttons\{[^}]*display:contents;/, "At 300px and below, reminder details should form one clean, unboxed two-column layout");
assert.match(optionsScript, /scheduleLabel\.className = "card-schedule-label";[\s\S]*?scheduleLabel\.textContent = "Urnik";[\s\S]*?mainInfo\.append\(scheduleLabel, schedText\)/, "Compact schedule tiles should have an explicit schedule label");
assert.match(optionsCss, /#reminders \.filter-pills\{[^}]*display:grid;[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/, "Quick reminder filters should use one compact three-way segmented control");
assert.match(optionsHtml, /id="stat-disabled" data-filter="disabled" type="button" aria-pressed="false" aria-label="Izklopljeni opomniki"><span class="filter-label-full">Izklopljeni<\/span><span class="filter-label-short" aria-hidden="true">Izkl\.<\/span>/, "The narrow-screen filter label should be shortened visually while retaining an accessible full label");
assert.match(optionsCss, /#reminders \.cards#all-reminders \.toggle-switch\{[^}]*width:96px;[^}]*height:36px/, "Reminder switches should keep a consistent labeled size at every breakpoint");
assert.match(optionsCss, /#reminders \.cards#all-reminders \.btn-action\.edit\{[^}]*min-width:56px;[^}]*border:1px solid var\(--border\)/, "The edit action should have a clear, stable button treatment");
assert.doesNotMatch(reminderStyles, /@media\(max-width:480px\)/, "Reminder rows should not have a separate intermediate layout");
assert.match(optionsScript, /btnEdit\.addEventListener\("click", \(\) => startEdit\(r\)\)/, "The edit action should navigate to the dedicated reminder editor");
assert.doesNotMatch(optionsScript, /className = "card-more"/, "Reminder cards should not expand inline details");
assert.match(optionsHtml, /<div id="editor-more-actions" class="editor-more-actions hidden" role="group" aria-label="Dodatna dejanja za opomnik">[\s\S]*?id="editor-duplicate"[\s\S]*?id="editor-delete"/, "Duplicate and delete actions should be visible at the end of the editor when editing a reminder");
assert.doesNotMatch(optionsHtml, /<details id="editor-more-actions"/, "Editing actions should not be hidden inside a disclosure");
assert.match(optionsHtml, /<div class="reminders-table" role="table" aria-label="Opomniki">[\s\S]*?<span role="columnheader">Naslednji opomnik<\/span>/, "The desktop reminder list should have accessible column headings");
assert.match(optionsHtml, /src="\.\.\/icons\/icon-96\.svg\?v=20261029-2"/, "Settings navigation should use the cache-busted scalable SVG brand icon");
assert.match(optionsCss, /font-family:"Google Sans",system-ui,-apple-system,"Segoe UI",sans-serif/, "Settings should use the bundled Google Sans with local fallbacks");
assert.match(optionsHtml, /<option value="system">Google Sans \(priporočeno\)<\/option>/, "The recommended typography setting should identify Google Sans");
assert.match(fs.readFileSync(path.join(root, "extension/exercises/blocked.html"), "utf8"), /font-family:\s*inherit/, "The blocked-page domain should inherit the bundled application font");
assert.doesNotMatch(fs.readFileSync(path.join(root, "extension/exercises/blocked.html"), "utf8"), /font-family:\s*ui-monospace/, "The blocked page should not switch to a system monospace typeface");
assert.match(optionsHtml, /id="action-urls"[^>]*style="font-family:inherit;/, "The URL editor should inherit the application font");
assert.doesNotMatch(optionsHtml, /class="workspace-choices"/, "The reminders page should not repeat navigation already available in the sidebar");
assert.match(optionsScript, /document\.querySelectorAll\("#filter-pills \[data-filter\]"\)\.forEach\(button => \{\s*button\.addEventListener\("click"/, "Quick reminder filters should update the existing filter control");
assert.match(optionsScript, /\$\("stat-all-count"\)\.textContent = totalCount/, "Quick filter counts should update with reminder state");
assert.match(optionsScript, /toggleAttribute\("inert", mobileSettingsMedia\.matches && !settingsSidebar\.classList\.contains\("open"\)\)/, "A closed mobile sidebar should not be reachable by keyboard");
assert.match(optionsScript, /function syncMobileMenuToggle\(isOpen\)[\s\S]*?aria-expanded", String\(isOpen\)[\s\S]*?aria-label", isOpen \? "Zapri meni" : "Odpri meni"/, "The menu toggle accessible name should reflect whether the sidebar is open");
assert.match(optionsScript, /function handleSettingsBreakpointChange\(\)[\s\S]*?classList\.remove\("menu-transition-ready"\)[\s\S]*?closeMobileMenu\(\)[\s\S]*?mobileSettingsMedia\.addEventListener\("change", handleSettingsBreakpointChange\)/, "Resizing should close the mobile sidebar without playing its open/close transition");
assert.equal([...optionsHtml.matchAll(/name="trigger-type-choice" type="radio"/g)].length, 4, "Trigger types should use native, keyboard-operable radio buttons");
assert.match(optionsHtml, /<fieldset class="vertical-trigger-list">\s*<legend>Način proženja opomnika<\/legend>/, "Trigger-type radio options should have a fieldset label");
assert.match(optionsScript, /radio\.addEventListener\("change"[\s\S]*?toggleType\(\)/, "Keyboard radio selection should update the trigger form");
assert.match(optionsHtml, /id="reminder-image"[^>]*tabindex="-1" aria-hidden="true"/, "The image picker input should not create a second hidden tab stop");
assert.match(optionsScript, /if \(event\.target !== reminderFileInput\) reminderFileInput\.click\(\)/, "Activating the image drop zone should not recursively reopen its file picker");
assert.match(optionsScript, /clearButton\.textContent = "Počisti iskanje in filtre"/, "Empty filtered results should offer a clear-filter action");
assert.match(optionsScript, /createButton\.textContent = "Ustvari prvi opomnik"/, "An empty reminder list should offer a direct create action");
assert.doesNotMatch(optionsScript, /\bsend\s*\(\s*["'](?:GET_STATE|SAVE_SETTINGS)["']/, "Focus settings must use the defined runtime messaging APIs");
assert.match(optionsScript, /^const \$ = id => document\.getElementById\(id\);[\s\S]*?function updateReminderSoundSummary\(\)/, "Reminder sound summary helper must be available outside the standalone state fallback");
assert.match(optionsHtml, /href="#focus\/new"[^>]*>\+ Dodaj omejitev</, "Sidebar should provide a direct path to add a website restriction");
assert.match(optionsHtml, /href="#reminder\/new" class="side-link side-link-action"/, "Adding reminders should use the shared sidebar action style");
assert.match(optionsHtml, /href="#focus\/new" class="side-link side-link-action"/, "Adding restrictions should use the shared sidebar action style");
assert.doesNotMatch(optionsHtml, /side-link-sub/, "Sidebar add actions should not use a nested or indented style");
assert.match(optionsScript, /hash === "focus\/new"[\s\S]*?sectionId = "focus"/, "Adding a restriction should open the focus settings section");
assert.match(optionsScript, /if \(hash === "focus\/new"\)\s*\{\s*requestAnimationFrame\(\(\) => \$\("block-host"\)\?\.focus\(\)\)/, "Adding a restriction should focus the domain field after the section is displayed");
assert.match(optionsScript, /\["eye", "stretch", "water-glass"\]/, "Reminder editor should show the three recommended icons first");
assert.match(optionsHtml, /class="action-details"[\s\S]*?id="action-details-summary"/, "Optional reminder actions should remain collapsed behind a summary");
assert.match(optionsHtml, /Če je zvok v nastavitvah obvestil izklopljen/, "Reminder-specific sound should clarify the global mute setting");
const onboardingScript = fs.readFileSync(path.join(root, "extension/onboarding/onboarding.js"), "utf8");
assert.equal([...onboardingHtml.matchAll(/class="slide(?:\s|")/g)].length, 5, "Onboarding should have five slides, including the starting-path choice");
assert.match(onboardingHtml, /data-start-path="reminders"/);
assert.match(onboardingHtml, /data-start-path="focus"/);
assert.match(onboardingScript, /options\/options\.html\$\{route\}/, "Onboarding must route to the selected settings section");
assert.match(onboardingHtml, /id="step-counter" role="status" aria-live="polite"/, "Onboarding should announce slide changes");
assert.doesNotMatch(onboardingScript, /event\.key === "Escape"\) finish\(\)/, "Escape should not silently skip onboarding");
assert.match(fs.readFileSync(path.join(root, "extension/onboarding/onboarding.css"), "utf8"), /prefers-reduced-motion/);
assert.match(fs.readFileSync(path.join(root, "extension/options/options.css"), "utf8"), /prefers-reduced-motion/);

console.log(`Asset tests passed: ${icons.length} icons, ${sounds.length} sounds.`);
