import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const coreSource = fs.readFileSync(path.join(root, "extension/lib/core.js"), "utf8");
const iconsSource = fs.readFileSync(path.join(root, "extension/lib/icons.js"), "utf8");
const bgSource = fs.readFileSync(path.join(root, "extension/background.js"), "utf8");

const listeners = {
  installed: [],
  startup: [],
  alarm: [],
  message: [],
  notificationClicked: [],
  notificationClosed: [],
  windowRemoved: [],
  windowFocusChanged: [],
  tabActivated: [],
  tabUpdated: [],
  tabRemoved: [],
  permissionsRemoved: [],
  command: []
};

const storageData = {};
const alarmsData = {};
const notificationsData = {};
const windowsData = {};
const tabUpdates = [];
const createdTabs = [];
const removedTabs = [];

const mockBrowser = {
  runtime: {
    getURL: p => `moz-extension://mock/${p}`,
    openOptionsPage: async () => {},
    onInstalled: { addListener: fn => listeners.installed.push(fn) },
    onStartup: { addListener: fn => listeners.startup.push(fn) },
    onMessage: { addListener: fn => listeners.message.push(fn) }
  },
  storage: {
    local: {
      get: async defaults => {
        const res = {};
        if (Array.isArray(defaults)) {
          for (const key of defaults) {
            if (storageData[key] !== undefined) res[key] = storageData[key];
          }
        } else if (typeof defaults === "object") {
          for (const key of Object.keys(defaults)) {
            res[key] = storageData[key] !== undefined ? storageData[key] : defaults[key];
          }
        }
        return res;
      },
      set: async patch => {
        Object.assign(storageData, patch);
      }
    }
  },
  alarms: {
    create: async (name, info) => { alarmsData[name] = info; },
    clear: async name => { delete alarmsData[name]; },
    clearAll: async () => { for (const k of Object.keys(alarmsData)) delete alarmsData[k]; },
    getAll: async () => Object.entries(alarmsData).map(([name, info]) => ({ name, ...info })),
    onAlarm: { addListener: fn => listeners.alarm.push(fn) }
  },
  notifications: {
    create: async (id, opts) => { notificationsData[id] = opts; return id; },
    clear: async id => { delete notificationsData[id]; return true; },
    onClicked: { addListener: fn => listeners.notificationClicked.push(fn) },
    onClosed: { addListener: fn => listeners.notificationClosed.push(fn) }
  },
  windows: {
    WINDOW_ID_NONE: -1,
    create: async opts => {
      const id = Math.floor(Math.random() * 10000) + 1;
      windowsData[id] = opts;
      return { id };
    },
    remove: async id => { delete windowsData[id]; return true; },
    get: async id => ({ id }),
    getLastFocused: async () => ({ id: 1, tabs: [{ id: 10, active: true, url: "https://example.com" }] }),
    onFocusChanged: { addListener: fn => listeners.windowFocusChanged.push(fn) },
    onRemoved: { addListener: fn => listeners.windowRemoved.push(fn) }
  },
  tabs: {
    query: async () => [{ id: 10, active: true, url: "https://example.com" }],
    create: async tab => { createdTabs.push(tab); return { id: 11 }; },
    get: async id => ({ id }),
    remove: async tabId => { removedTabs.push(tabId); return true; },
    update: async (tabId, changes) => { tabUpdates.push({ tabId, changes }); return { id: tabId, ...changes }; },
    sendMessage: async (tabId, msg) => ({ ok: true }),
    onActivated: { addListener: fn => listeners.tabActivated.push(fn) },
    onUpdated: { addListener: fn => listeners.tabUpdated.push(fn) },
    onRemoved: { addListener: fn => listeners.tabRemoved.push(fn) }
  },
  permissions: {
    contains: async () => true,
    request: async () => true,
    onRemoved: { addListener: fn => listeners.permissionsRemoved.push(fn) }
  },
  commands: {
    onCommand: { addListener: fn => listeners.command.push(fn) }
  },
  scripting: {
    executeScript: async () => {}
  }
};

