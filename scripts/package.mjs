import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extension = path.join(root, "extension");
const dist = path.join(root, "dist");
const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
fs.mkdirSync(dist, { recursive: true });
for (const entry of fs.readdirSync(dist, { withFileTypes: true })) {
  if (entry.isFile() && (/^(?:vmes|web-nudge)-firefox-extension-v.*\.(zip|xpi)$/.test(entry.name) || /^(?:vmes|web-nudge)-firefox-extension\.xpi$/.test(entry.name))) {
    fs.rmSync(path.join(dist, entry.name));
  }
}
execFileSync("node", [path.join(root, "scripts", "validate.mjs")], { stdio: "inherit" });

const zip = path.join(dist, `vmes-firefox-extension-v${version}.zip`);
const xpi = path.join(dist, `vmes-firefox-extension-v${version}.xpi`);
const latestXpi = path.join(dist, "vmes-firefox-extension.xpi");

const entries = fs.readdirSync(extension);
let packaged = false;

// Prefer tar (bsdtar on Windows, standard tar on macOS/Linux) for clean forward-slash POSIX ZIP entries
try {
  execFileSync("tar", ["-a", "-c", "-f", zip, ...entries], { cwd: extension, stdio: "inherit" });
  packaged = true;
} catch {}

if (!packaged) {
  try {
    execFileSync("zip", ["-qr", zip, "."], { cwd: extension, stdio: "inherit" });
    packaged = true;
  } catch {}
}

if (!packaged && process.platform === "win32") {
  const archiveArg = zip.replace(/'/g, "''");
  const command = `Compress-Archive -Path (Get-ChildItem -Force | ForEach-Object { $_.FullName }) -DestinationPath '${archiveArg}' -Force`;
  execFileSync("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    command
  ], { cwd: extension, stdio: "inherit" });
  packaged = true;
}

if (!packaged) {
  throw new Error("Ne morem ustvariti paketa: manjka primerno orodje (tar, zip, powershell).");
}

fs.copyFileSync(zip, xpi);
fs.copyFileSync(xpi, latestXpi);
console.log(`Packages written to ${path.relative(root, dist)}/`);
