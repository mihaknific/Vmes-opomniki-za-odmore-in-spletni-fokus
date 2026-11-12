import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = fs.readFileSync(path.join(root, "extension/lib/core.js"), "utf8");
const context = { crypto: globalThis.crypto, URL, Date, Math, Object, Set, String, Number, Array, JSON, RegExp };
vm.createContext(context);
vm.runInContext(source, context);
const core = context.WebNudgeCore;
assert.equal(core.VERSION, "0.9.3");
assert.equal(core.normalizeHost("https://www.Example.com/path"), "example.com");
assert.equal(JSON.stringify(core.originPatternsForHost("example.com")), JSON.stringify(["*://example.com/*", "*://*.example.com/*"]));
assert.equal(core.validateDomain("example.com"), true);
assert.equal(core.validateDomain("bad..example.com"), false);
assert.equal(core.parseTime("23:59"), 1439);
assert.equal(core.parseTime("99:99"), 1439);
assert.equal(core.isQuietHours({ quietHours: true, quietFrom: "22:00", quietTo: "06:00" }, new Date("2026-09-01T23:00:00")), true);
assert.equal(core.isQuietHours({ quietHours: true, quietFrom: "22:00", quietTo: "06:00" }, new Date("2026-09-01T12:00:00")), false);
const future = Date.now() + 30_000;
const once = core.normalizeReminder({ type: "once", name: "A", message: "B", when: new Date(future).toISOString() });
assert.equal(once.type, "once");
assert.equal(core.normalizeReminder({ name: "Legacy", message: "Stay as written" }).messageMode, "custom", "Existing reminders should retain their fixed custom message");
assert.equal(core.normalizeReminder({ name: "Rotating", messageMode: "rotate", messageCursor: 2 }).messageCursor, 2);
assert.equal(core.normalizeReminder({ name: "Rotating", messageMode: "rotate", messageCursor: -3 }).messageCursor, 0);
assert.equal(core.getReminderMessagePool({ actionType: "eyes" }).length, 4);
assert.match(core.getReminderMessagePool({ icon: "water-glass" })[0], /vode/);
assert.match(core.getReminderMessagePool({ actionType: "stretches" })[0], /raztegnite/);
assert.match(core.getReminderMessagePool({ actionType: "breathing" })[0], /vdihnite/);
assert.equal(core.getReminderMessagePool({ icon: "bell" }).length, 4);
assert.equal(core.normalizeReminder({ name: "Pogled stran od zaslona" }).icon, "eye");
assert.equal(core.normalizeReminder({ name: "Čas za vodo" }).icon, "water-glass");
assert.equal(core.normalizeReminder({ name: "Odmor za dihanje" }).icon, "wind");
assert.equal(core.normalizeReminder({ name: "Razteg" }).icon, "dumbbell");
assert.equal(core.normalizeReminder({ name: "Moj opomnik", icon: "calendar" }).icon, "calendar");
assert.equal(core.normalizeReminder({ name: "Povezan opomnik" }).actionOpenTiming, "click");
assert.equal(core.normalizeReminder({ name: "Povezan opomnik", actionOpenTiming: "immediate" }).actionOpenTiming, "immediate");
assert.equal(core.normalizeReminder({ name: "Povezan opomnik", actionOpenTiming: "invalid" }).actionOpenTiming, "click");
assert.equal(core.normalizeSettings({ soundName: "bell" }).soundName, "soft-click");
assert.equal(core.normalizeSettings({ soundName: "chime" }).soundName, "soft-click");
assert.equal(core.normalizeSettings({ soundName: "water-drop" }).soundName, "soft-click");
assert.equal(core.normalizeSettings().theme, "forest");
assert.equal(core.normalizeSettings().soundName, "soft-click");
assert.equal(core.normalizeSettings({ theme: "forest", fontFamily: "serif", fontSize: "larger" }).theme, "forest");
assert.equal(core.normalizeSettings({ theme: "forest", fontFamily: "serif", fontSize: "larger" }).fontFamily, "serif");
assert.equal(core.normalizeSettings({ theme: "invalid", fontFamily: "invalid", fontSize: "invalid" }).theme, "forest");
assert.equal(core.normalizeSettings({ theme: "color" }).theme, "mono");
assert.equal(core.normalizeSettings({ theme: "light" }).theme, "mono");
assert.equal(core.normalizeSettings({ theme: "indigo" }).theme, "indigo");
assert.equal(core.normalizeSettings({ theme: "indigo", appearanceSchemaVersion: 1 }).theme, "indigo", "Explicit Indigo preference should be preserved");
const customAppearance = core.normalizeSettings({
  theme: "custom",
  customThemeBase: "ocean",
  customColors: { background: "#abc", surface: "#123456", accent: "invalid", text: "#ABCDEF" }
});
assert.equal(customAppearance.theme, "custom");
assert.equal(customAppearance.customThemeBase, "ocean");
assert.equal(JSON.stringify(customAppearance.customColors), JSON.stringify({
  background: "#aabbcc",
  surface: "#123456",
  accent: "#267c68",
  text: "#abcdef",
  muted: "#63736b",
  border: "#dce7dc"
}));
assert.equal(core.normalizeSettings().appearanceSchemaVersion, 1);
assert.equal(core.normalizeReminder({ name: "Voda", soundName: "water-drop" }).soundName, "soft-click");
const interval = core.normalizeReminder({ type: "interval", name: "A", intervalMinutes: 20, createdAt: Date.now() });
assert.ok(core.nextDueDate(interval) > Date.now());
const phaseAnchor = Date.parse("2026-09-01T12:00:00Z");
const defaultIntervals = [
  core.normalizeReminder({ type: "interval", name: "Oči", intervalMinutes: 10, createdAt: phaseAnchor, lastTriggeredAt: phaseAnchor }),
  core.normalizeReminder({ type: "interval", name: "Razteg", intervalMinutes: 20, createdAt: phaseAnchor, lastTriggeredAt: phaseAnchor }),
  core.normalizeReminder({ type: "interval", name: "Voda", intervalMinutes: 5, createdAt: phaseAnchor, lastTriggeredAt: phaseAnchor })
];
assert.deepEqual(
  defaultIntervals.map(reminder => core.nextDueDate(reminder, phaseAnchor) - phaseAnchor),
  [10, 20, 5].map(minutes => minutes * 60000),
  "Default reminders should first trigger after exactly their displayed interval"
);
assert.equal(core.formatRemainingDuration(1), "1 s");
assert.equal(core.formatRemainingDuration(59000), "59 s");
assert.equal(core.formatRemainingDuration(60000), "1 min");
assert.equal(core.formatRemainingDuration(65000), "1 min 5 s");
assert.equal(core.formatRemainingDuration(3600000), "1 h");
assert.equal(core.formatRemainingDuration(3661000), "1 h 1 min 1 s");
assert.equal(core.formatRemainingDuration(86400000), "1 d");
const daily = core.nextOccurrenceForSchedule({ scheduleKind: "daily", time: "17:00" }, new Date("2026-09-01T16:00:00"));
assert.equal(daily.getHours(), 17);
assert.equal(core.formatDuration(3661), "1 h 1 min");