async function testAndroidWithoutWindowsApi() {
  const androidListeners = {
    installed: [], startup: [], alarm: [], message: [], notificationClicked: [],
    notificationClosed: [], tabActivated: [], tabUpdated: [], tabRemoved: [],
    permissionsRemoved: [], command: []
  };
  const androidStorage = {};
  const androidAlarms = {};
  const androidNotifications = {};
  const androidCreatedTabs = [];
  const androidRemovedTabs = [];
  let nextTabId = 100;
  const event = name => ({ addListener: listener => androidListeners[name].push(listener) });
  const androidBrowser = {
    runtime: {
      getURL: value => `moz-extension://android/${value}`,
      openOptionsPage: async () => {},
      onInstalled: event("installed"),
      onStartup: event("startup"),
      onMessage: event("message")
    },
    storage: {
      local: {
        get: async defaults => {
          const result = {};
          if (Array.isArray(defaults)) {
            for (const key of defaults) if (androidStorage[key] !== undefined) result[key] = androidStorage[key];
          } else {
            for (const [key, value] of Object.entries(defaults)) result[key] = androidStorage[key] ?? value;
          }
          return result;
        },
        set: async patch => Object.assign(androidStorage, patch)
      }
    },
    alarms: {
      create: async (name, info) => { androidAlarms[name] = info; },
      clear: async name => { delete androidAlarms[name]; },
      clearAll: async () => { for (const key of Object.keys(androidAlarms)) delete androidAlarms[key]; },
      getAll: async () => Object.entries(androidAlarms).map(([name, info]) => ({ name, ...info })),
      onAlarm: event("alarm")
    },
    notifications: {
      create: async (id, options) => { androidNotifications[id] = options; return id; },
      clear: async id => { delete androidNotifications[id]; return true; },
      onClicked: event("notificationClicked"),
      onClosed: event("notificationClosed")
    },
    tabs: {
      query: async () => [{ id: 10, active: true, url: "https://example.com/" }],
      create: async options => {
        const tab = { id: nextTabId++, ...options };
        androidCreatedTabs.push(tab);
        return tab;
      },
      get: async id => ({ id }),
      remove: async id => { androidRemovedTabs.push(id); return true; },
      update: async (id, changes) => ({ id, ...changes }),
      sendMessage: async () => ({ ok: true }),
      onActivated: event("tabActivated"),
      onUpdated: event("tabUpdated"),
      onRemoved: event("tabRemoved")
    },
    permissions: {
      contains: async () => true,
      request: async () => true,
      onRemoved: event("permissionsRemoved")
    },
    commands: { onCommand: event("command") },
    scripting: { executeScript: async () => {} }
  };
  const androidContext = {
    console, setTimeout, clearTimeout, URL, URLSearchParams, Date, Math, Object,
    Set, String, Number, Array, JSON, RegExp, crypto: globalThis.crypto,
    browser: androidBrowser
  };
  vm.createContext(androidContext);
  vm.runInContext(coreSource, androidContext);
  vm.runInContext(iconsSource, androidContext);
  vm.runInContext(bgSource, androidContext);

  assert.equal(androidListeners.message.length, 1, "The background must register message handlers without browser.windows");
  assert.equal(androidListeners.tabActivated.length, 1, "Tab-based tracking must remain available on Android");
  for (const listener of androidListeners.installed) await listener({ reason: "install" });
  assert.ok(androidCreatedTabs[0].url.endsWith("onboarding/onboarding.html"), "The first-run onboarding should open on Android");
  assert.equal((await androidListeners.message[0]({ type: "SET_ONBOARDING_COMPLETE" })).ok, true);

  await androidListeners.message[0]({ type: "TRIGGER_TEST", mode: "system" });
  const systemNotificationId = Object.keys(androidNotifications).find(id => androidNotifications[id].title === "Preizkusno obvestilo");
  assert.ok(systemNotificationId, "System notifications should be available on Android");
  for (const listener of androidListeners.notificationClicked) await listener(systemNotificationId);
  assert.ok(androidCreatedTabs.some(tab => tab.url.includes("notification/notification.html?test=1")),
    "Clicking a system notification should open its page in a tab on Android");

  const windowReminder = await androidListeners.message[0]({
    type: "SAVE_REMINDER",
    reminder: { name: "Android window reminder", type: "interval", intervalMinutes: 5, notificationMode: "window", enabled: true }
  });
  assert.equal(windowReminder.ok, true);
  await androidListeners.message[0]({ type: "TRIGGER_REMINDER_NOW", id: windowReminder.reminder.id });
  const notificationTab = androidCreatedTabs.find(tab => tab.url.includes(`reminder=${windowReminder.reminder.id}`));
  assert.ok(notificationTab, "Window-mode reminders should open in a tab when browser.windows is unavailable");
  await androidListeners.message[0]({ type: "REMINDER_ACTION", reminderId: windowReminder.reminder.id, action: "completed" });
  assert.ok(androidRemovedTabs.includes(notificationTab.id), "Completing a tab-based reminder should close its tab");

  const systemReminder = await androidListeners.message[0]({
    type: "SAVE_REMINDER",
    reminder: { name: "Android system reminder", type: "interval", intervalMinutes: 5, notificationMode: "system", enabled: true }
  });
  assert.equal(systemReminder.ok, true);
  await androidListeners.message[0]({ type: "TRIGGER_REMINDER_NOW", id: systemReminder.reminder.id });
  const systemReminderId = Object.keys(androidNotifications).find(id => androidNotifications[id].title === "Android system reminder");
  for (const listener of androidListeners.notificationClicked) await listener(systemReminderId);
  const clickedNotificationTab = androidCreatedTabs.find(tab => tab.url.includes(`reminder=${systemReminder.reminder.id}`));
  assert.ok(clickedNotificationTab, "Clicking a system reminder should open its page in an Android tab");
  await androidListeners.message[0]({ type: "REMINDER_ACTION", reminderId: systemReminder.reminder.id, action: "snoozed", minutes: 5 });
  assert.ok(androidRemovedTabs.includes(clickedNotificationTab.id), "Snoozing a tab-based reminder should close its tab");

  const siteReminder = await androidListeners.message[0]({
    type: "SAVE_REMINDER",
    reminder: { name: "Android site reminder", type: "site", site: "example.com", afterMinutes: 10, enabled: true }
  });
  assert.equal(siteReminder.ok, true);
  const androidState = await androidListeners.message[0]({ type: "GET_STATE" });
  assert.equal(androidState.activeSiteSession?.host, "example.com", "Site tracking should find the active tab without browser.windows");
}

