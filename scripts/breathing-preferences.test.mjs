import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const context = { window: {} };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(root, "extension/exercises/breathing-preferences.js"), "utf8"),
  context
);

const codec = context.window.WebNudgeBreathingPreferences;
const preferences = {
  figureColor: "red",
  glow: true,
  appearance: "ocean",
  tempo: 1.2,
  technique: "custom",
  shape: "blob",
  visualStyle: "grow",
  motif: "monk-orange",
  backgroundMode: "combined",
  soundMode: "both",
  soundStyle: "air",
  soundVolume: 30,
  words: false,
  duration: "300000",
  phases: { inhale: 3.5, holdIn: 1, exhale: 5, holdOut: 0 }
};

const backup = codec.createBackup({ ...preferences, legacyField: "not exported" });
assert.deepEqual(JSON.parse(JSON.stringify(backup)), {
  format: "vmes-breathing-preferences",
  version: 1,
  preferences
}, "Export should contain only the versioned portable preference schema");
const imported = codec.parseBackup(JSON.parse(JSON.stringify(backup)));
assert.deepEqual(JSON.parse(JSON.stringify(imported)), preferences, "A valid exported backup should restore unchanged preferences");
assert.notEqual(imported.phases, backup.preferences.phases, "Imported phase values should not alias the backup object");
const legacyPreferences = { ...preferences };
delete legacyPreferences.glow;
const legacyBackup = { ...backup, preferences: legacyPreferences };
assert.equal(codec.parseBackup(legacyBackup).glow, true, "Existing preference backups should retain the default glow when imported");

const invalidBackups = [
  [{ ...backup, version: 2 }, /ni podprta/],
  [{ ...backup, extra: true }, /ni podprta/],
  [{ ...backup, preferences: { ...preferences, appearance: "script" } }, /appearance/],
  [{ ...backup, preferences: { ...preferences, figureColor: "not-a-color" } }, /figureColor/],
  [{ ...backup, preferences: { ...preferences, glow: "on" } }, /sija/],
  [{ ...backup, preferences: { ...preferences, tempo: 1.23 } }, /Hitrost/],
  [{ ...backup, preferences: { ...preferences, soundVolume: 31 } }, /Glasnost/],
  [{ ...backup, preferences: { ...preferences, words: "false" } }, /besedila/],
  [{ ...backup, preferences: { ...preferences, phases: { ...preferences.phases, holdIn: 1.25 } } }, /faz/],
  [{ ...backup, preferences: { ...preferences, phases: { ...preferences.phases, unexpected: 2 } } }, /faz/],
  [{ ...backup, preferences: { ...preferences, surprise: true } }, /strukture/]
];

for (const [invalidBackup, expectedError] of invalidBackups) {
  assert.throws(() => codec.parseBackup(invalidBackup), expectedError, "Invalid backups should be rejected before persistence");
}

for (const figureColor of ["yellow", "mint", "sky", "lavender", "fuchsia"]) {
  const colorBackup = { ...backup, preferences: { ...preferences, figureColor } };
  assert.equal(codec.parseBackup(colorBackup).figureColor, figureColor, `Portable preferences should preserve the ${figureColor} figure color`);
}

console.log("Breathing preference export/import tests passed.");