// Test pruneSiteUsage
const usageData = {
  "2026-08-01": { "example.com": 120 },
  "2026-08-02": { "example.com": 300 },
  "2026-08-03": { "example.com": 400 },
  "2026-08-04": { "example.com": 500 },
  "invalid-date": { "example.com": 100 }
};
const pruned = core.pruneSiteUsage(usageData, 2);
assert.deepEqual(Object.keys(pruned).sort(), ["2026-08-03", "2026-08-04"]);
assert.equal(JSON.stringify(core.pruneSiteUsage(null)), "{}");

// Test schedule nextDueDate safety
const now = new Date("2026-09-01T17:00:00").getTime();
const schedReminder = {
  id: crypto.randomUUID(),
  name: "Daily",
  type: "schedule",
  scheduleKind: "daily",
  time: "17:00",
  enabled: true,
  lastTriggeredAt: now
};
const nextSchedule = core.nextDueDate(schedReminder, now);
assert.ok(nextSchedule > now);
const nextSchedDate = new Date(nextSchedule);
assert.equal(nextSchedDate.getDate(), 2);
assert.equal(nextSchedDate.getHours(), 17);

// Test getChannelsForMode
assert.deepEqual([...core.getChannelsForMode("system")], ["system"]);
assert.deepEqual([...core.getChannelsForMode("window")], ["window"]);
assert.deepEqual([...core.getChannelsForMode("inpage")], ["inpage"]);
assert.deepEqual([...core.getChannelsForMode("both")], ["system", "inpage"]);
assert.deepEqual([...core.getChannelsForMode("all")], ["system", "window", "inpage"]);
assert.deepEqual([...core.getChannelsForMode("system+window")], ["system", "window"]);
assert.deepEqual([...core.getChannelsForMode("window+inpage")], ["window", "inpage"]);
assert.deepEqual([...core.getChannelsForMode(["window", "system"])], ["system", "window"]);
assert.deepEqual([...core.getChannelsForMode("unknown-invalid")], ["system"]);
assert.deepEqual([...core.getChannelsForMode("")], ["system"]);

// Test getRequiredOrigins
const systemReminder = { type: "interval", notificationMode: "system" };
assert.deepEqual([...core.getRequiredOrigins(systemReminder)], []);
const windowReminder = { type: "interval", notificationMode: "system+window" };
assert.deepEqual([...core.getRequiredOrigins(windowReminder)], []);
const inpageReminder = { type: "interval", notificationMode: "system+inpage" };
assert.deepEqual([...core.getRequiredOrigins(inpageReminder)], ["*://*/*"]);
const siteReminder = { type: "site", site: "youtube.com", notificationMode: "system" };
assert.deepEqual([...core.getRequiredOrigins(siteReminder)], ["*://youtube.com/*", "*://*.youtube.com/*"]);
const siteInpageReminder = { type: "site", site: "youtube.com", notificationMode: "inpage" };
assert.deepEqual([...core.getRequiredOrigins(siteInpageReminder)], ["*://youtube.com/*", "*://*.youtube.com/*"]);

console.log("Core unit tests passed.");