const context = {
  console,
  setTimeout,
  clearTimeout,
  URL,
  URLSearchParams,
  Date,
  Math,
  Object,
  Set,
  String,
  Number,
  Array,
  JSON,
  RegExp,
  crypto: globalThis.crypto,
  browser: mockBrowser
};

vm.createContext(context);
vm.runInContext(coreSource, context);
vm.runInContext(iconsSource, context);
vm.runInContext(bgSource, context);

async function runTests() {
  const send = async (msg, sender) => {
    for (const fn of listeners.message) {
      const res = await fn(msg, sender);
      if (res !== undefined) return res;
    }
  };

  // 1. Install lifecycle test
  for (const fn of listeners.installed) await fn({ reason: "install" });
  let state = await send({ type: "GET_STATE" });
  assert.equal(state.currentVersion, "0.9.3");
  assert.equal(state.reminders.length, 4);
  assert.equal(JSON.stringify(state.reminders.map(reminder => reminder.intervalMinutes)), JSON.stringify([5, 10, 20, 45]));
  assert.equal(new Set(state.reminders.map(reminder => reminder.intervalMinutes)).size, 4, "Default reminders should have distinct intervals");
  assert.equal(JSON.stringify(state.reminders.map(reminder => reminder.name)), JSON.stringify(["Kozarec vode", "Odmor za oči", "Kratek razteg", "Dihalni premor"]));
  assert.ok(state.reminders.every(reminder => reminder.enabled && reminder.message.length > 0), "Default reminders should be active and have descriptions");
  assert.equal(state.reminders[0].icon, "water-glass");
  assert.equal(state.reminders[1].icon, "eye");
  assert.equal(state.reminders[2].icon, "stretch");
  assert.equal(state.reminders[3].icon, "wind");
  assert.ok(state.reminders.every(reminder => reminder.messageMode === "rotate"), "Fresh-install starter reminders should rotate contextual messages");
  assert.equal(state.reminders.every(reminder => !("intervalPhaseMinutes" in reminder)), true);
  assert.equal(JSON.stringify(state.reminders.map(reminder => reminder.actionType)), JSON.stringify(["none", "url", "url", "url"]));
  assert.equal(JSON.stringify(state.reminders.map(reminder => reminder.soundName)), JSON.stringify(["soft-click", "gentle-bell", "gentle-switch", "soft-click"]));
  assert.equal(JSON.stringify(state.reminders.map(reminder => reminder.actionOpenTiming)), JSON.stringify(["click", "click", "click", "click"]));
  assert.equal(state.reminders[0].actionUrl, "");
  assert.equal(state.reminders[1].actionUrl, "https://mihaknific.github.io/Vmes-opomniki-za-odmore-in-spletni-fokus/oci/");
  assert.equal(state.reminders[2].actionUrl, "https://mihaknific.github.io/Vmes-opomniki-za-odmore-in-spletni-fokus/gibanje/");
  assert.equal(state.reminders[3].actionUrl, "https://mihaknific.github.io/Vmes-opomniki-za-odmore-in-spletni-fokus/dihanje/");
  assert.equal(state.settings.soundName, "soft-click");

  const legacyDefaults = state.reminders.map(reminder => {
    const copy = { ...reminder };
    delete copy.intervalPhaseMinutes;
    copy.intervalMinutes = ({
      "Kozarec vode": 60,
      "Odmor za oči": 20,
      "Kratek razteg": 45,
      "Dihalni premor": 45
    })[copy.name];
    copy.actionType = ({
      "Kozarec vode": "none",
      "Odmor za oči": "eyes",
      "Kratek razteg": "stretches",
      "Dihalni premor": "breathing"
    })[copy.name];
    delete copy.actionUrl;
    delete copy.actionUrls;
    delete copy.actionOpenTiming;
    return copy;
  });
  legacyDefaults.push({
    ...legacyDefaults[1],
    id: "00000000-0000-4000-8000-000000000033",
    name: "Moj prilagojeni opomnik",
    intervalMinutes: 33
  });
  storageData.reminders = legacyDefaults;
  storageData.starterReminderDefaultsVersion = 0;
  for (const fn of listeners.installed) await fn({ reason: "update" });
  state = await send({ type: "GET_STATE" });
  assert.equal(JSON.stringify(state.reminders.map(reminder => reminder.intervalMinutes)), JSON.stringify([5, 10, 20, 45, 33]));
  assert.equal(state.reminders.some(reminder => reminder.name === "Moj prilagojeni opomnik" && reminder.intervalMinutes === 33), true, "Starter migration should preserve customized reminders");
  assert.equal(state.reminders.every(reminder => !("intervalPhaseMinutes" in reminder)), true);
  assert.equal(storageData.starterReminderDefaultsVersion, 3, "Starter reminder migration should run once on update");
  assert.equal(state.reminders.find(reminder => reminder.name === "Odmor za oči").actionUrl, "https://mihaknific.github.io/Vmes-opomniki-za-odmore-in-spletni-fokus/oci/");
  assert.equal(state.reminders.find(reminder => reminder.name === "Dihalni premor").actionType, "url", "Migration should add the breathing starter with its linked guide");

  storageData.reminders = state.reminders.filter(reminder => ["Kozarec vode", "Odmor za oči"].includes(reminder.name));
  storageData.starterReminderDefaultsVersion = 2;
  for (const fn of listeners.installed) await fn({ reason: "update" });
  state = await send({ type: "GET_STATE" });
  assert.equal(JSON.stringify(state.reminders.map(reminder => reminder.name)), JSON.stringify(["Kozarec vode", "Odmor za oči", "Kratek razteg", "Dihalni premor"]));
  assert.equal(state.reminders.length, 4, "Upgrade should add missing starter reminders without duplicating existing ones");

  // 2. Startup lifecycle test
  for (const fn of listeners.startup) await fn();
  const appearance = await send({ type: "SAVE_SETTINGS", patch: { theme: "forest", fontFamily: "humanist", fontSize: "large" } });
  assert.equal(appearance.settings.theme, "forest");
  assert.equal(appearance.settings.fontFamily, "humanist");
  assert.equal(appearance.settings.fontSize, "large");

  // 3. Add interval reminder
  const resInterval = await send({
    type: "SAVE_REMINDER",
    reminder: {
      name: "Interval test",
      type: "interval",
      intervalMinutes: 15,
      enabled: true
    }
  });
  assert.equal(resInterval.ok, true);
  const intervalId = resInterval.reminder.id;

  const immediateReminder = await send({
    type: "SAVE_REMINDER",
    reminder: {
      name: "Immediate URL reminder",
      type: "interval",
      intervalMinutes: 30,
      enabled: true,
      actionType: "url",
      actionUrl: "https://example.org/guide",
      actionOpenTiming: "immediate"
    }
  });
  assert.equal(immediateReminder.ok, true);
  const tabCountBeforeImmediate = createdTabs.length;
  await listeners.alarm[0]({ name: `reminder:${immediateReminder.reminder.id}` });
  assert.equal(JSON.stringify(createdTabs.slice(tabCountBeforeImmediate)), JSON.stringify([{ url: "https://example.org/guide" }]));
  await send({ type: "REMINDER_ACTION", reminderId: immediateReminder.reminder.id, action: "completed" });
  assert.equal(createdTabs.length, tabCountBeforeImmediate + 1, "Immediate links should not open a second time when the reminder is completed");

  const clickReminder = await send({
    type: "SAVE_REMINDER",
    reminder: {
      name: "Click URL reminder",
      type: "interval",
      intervalMinutes: 30,
      enabled: true,
      actionType: "url",
      actionUrl: "https://example.org/click-guide"
    }
  });
  assert.equal(clickReminder.ok, true);
  const tabCountBeforeClick = createdTabs.length;
  await send({ type: "REMINDER_ACTION", reminderId: clickReminder.reminder.id, action: "completed" });
  assert.equal(JSON.stringify(createdTabs.slice(tabCountBeforeClick)), JSON.stringify([{ url: "https://example.org/click-guide" }]));

  // 4. Add once reminder in future
  const futureIso = new Date(Date.now() + 60000).toISOString();
  const resOnce = await send({
    type: "SAVE_REMINDER",
    reminder: {
      name: "Once test",
      type: "once",
      when: futureIso,
      enabled: true
    }
  });
  assert.equal(resOnce.ok, true);
  const onceId = resOnce.reminder.id;

  // 5. Add schedule reminder
  const resSched = await send({
    type: "SAVE_REMINDER",
    reminder: {
      name: "Daily test",
      type: "schedule",
      scheduleKind: "daily",
      time: "18:00",
      enabled: true
    }
  });
  assert.equal(resSched.ok, true);

  // 6. Add site reminder
  const resSite = await send({
    type: "SAVE_REMINDER",
    reminder: {
      name: "Site test",
      type: "site",
      site: "example.com",
      afterMinutes: 10,
      enabled: true
    }
  });
  assert.equal(resSite.ok, true);

  // 7. Trigger preview now
  const resTrigger = await send({ type: "TRIGGER_REMINDER_NOW", id: intervalId });
  assert.equal(resTrigger.ok, true);
  const nativeNotification = Object.values(notificationsData).find(notification => notification.title === "Interval test");
  assert.ok(nativeNotification, "A system notification should be created for the triggered reminder");
  assert.equal(nativeNotification.message, "Čas je za opomnik.");
  assert.match(decodeURIComponent(nativeNotification.iconUrl), /<svg[\s\S]*#267c68/, "The system notification should use the selected reminder icon");

  // 8. Snooze
  const resSnooze = await send({ type: "SNOOZE", id: intervalId, minutes: 10 });
  assert.equal(resSnooze.ok, true);

  // 9. Actions: completed, dismissed, and timeout (verifying timeout is preserved!)
  await send({ type: "REMINDER_ACTION", reminderId: intervalId, action: "completed" });
  await send({ type: "REMINDER_ACTION", reminderId: intervalId, action: "dismissed" });
  await send({ type: "REMINDER_ACTION", reminderId: intervalId, action: "timeout" });

  state = await send({ type: "GET_STATE" });
  const timeoutEntry = state.history.find(h => h.reminderId === intervalId && h.status === "timeout");
  assert.ok(timeoutEntry, "History must preserve timeout status and not change it to test");

  // 10. Test enabling expired once reminder (must fail with error message)
  const expiredOnce = await send({
    type: "SAVE_REMINDER",
    reminder: {
      name: "Expired once",
      type: "once",
      when: new Date(Date.now() - 60000).toISOString(),
      enabled: false
    }
  });
  assert.equal(expiredOnce.ok, true);
  const toggleRes = await send({
    type: "SET_REMINDER_ENABLED",
    id: expiredOnce.reminder.id,
    enabled: true
  });
  assert.equal(toggleRes.ok, false);
  assert.ok(toggleRes.error.includes("potekel"));

  // 11. Test deletion of reminder
  const deleteRes = await send({ type: "DELETE_REMINDER", id: intervalId });
  assert.equal(deleteRes.ok, true);
  state = await send({ type: "GET_STATE" });
  assert.equal(state.reminders.some(r => r.id === intervalId), false);

  // 12. Test export and import
  const exported = await send({ type: "EXPORT_DATA" });
  assert.equal(exported.ok, true);
  assert.equal(exported.data.format, "web-nudge-backup");
  assert.equal(exported.data.schemaVersion, 1);
  const imported = await send({ type: "IMPORT_DATA", data: exported.data });
  assert.equal(imported.ok, true);
  const invalidImport = await send({ type: "IMPORT_DATA", data: { ...exported.data, schemaVersion: 99 } });
  assert.equal(invalidImport.ok, false);
  assert.match(invalidImport.error, /ni podprta/);
  const remindersBeforeInvalidImport = (await send({ type: "GET_STATE" })).reminders;
  assert.equal(
    JSON.stringify((await send({ type: "GET_STATE" })).reminders.map(reminder => reminder.id)),
    JSON.stringify(remindersBeforeInvalidImport.map(reminder => reminder.id)),
    "An unsupported backup must not replace current reminders"
  );
  const duplicateBackup = {
    ...exported.data,
    reminders: [...exported.data.reminders, { ...exported.data.reminders[0] }]
  };
  const duplicateImport = await send({ type: "IMPORT_DATA", data: duplicateBackup });
  assert.equal(duplicateImport.ok, false);
  assert.match(duplicateImport.error, /podvojene/);

  // 13. Test alarm listener
  for (const fn of listeners.alarm) {
    await fn({ name: `reminder:${onceId}` });
    await fn({ name: `snooze:${onceId}` });
    await fn({ name: `quiet:${onceId}` });
    await fn({ name: "web-nudge:site-tracking" });
    await fn({ name: "web-nudge:housekeeping" });
  }

  // 14. Test tab/window listeners
  for (const fn of listeners.tabActivated) await fn({ tabId: 10, windowId: 1 });
  for (const fn of listeners.tabUpdated) await fn(10, { status: "complete" }, { active: true, url: "https://example.com" });
  for (const fn of listeners.windowFocusChanged) await fn(1);
  for (const fn of listeners.windowRemoved) await fn(999);

  // 15. Test multi-channel saving and TRIGGER_TEST
  const multiReminder = await send({
    type: "SAVE_REMINDER",
    reminder: {
      name: "Multi-channel test",
      type: "interval",
      intervalMinutes: 30,
      notificationMode: "system+window",
      enabled: true
    }
  });
  assert.equal(multiReminder.ok, true);
  assert.equal(multiReminder.reminder.notificationMode, "system+window");

  const rotatingReminder = await send({
    type: "SAVE_REMINDER",
    reminder: {
      name: "Rotating water reminder",
      type: "interval",
      intervalMinutes: 30,
      message: "Čas za nekaj požirkov vode.",
      messageMode: "rotate",
      messageCursor: 0,
      icon: "water-glass",
      notificationMode: "system",
      enabled: true
    }
  });
  assert.equal(rotatingReminder.ok, true);
  const rotatingMessages = context.WebNudgeCore.getReminderMessagePool(rotatingReminder.reminder);
  await listeners.alarm[0]({ name: `reminder:${rotatingReminder.reminder.id}` });
  let stateAfterRotation = await send({ type: "GET_STATE" });
  assert.equal(stateAfterRotation.reminders.find(reminder => reminder.id === rotatingReminder.reminder.id).messageCursor, 1);
  const firstRotatingNotification = Object.values(notificationsData).filter(notification => notification.title === "Rotating water reminder").at(-1);
  assert.equal(firstRotatingNotification.message, rotatingMessages[0]);
  await listeners.alarm[0]({ name: `reminder:${rotatingReminder.reminder.id}` });
  const secondRotatingNotification = Object.values(notificationsData).filter(notification => notification.title === "Rotating water reminder").at(-1);
  assert.equal(secondRotatingNotification.message, rotatingMessages[1], "Automatic reminder messages should rotate on successive alerts");

  const fixedReminder = await send({
    type: "SAVE_REMINDER",
    reminder: {
      name: "Fixed custom reminder",
      type: "interval",
      intervalMinutes: 30,
      message: "Moje stalno besedilo.",
      messageMode: "custom",
      notificationMode: "system",
      enabled: true
    }
  });
  assert.equal(fixedReminder.ok, true);
  await listeners.alarm[0]({ name: `reminder:${fixedReminder.reminder.id}` });
  await listeners.alarm[0]({ name: `reminder:${fixedReminder.reminder.id}` });
  const fixedNotifications = Object.values(notificationsData).filter(notification => notification.title === "Fixed custom reminder");
  assert.deepEqual(fixedNotifications.map(notification => notification.message), ["Moje stalno besedilo.", "Moje stalno besedilo."]);

  const testTrigger = await send({ type: "TRIGGER_TEST", mode: "system+window" });
  assert.equal(testTrigger.ok, true);

  // Exercise pages can close only their own extension tab.
  const rejectedTabClose = await send(
    { type: "CLOSE_EXERCISE_TAB" },
    { url: "https://example.com/exercises/eyes.html", tab: { id: 12 } }
  );
  assert.equal(rejectedTabClose.ok, false, "Web pages must not be able to request tab closure");
  const exerciseTabClose = await send(
    { type: "CLOSE_EXERCISE_TAB" },
    { url: "moz-extension://mock/exercises/eyes.html", tab: { id: 42 } }
  );
  assert.equal(exerciseTabClose.ok, true);
  assert.deepEqual(removedTabs, [42], "The close action must remove only the requesting exercise tab");

  // 16. Test permissions requirement on enabled vs disabled reminders
  mockBrowser.permissions.contains = async () => false; // simulate no permissions
  const ungrantedSiteEnabled = await send({
    type: "SAVE_REMINDER",
    reminder: {
      name: "No perm site enabled",
      type: "site",
      site: "unauthorized.org",
      enabled: true
    }
  });
  assert.equal(ungrantedSiteEnabled.ok, false);
  assert.equal(ungrantedSiteEnabled.needsPermission, true);

  const ungrantedSiteDisabled = await send({
    type: "SAVE_REMINDER",
    reminder: {
      name: "No perm site disabled",
      type: "site",
      site: "unauthorized.org",
      enabled: false
    }
  });
  assert.equal(ungrantedSiteDisabled.ok, true);
  assert.equal(ungrantedSiteDisabled.reminder.enabled, false);
  mockBrowser.permissions.contains = async () => true; // restore

  // 17. Focus rules request permissions before import and activate time tracking
  const siteReminder = (await send({ type: "GET_STATE" })).reminders.find(reminder => reminder.type === "site");
  if (siteReminder) await send({ type: "DELETE_REMINDER", id: siteReminder.id });
  await send({ type: "DISABLE_SITE_TRACKING" });
  const focusSave = await send({
    type: "SAVE_SETTINGS",
    patch: { blockRules: [{ host: "example.com", mode: "limit", dailyLimitMinutes: 1, enabled: true }] }
  });
  assert.equal(focusSave.ok, true);
  assert.equal(focusSave.settings.siteTrackingEnabled, true);
  assert.equal(alarmsData["web-nudge:site-tracking"]?.periodInMinutes, 1);
  assert.equal((await send({ type: "GET_STATE" })).activeSiteSession?.host, "example.com");
  const deniedTrackingDisable = await send({ type: "DISABLE_SITE_TRACKING" });
  assert.equal(deniedTrackingDisable.ok, false, "Tracking cannot be disabled while a daily time limit is active");
  const deniedDirectTrackingDisable = await send({ type: "SAVE_SETTINGS", patch: { siteTrackingEnabled: false } });
  assert.equal(deniedDirectTrackingDisable.ok, false, "Saving settings cannot bypass the site-tracking guard");
  assert.equal((await send({ type: "GET_STATE" })).settings.siteTrackingEnabled, true);
  assert.equal(alarmsData["web-nudge:site-tracking"]?.periodInMinutes, 1);
  storageData.activeSiteSession = {
    tabId: 10, windowId: 1, host: "example.com", startedAt: Date.now() - 120_000,
    lastSeenAt: Date.now(), sessionId: "focus-limit-test", firedReminders: {}
  };
  await listeners.alarm[0]({ name: "web-nudge:site-tracking" });
  assert.ok(tabUpdates.some(update => String(update.changes.url).includes("reason=limit")),
    "A daily limit must include elapsed time in the currently active session");
  const blockedPageSender = { url: "moz-extension://mock/exercises/blocked.html?host=example.com", tab: { id: 20 } };
  const unauthorizedPause = await send(
    { type: "PAUSE_SITE_LIMIT", host: "example.com", minutes: 5 },
    { url: "https://example.com" }
  );
  assert.equal(unauthorizedPause.ok, false, "Web pages must not be able to bypass site focus rules");
  const allowedPause = await send(
    { type: "PAUSE_SITE_LIMIT", host: "example.com", minutes: 5 },
    blockedPageSender
  );
  assert.equal(allowedPause.ok, true, "The blocked page should grant its requested short extension");
  tabUpdates.length = 0;
  await listeners.alarm[0]({ name: "web-nudge:site-tracking" });
  assert.equal(tabUpdates.length, 0, "A temporary extension should prevent immediate re-blocking");
  storageData.siteLimitPauses["example.com"] = Date.now() - 1;
  await listeners.alarm[0]({ name: "web-nudge:site-tracking" });
  assert.ok(tabUpdates.some(update => String(update.changes.url).includes("reason=limit")),
    "The site limit should be enforced again after the extension expires");

  const focusBackup = await send({ type: "EXPORT_DATA" });
  const reminderCountBeforeDeniedImport = (await send({ type: "GET_STATE" })).reminders.length;
  mockBrowser.permissions.contains = async () => false;
  const pendingImport = await send({ type: "IMPORT_DATA", data: focusBackup.data });
  assert.equal(pendingImport.ok, true);
  assert.equal(pendingImport.needsPermission, true);
  assert.equal((await send({ type: "GET_STATE" })).reminders.length, reminderCountBeforeDeniedImport);
  mockBrowser.permissions.contains = async () => true;
  const completedImport = await send({ type: "IMPORT_DATA", data: focusBackup.data });
  assert.equal(completedImport.ok, true);
  assert.equal((await send({ type: "GET_STATE" })).settings.blockRules[0].host, "example.com");

  await testAndroidWithoutWindowsApi();
  console.log("Background integration tests passed successfully.");
}

runTests().catch(err => {
  console.error("Background test failed:", err);
  process.exit(1);
});
