const {
  VERSION, DEFAULT_SETTINGS, VALID_MODES, normalizeHost, hostFromUrl, isHttpUrl, parseTime,
  localDateKey, minutesNow, isQuietHours, quietEnd, originPatternsForHost, validateDomain,
  nextDueDate, normalizeSettings, normalizeReminder, normalizeBlockRule, safeNumber, pruneSiteUsage,
  getChannelsForMode, getRequiredOrigins
} = WebNudgeCore;

const MAX_HISTORY = 1000;
const MAX_REMINDERS = 100;
const PUBLIC_SITE_URL = "https://mihaknific.github.io/Vmes-opomniki-za-odmore-in-spletni-fokus/";
const TRACKING_ALARM = "web-nudge:site-tracking";
const HOUSEKEEPING_ALARM = "web-nudge:housekeeping";
const MAX_SESSION_GAP_MS = 90_000;
let operationQueue = Promise.resolve();

function withLock(task) {
  const run = operationQueue.then(task, task);
  operationQueue = run.catch(() => undefined);
  return run;
}

function makeDefaultReminders() {
  const now = Date.now();
  return [
    { id: crypto.randomUUID(), name: "Kozarec vode", type: "interval", intervalMinutes: 5, enabled: true, message: "Vzemite nekaj požirkov vode, če vam ustreza.", messageMode: "rotate", messageCursor: 0, notificationMode: "system", snoozeEnabled: true, icon: "water-glass", actionType: "none", soundName: "soft-click", createdAt: now, updatedAt: now, lastTriggeredAt: now },
    { id: crypto.randomUUID(), name: "Odmor za oči", type: "interval", intervalMinutes: 10, enabled: true, message: "Poglejte za 20 sekund v daljavo in sprostite pogled.", messageMode: "rotate", messageCursor: 0, notificationMode: "system", snoozeEnabled: true, icon: "eye", actionType: "url", actionUrl: `${PUBLIC_SITE_URL}oci/`, actionUrls: [`${PUBLIC_SITE_URL}oci/`], actionOpenTiming: "click", soundName: "gentle-bell", createdAt: now, updatedAt: now, lastTriggeredAt: now },
    { id: crypto.randomUUID(), name: "Kratek razteg", type: "interval", intervalMinutes: 20, enabled: true, message: "Vstanite, nežno raztegnite telo in sprostite ramena.", messageMode: "rotate", messageCursor: 0, notificationMode: "system", snoozeEnabled: true, icon: "stretch", actionType: "url", actionUrl: `${PUBLIC_SITE_URL}gibanje/`, actionUrls: [`${PUBLIC_SITE_URL}gibanje/`], actionOpenTiming: "click", soundName: "gentle-switch", createdAt: now, updatedAt: now, lastTriggeredAt: now },
    { id: crypto.randomUUID(), name: "Dihalni premor", type: "interval", intervalMinutes: 45, enabled: true, message: "Ustavite se za trenutek in nekajkrat mirno vdihnite.", messageMode: "rotate", messageCursor: 0, notificationMode: "system", snoozeEnabled: true, icon: "wind", actionType: "url", actionUrl: `${PUBLIC_SITE_URL}dihanje/`, actionUrls: [`${PUBLIC_SITE_URL}dihanje/`], actionOpenTiming: "click", soundName: "soft-click", createdAt: now, updatedAt: now, lastTriggeredAt: now }
  ];
}

async function migrateStarterReminderIntervals() {
  const current = await browser.storage.local.get({ reminders: [], starterReminderDefaultsVersion: 0 });
  if (Number(current.starterReminderDefaultsVersion) >= 3) return;

  const migratedDefaults = [
    { name: "Kozarec vode", icon: "water-glass", actionType: "none", oldMinutes: 60, minutes: 5 },
    { name: "Odmor za oči", icon: "eye", actionType: "eyes", oldMinutes: 20, minutes: 10, url: `${PUBLIC_SITE_URL}oci/` },
    { name: "Kratek razteg", icon: "stretch", actionType: "stretches", oldMinutes: 45, minutes: 20, url: `${PUBLIC_SITE_URL}gibanje/` },
    { name: "Dihalni premor", icon: "wind", actionType: "breathing", oldMinutes: 45, minutes: 45, url: `${PUBLIC_SITE_URL}dihanje/` }
  ];
  const reminders = Array.isArray(current.reminders) ? current.reminders.map(reminder => {
    const starter = migratedDefaults.find(item =>
      reminder?.type === "interval"
      && reminder.name === item.name
      && reminder.icon === item.icon
      && reminder.actionType === item.actionType
    );
    if (!starter) return reminder;
    const now = Date.now();
    const migrated = { ...reminder };
    delete migrated.intervalPhaseMinutes;
    const hasStarterInterval = Number(reminder.intervalMinutes) === starter.oldMinutes
      || Number(reminder.intervalMinutes) === starter.minutes;
    return {
      ...migrated,
      ...(hasStarterInterval ? {
        intervalMinutes: starter.minutes,
        createdAt: now,
        lastTriggeredAt: now,
        updatedAt: now
      } : {}),
      ...(starter.url ? {
        actionType: "url",
        actionUrl: starter.url,
        actionUrls: [starter.url],
        actionUrlMode: "iterate",
        actionUrlLastIndex: -1,
        actionOpenTiming: "click"
      } : {})
    };
  }) : [];

  const starterReminders = makeDefaultReminders();
  for (const starter of starterReminders) {
    if (reminders.some(reminder => reminder?.name === starter.name)) continue;
    if (reminders.length >= MAX_REMINDERS) break;
    reminders.push(starter);
  }
  await saveState({ reminders, starterReminderDefaultsVersion: 3 });
}

const HISTORY_STATUSES = new Set(["shown", "completed", "snoozed", "dismissed", "timeout", "quiet-hours", "unavailable", "test", "paused"]);
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(0, MAX_HISTORY).map(item => {
    if (!item || typeof item !== "object") return null;
    const timestamp = safeNumber(item.timestamp, Date.now(), 0);
    const status = HISTORY_STATUSES.has(item.status) ? item.status : "test";
    return {
      id: typeof item.id === "string" ? item.id.slice(0, 100) : crypto.randomUUID(),
      timestamp,
      reminderId: typeof item.reminderId === "string" ? item.reminderId.slice(0, 100) : "",
      name: typeof item.name === "string" ? item.name.slice(0, 120) : "Vmes",
      status,
      channel: typeof item.channel === "string" ? item.channel.slice(0, 80) : undefined,
      snoozeMinutes: item.snoozeMinutes == null ? undefined : safeNumber(item.snoozeMinutes, 5, 1, 1440),
      isSnooze: Boolean(item.isSnooze),
      preview: Boolean(item.preview)
    };
  }).filter(Boolean);
}

function sanitizeUsage(siteUsage) {
  if (!siteUsage || typeof siteUsage !== "object") return {};
  const result = {};
  for (const [date, hosts] of Object.entries(siteUsage)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !hosts || typeof hosts !== "object") continue;
    result[date] = {};
    for (const [host, seconds] of Object.entries(hosts)) {
      if (typeof host !== "string") continue;
      const safe = Math.min(24 * 60 * 60, Math.max(0, Math.round(Number(seconds) || 0)));
      if (safe) result[date][host] = safe;
    }
  }
  return pruneSiteUsage(result);
}

function hasEnabledSiteFeature(settings) {
  return Boolean(settings.siteTrackingEnabled)
    || (settings.blockRules || []).some(rule => rule.enabled);
}

function siteTrackingDisableError(settings, reminders) {
  const hasEnabledSiteReminder = reminders.some(reminder => reminder.enabled && reminder.type === "site");
  const hasEnabledTimeLimit = (settings.blockRules || []).some(rule => rule.enabled && rule.mode === "limit");
  if (!hasEnabledSiteReminder && !hasEnabledTimeLimit) return null;
  return "Spremljanja ni mogoče izključiti, dokler so aktivni opomniki za spletne strani ali dnevne časovne omejitve. Najprej jih izključite ali odstranite.";
}

async function getState() {
  const state = await browser.storage.local.get({
    settings: DEFAULT_SETTINGS, reminders: null, history: [], notificationMap: {}, notificationWindows: {}, activeSiteSession: null, siteUsage: {}, siteLimitPauses: {}
  });
  if (!Array.isArray(state.reminders)) state.reminders = makeDefaultReminders();
  state.reminders = state.reminders.slice(0, MAX_REMINDERS).map(item => {
    try { return normalizeReminder(item); }
    catch {
      if (item?.type === "once" && item?.when) {
        try { return normalizeReminder({ ...item, enabled: false }); } catch {}
      }
      return null;
    }
  }).filter(Boolean);
  state.settings = normalizeSettings(state.settings);
  state.history = sanitizeHistory(state.history);
  state.siteUsage = sanitizeUsage(state.siteUsage);
  state.notificationMap = state.notificationMap && typeof state.notificationMap === "object" ? state.notificationMap : {};
  state.notificationWindows = state.notificationWindows && typeof state.notificationWindows === "object" ? state.notificationWindows : {};
  state.siteLimitPauses = state.siteLimitPauses && typeof state.siteLimitPauses === "object" && !Array.isArray(state.siteLimitPauses)
    ? state.siteLimitPauses
    : {};
  return state;
}

async function saveState(patch) {
  await browser.storage.local.set(patch);
}

async function recordHistory(entry) {

  const { settings, history = [] } = await getState();
  if (settings.historyEnabled === false) return;
  history.unshift({ id: crypto.randomUUID(), timestamp: Date.now(), ...entry });
  await saveState({ history: history.slice(0, MAX_HISTORY) });
}

async function getReminder(reminderId) {
  const { reminders } = await getState();
  return reminders.find(r => r.id === reminderId) || null;
}

async function updateReminder(reminderId, patch) {
  const { reminders } = await getState();
  const index = reminders.findIndex(r => r.id === reminderId);
  if (index < 0) return null;
  reminders[index] = { ...reminders[index], ...patch };
  await saveState({ reminders });
  return reminders[index];
}

async function clearReminderAlarms(id) {
  await browser.alarms.clear(`reminder:${id}`);
  await browser.alarms.clear(`snooze:${id}`);
  await browser.alarms.clear(`quiet:${id}`);
}

async function clearAllReminderAlarms() {
  const alarms = await browser.alarms.getAll();
  await Promise.all(alarms
    .filter(a => a.name.startsWith("reminder:") || a.name.startsWith("snooze:") || a.name.startsWith("quiet:"))
    .map(a => browser.alarms.clear(a.name)));
}

async function scheduleReminder(reminder) {
  await clearReminderAlarms(reminder.id);
  if (!reminder.enabled || reminder.type === "site") return;
  const when = nextDueDate(reminder);
  if (Number.isFinite(when) && when > Date.now()) {
    await browser.alarms.create(`reminder:${reminder.id}`, { when });
  }
}

async function syncReminderAlarms() {
  await clearAllReminderAlarms();
  const { reminders } = await getState();
  for (const reminder of reminders) await scheduleReminder(reminder);
  await browser.alarms.clear(HOUSEKEEPING_ALARM);
  await browser.alarms.create(HOUSEKEEPING_ALARM, { periodInMinutes: 30 });
}

async function openNotificationWindow(reminder, settings) {
  const query = reminder
    ? new URLSearchParams({ reminder: reminder.id, snooze: String(settings.defaultSnooze) })
    : new URLSearchParams({ test: "1" });
  const url = browser.runtime.getURL(`notification/notification.html?${query}`);
  const created = browser.windows?.create
    ? await browser.windows.create({
      url,
      type: "popup",
      width: Math.min(900, Math.max(320, Number(settings.notificationWindow?.width) || 430)),
      height: Math.min(900, Math.max(260, Number(settings.notificationWindow?.height) || 520))
    })
    : await browser.tabs.create({ url });
  const surfaceId = created?.id;
  if (surfaceId && reminder) {
    const state = await getState();
    const surfaceKey = browser.windows?.create ? String(surfaceId) : `tab:${surfaceId}`;
    state.notificationWindows[surfaceKey] = reminder.id;
    await saveState({ notificationWindows: state.notificationWindows });
  }
  return created;
}

async function createNativeNotification(reminder) {
  const id = `notification:${crypto.randomUUID()}`;
  const iconSvg = WebNudgeIcons.getSvg(reminder.icon || "bell")
    .replace('width="24"', 'width="96"')
    .replace('height="24"', 'height="96"')
    .replaceAll("currentColor", "#267c68");
  const iconUrl = reminder.imageData || `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(iconSvg)}`;
  await browser.notifications.create(id, {
    type: "basic",
    title: reminder.name || "Vmes",
    message: reminder.message || "Čas je za opomnik.",
    iconUrl,
    priority: 1,
    eventTime: Date.now()
  });
  const { notificationMap = {} } = await getState();
  notificationMap[id] = { reminderId: reminder.id, createdAt: Date.now(), test: reminder.id === "__test__" };
  await saveState({ notificationMap });
}

async function injectInPage(tabId, reminder, settings) {
  if (!tabId) return false;
  const payload = {
    type: "SHOW_IN_PAGE_REMINDER",
    reminder,
    options: {
      duration: settings.notificationDuration,
      snooze: settings.defaultSnooze,
      snoozeEnabled: reminder.snoozeEnabled !== false,
      sound: settings.sound,
      soundName: (reminder?.soundName && reminder.soundName !== "default") ? reminder.soundName : settings.soundName,
      soundVolume: settings.soundVolume
    }
  };
  try {
    await browser.tabs.sendMessage(tabId, payload);
    return true;
  } catch {
    try {
      await browser.scripting.executeScript({ target: { tabId }, files: ["lib/sounds.js", "content/content.js"] });
      await browser.tabs.sendMessage(tabId, payload);
      return true;
    } catch { return false; }
  }
}

async function showInPageOnActiveTab(reminder, settings) {
  if (!settings.showInPage) return false;
  let tabs = [];
  try { tabs = await browser.tabs.query({ active: true, lastFocusedWindow: true }); } catch { return false; }
  const tab = tabs[0];
  if (!tab?.id || !isHttpUrl(tab.url || "")) return false;
  if (!(await hasHostAccess(hostFromUrl(tab.url)))) return false;
  return injectInPage(tab.id, reminder, settings);
}

async function hasHostAccess(host) {
  const origins = originPatternsForHost(host);
  if (!origins.length) return false;
  try { return await browser.permissions.contains({ origins }); } catch { return false; }
}

function requestRequiredOrigins(reminder) {
  return getRequiredOrigins(reminder);
}

async function showReminder(reminder, { isSnooze = false, ignoreQuiet = false, preview = false, skipWindow = false } = {}) {
  const { settings } = await getState();
  if (!ignoreQuiet && isQuietHours(settings)) {
    await recordHistory({ reminderId: reminder.id, name: reminder.name, status: "quiet-hours", quietBehavior: settings.quietBehavior });
    if (settings.quietBehavior === "queue") {
      const end = quietEnd(settings);
      if (end) await browser.alarms.create(`quiet:${reminder.id}`, { when: end.getTime() + 1000 });
    } else {
      if (reminder.type === "once") {
        await updateReminder(reminder.id, { enabled: false });
      } else if (reminder.type === "interval") {
        await updateReminder(reminder.id, { lastTriggeredAt: Date.now() });
      }
      const fresh = await getReminder(reminder.id);
      if (fresh) await scheduleReminder(fresh);
    }
    return { shown: false, quiet: true };
  }

  const messagePool = WebNudgeCore.getReminderMessagePool(reminder);
  const messageCursor = reminder.messageCursor % messagePool.length;
  const selectedMessage = reminder.messageMode === "rotate"
    ? messagePool[messageCursor]
    : reminder.message;
  const latest = preview
    ? { ...reminder, message: selectedMessage }
    : (await updateReminder(reminder.id, {
      lastTriggeredAt: Date.now(),
      updatedAt: Date.now(),
      ...(reminder.messageMode === "rotate" ? {
        message: selectedMessage,
        messageCursor: (messageCursor + 1) % messagePool.length
      } : {})
    }) || reminder);
  if (!preview && reminder.messageMode === "rotate") latest.message = selectedMessage;
  const channels = getChannelsForMode(latest.notificationMode || settings.notificationMode);
  const result = { shown: false, channels: [] };

  if (channels.includes("system")) {
    try { await createNativeNotification(latest); result.shown = true; result.channels.push("system"); } catch {}
  }
  if (channels.includes("window") && !skipWindow) {
    try { await openNotificationWindow(latest, settings); result.shown = true; result.channels.push("window"); } catch {}
  }
  if (channels.includes("inpage")) {
    if (await showInPageOnActiveTab(latest, settings)) { result.shown = true; result.channels.push("inpage"); }
  }

  if (!preview && result.shown && latest.actionType !== "none" && latest.actionOpenTiming === "immediate") {
    try {
      await openReminderAction(latest);
    } catch (error) {
      console.error("Could not open reminder action:", error);
    }
  }

  await recordHistory({
    reminderId: latest.id, name: latest.name,
    status: preview ? "test" : (result.shown ? "shown" : "unavailable"),
    channel: result.channels.join("+") || channels.join("+"),
    isSnooze,
    preview
  });
  if (!preview) await scheduleReminder(latest);
  return result;
}

async function hideInPageReminder(reminderId) {
  try {
    const tabs = await browser.tabs.query({});
    await Promise.all(tabs.filter(t => t.id).map(async tab => {
      try { await browser.tabs.sendMessage(tab.id, { type: "HIDE_IN_PAGE_REMINDER", reminderId }); } catch {}
    }));
  } catch {}
}

async function closeReminderWindows(reminderId) {
  const { notificationWindows = {} } = await getState();
  const ids = Object.entries(notificationWindows).filter(([, value]) => value === reminderId).map(([id]) => id);
  for (const id of ids) {
    if (id.startsWith("tab:")) {
      try { await browser.tabs.remove(Number(id.slice(4))); } catch {}
    } else if (browser.windows?.remove) {
      try { await browser.windows.remove(Number(id)); } catch {}
    }
    delete notificationWindows[id];
  }
  await saveState({ notificationWindows });
}

async function openReminderAction(reminder) {
  let targetUrl = "";
  if (reminder.actionType === "breathing") {
    targetUrl = browser.runtime.getURL("exercises/breathing.html");
  } else if (reminder.actionType === "eyes") {
    targetUrl = browser.runtime.getURL("exercises/eyes.html");
  } else if (reminder.actionType === "stretches") {
    const STRETCH_GROUPS = ["neck", "upper", "legs"];
    const previousIndex = Number.isInteger(reminder.stretchGroupIndex) ? reminder.stretchGroupIndex : -1;
    const nextIndex = (previousIndex + 1) % STRETCH_GROUPS.length;
    await updateReminder(reminder.id, { stretchGroupIndex: nextIndex });
    targetUrl = browser.runtime.getURL(`exercises/stretches.html?group=${STRETCH_GROUPS[nextIndex]}`);
  } else if (reminder.actionType === "url") {
    const rawList = Array.isArray(reminder.actionUrls) && reminder.actionUrls.length
      ? reminder.actionUrls
      : (reminder.actionUrl ? [reminder.actionUrl] : []);
    const cleanUrls = rawList
      .map(url => String(url || "").trim())
      .filter(Boolean)
      .map(url => (/^https?:\/\//i.test(url) ? url : "https://" + url));

    if (cleanUrls.length) {
      if (reminder.actionUrlMode === "all") {
        for (const url of cleanUrls) await browser.tabs.create({ url });
        return;
      }
      const previousIndex = Number.isInteger(reminder.actionUrlLastIndex) ? reminder.actionUrlLastIndex : -1;
      const nextIndex = (previousIndex + 1) % cleanUrls.length;
      targetUrl = cleanUrls[nextIndex];
      await updateReminder(reminder.id, { actionUrlLastIndex: nextIndex });
    }
  }
  if (targetUrl) await browser.tabs.create({ url: targetUrl });
}

async function actionForReminder(reminderId, action, extra = {}) {
  const reminder = await getReminder(reminderId);
  await recordHistory({ reminderId, name: reminder?.name || "Vmes", status: action, ...extra });
  await clearRelatedNotifications(reminderId);
  await hideInPageReminder(reminderId);
  await closeReminderWindows(reminderId);

  // Če je bila izbrana akcija (aktivnost/vaja ali spletna povezava) in uporabnik potrdi/začne
  if ((action === "completed" || action === "start_activity")
    && reminder?.actionType && reminder.actionType !== "none"
    && reminder.actionOpenTiming !== "immediate") {
    try {
      await openReminderAction(reminder);
    } catch (error) {
      console.error("Could not open reminder action:", error);
    }
  }
}

async function clearRelatedNotifications(reminderId) {
  const { notificationMap = {} } = await getState();
  const ids = Object.entries(notificationMap)
    .filter(([, value]) => value?.reminderId === reminderId)
    .map(([id]) => id);
  if (!ids.length) return;
  for (const id of ids) delete notificationMap[id];
  // Remove the mapping before clearing the OS notification so onClosed cannot
  // accidentally record a second "dismissed" event for a handled action.
  await saveState({ notificationMap });
  await Promise.all(ids.map(async id => { try { await browser.notifications.clear(id); } catch {} }));
}

async function snoozeReminder(id, minutes) {
  const reminder = await getReminder(id);
  if (!reminder || reminder.snoozeEnabled === false) return false;
  const safeMinutes = Math.min(24 * 60, Math.max(1, Math.round(Number(minutes) || 5)));
  await clearReminderAlarms(id);
  await browser.alarms.create(`snooze:${id}`, { delayInMinutes: safeMinutes });
  await recordHistory({ reminderId: id, name: reminder.name, status: "snoozed", snoozeMinutes: safeMinutes });
  await clearRelatedNotifications(id);
  await closeReminderWindows(id);
  return true;
}

async function currentFocusedTab() {
  if (browser.windows?.getLastFocused) {
    try {
      const win = await browser.windows.getLastFocused({ populate: true });
      const tab = win?.tabs?.find(t => t.active);
      if (tab) return tab;
    } catch {}
  }
  try {
    const tabs = await browser.tabs.query({ active: true });
    return tabs.find(tab => tab.active) || tabs[0] || null;
  } catch {
    return null;
  }
}

function sessionElapsedSeconds(session, now = Date.now()) {
  if (!session?.startedAt) return 0;
  const lastSeen = Number(session.lastSeenAt || session.startedAt);
  const effectiveNow = Math.min(now, lastSeen + MAX_SESSION_GAP_MS);
  return Math.max(0, Math.floor((effectiveNow - Number(session.startedAt)) / 1000));
}

function addUsageInterval(siteUsage, host, startMs, endMs) {
  let cursor = new Date(startMs);
  const end = new Date(endMs);
  while (cursor < end) {
    const nextDay = new Date(cursor);
    nextDay.setHours(24, 0, 0, 0);
    const segmentEnd = nextDay < end ? nextDay : end;
    const seconds = Math.max(0, Math.floor((segmentEnd - cursor) / 1000));
    if (seconds) {
      const key = localDateKey(cursor);
      siteUsage[key] ||= {};
      siteUsage[key][host] = Number(siteUsage[key][host] || 0) + seconds;
    }
    cursor = segmentEnd;
  }
}

async function endActiveSiteSession() {
  const { activeSiteSession, siteUsage = {} } = await getState();
  if (!activeSiteSession?.host) return;
  const now = Date.now();
  const lastSeen = Number(activeSiteSession.lastSeenAt || activeSiteSession.startedAt || now);
  const cappedEnd = Math.min(now, lastSeen + MAX_SESSION_GAP_MS);
  if (cappedEnd > Number(activeSiteSession.startedAt || cappedEnd)) addUsageInterval(siteUsage, activeSiteSession.host, Number(activeSiteSession.startedAt), cappedEnd);
  await saveState({ siteUsage: pruneSiteUsage(siteUsage), activeSiteSession: null });
}

async function startOrSwitchSiteSession() {
  const { settings, activeSiteSession, reminders } = await getState();
  if (!hasEnabledSiteFeature(settings)) { await endActiveSiteSession(); return; }
  const tab = await currentFocusedTab();
  if (!tab?.id || !isHttpUrl(tab.url || "")) { await endActiveSiteSession(); return; }
  const host = hostFromUrl(tab.url);
  if (!host || !(await hasHostAccess(host))) { await endActiveSiteSession(); return; }
  const hasSiteReminder = reminders.some(r => r.enabled && r.type === "site" && normalizeHost(r.site) === host);
  const hasFocusRule = (settings.blockRules || []).some(rule => rule.enabled && (rule.host === host || host.endsWith("." + rule.host)));
  if (!hasSiteReminder && !hasFocusRule) { await endActiveSiteSession(); return; }
  if (activeSiteSession?.tabId === tab.id && activeSiteSession?.windowId === tab.windowId && activeSiteSession?.host === host) return;
  await endActiveSiteSession();
  const now = Date.now();
  await saveState({ activeSiteSession: {
    tabId: tab.id, windowId: tab.windowId, host, startedAt: now, lastSeenAt: now, sessionId: crypto.randomUUID(), firedReminders: {}
  }});
}

async function getCurrentSessionSeconds() {
  const { activeSiteSession } = await getState();
  return sessionElapsedSeconds(activeSiteSession);
}

async function checkSiteReminders() {
  const { settings, reminders } = await getState();
  if (!hasEnabledSiteFeature(settings)) return;
  await startOrSwitchSiteSession();
  const state = await getState();
  const session = state.activeSiteSession;
  if (!session?.host) return;
  const now = Date.now();
  const nextSession = { ...session, lastSeenAt: now, firedReminders: { ...(session.firedReminders || {}) } };
  let shouldReset = false;
  let shownCount = 0;
  const seconds = sessionElapsedSeconds(session, now);
  for (const reminder of reminders) {
    if (!reminder.enabled || reminder.type !== "site" || normalizeHost(reminder.site) !== session.host) continue;
    const threshold = Math.max(1, Number(reminder.afterMinutes) || 30) * 60;
    if (seconds < threshold || nextSession.firedReminders[reminder.id]) continue;
    const result = await showReminder(reminder);
    if (result?.shown) {
      shownCount += 1;
      nextSession.firedReminders[reminder.id] = now;
      if (reminder.resetSiteTimerAfterNudge !== false) shouldReset = true;
    }
  }
  if (shouldReset) {
    nextSession.startedAt = now;
    nextSession.firedReminders = {};
  }
  if (shownCount || nextSession.lastSeenAt !== session.lastSeenAt) await saveState({ activeSiteSession: nextSession });

  // Preveri tudi morebitne časovne omejitve za aktivno stran
  await checkSiteLimitsAndBlocks();
}

async function checkSiteLimitsAndBlocks() {
  try {
    const { settings, siteUsage = {}, siteLimitPauses = {} } = await getState();
    const rules = Array.isArray(settings.blockRules) ? settings.blockRules.filter(r => r.enabled) : [];
    if (!rules.length) return;

    const tab = await currentFocusedTab();
    if (!tab?.id || !isHttpUrl(tab.url || "")) return;
    const host = hostFromUrl(tab.url);
    if (!host) return;

    const rule = rules.find(r => r.host === host || host.endsWith("." + r.host));
    if (!rule) return;

    const now = Date.now();
    const pauseUntil = Number(siteLimitPauses[host]) || 0;
    if (pauseUntil > now) return;
    if (pauseUntil) {
      delete siteLimitPauses[host];
      await saveState({ siteLimitPauses });
    }

    const todayKey = localDateKey(new Date(now));
    const usedHosts = Object.entries(siteUsage[todayKey] || {});
    let secondsToday = usedHosts.reduce((total, [usedHost, seconds]) =>
      usedHost === rule.host || usedHost.endsWith("." + rule.host) ? total + Number(seconds || 0) : total, 0);
    const { activeSiteSession } = await getState();
    if (activeSiteSession?.host && (activeSiteSession.host === rule.host || activeSiteSession.host.endsWith("." + rule.host))) {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const start = Math.max(Number(activeSiteSession.startedAt) || now, dayStart.getTime());
      const lastSeen = Number(activeSiteSession.lastSeenAt || activeSiteSession.startedAt || now);
      const end = Math.min(now, lastSeen + MAX_SESSION_GAP_MS);
      secondsToday += Math.max(0, Math.floor((end - start) / 1000));
    }

    if (rule.mode === "block") {
      // Vedno prepovedano
      const blockedUrl = browser.runtime.getURL(`exercises/blocked.html?host=${encodeURIComponent(host)}&reason=blocked&spent=${secondsToday}`);
      if (!tab.url.startsWith(browser.runtime.getURL("exercises/blocked.html"))) {
        await browser.tabs.update(tab.id, { url: blockedUrl });
      }
    } else if (rule.mode === "limit") {
      // Dnevna časovna omejitev v minutah
      const limitSeconds = (Number(rule.dailyLimitMinutes) || 30) * 60;
      if (secondsToday >= limitSeconds) {
        const blockedUrl = browser.runtime.getURL(`exercises/blocked.html?host=${encodeURIComponent(host)}&reason=limit&spent=${secondsToday}&limit=${rule.dailyLimitMinutes}`);
        if (!tab.url.startsWith(browser.runtime.getURL("exercises/blocked.html"))) {
          await browser.tabs.update(tab.id, { url: blockedUrl });
        }
      }
    }
  } catch (error) {
    console.error("Could not check site focus rule:", error);
  }
}

async function enableSiteTrackingFromUserGesture() {
  const { reminders, settings } = await getState();
  const hosts = [...new Set(reminders.filter(r => r.enabled && r.type === "site").map(r => normalizeHost(r.site)).filter(Boolean))];
  return { settings, hosts, origins: hosts.flatMap(originPatternsForHost) };
}

async function setAllRemindersEnabled(enabled) {
  const { reminders } = await getState();
  const next = reminders.map(reminder => {
    if (!enabled) return { ...reminder, enabled: false, updatedAt: Date.now() };
    if (reminder.type === "once" && !nextDueDate({ ...reminder, enabled: true }, Date.now())) return { ...reminder, enabled: false, updatedAt: Date.now() };
    const now = Date.now();
    return {
      ...reminder,
      enabled: true,
      ...(reminder.type === "interval" ? { createdAt: now, lastTriggeredAt: now } : {}),
      updatedAt: now
    };
  });
  await saveState({ reminders: next });
  for (const reminder of next) await scheduleReminder(reminder);
  await startOrSwitchSiteSession();
  return next;
}

async function triggerReminderNow(reminderId) {
  const reminder = await getReminder(reminderId);
  if (!reminder) return { ok: false, error: "Opomnik ne obstaja." };
  const { settings } = await getState();
  // Vedno odpri okno z obvestilom kot zanesljiv predogled, ne glede na nastavljen kanal
  let windowOpened = false;
  try {
    await openNotificationWindow(reminder, settings);
    windowOpened = true;
  } catch {}
  // Dodatno sproži tudi ostale kanale (sistemsko obvestilo ipd.), okno preskočimo ker je že odprto
  const result = await showReminder(reminder, { ignoreQuiet: true, preview: true, skipWindow: true });
  const channels = [...new Set([...(result?.channels || []), ...(windowOpened ? ["window"] : [])])];
  return { ok: true, shown: windowOpened || Boolean(result?.shown), channels };
}

async function setSiteTracking(enabled) {
  const { settings, reminders } = await getState();
  if (!enabled) {
    const error = siteTrackingDisableError(settings, reminders);
    if (error) return { ok: false, error };
  }
  await browser.alarms.clear(TRACKING_ALARM);
  await endActiveSiteSession();
  const next = { ...settings, siteTrackingEnabled: Boolean(enabled) };
  await saveState({ settings: next });
  if (enabled) {
    await browser.alarms.create(TRACKING_ALARM, { periodInMinutes: 1 });
    await startOrSwitchSiteSession();
  }
  return { ok: true };
}

async function cleanupRuntimeState() {
  const state = await getState();
  const now = Date.now();
  const staleNotificationIds = Object.entries(state.notificationMap).filter(([, entry]) => now - Number(entry?.createdAt || now) > 2 * 24 * 60 * 60 * 1000).map(([id]) => id);
  for (const id of staleNotificationIds) delete state.notificationMap[id];
  const windows = {};
  for (const [id, reminderId] of Object.entries(state.notificationWindows)) {
    if (id.startsWith("tab:")) {
      try { await browser.tabs.get(Number(id.slice(4))); windows[id] = reminderId; } catch {}
    } else if (browser.windows?.get) {
      try { await browser.windows.get(Number(id)); windows[id] = reminderId; } catch {}
    }
  }
  await saveState({ notificationMap: state.notificationMap, notificationWindows: windows, history: sanitizeHistory(state.history), siteUsage: pruneSiteUsage(state.siteUsage) });
  const currentAlarms = await browser.alarms.getAll();
  const validIds = new Set(state.reminders.map(r => r.id));
  await Promise.all(currentAlarms.filter(a => {
    if (a.name.startsWith("reminder:") || a.name.startsWith("snooze:") || a.name.startsWith("quiet:")) return !validIds.has(a.name.split(":").slice(1).join(":"));
    return false;
  }).map(a => browser.alarms.clear(a.name)));
}

async function resetEverything() {
  await browser.alarms.clearAll();
  await saveState({
    settings: { ...DEFAULT_SETTINGS },
    reminders: makeDefaultReminders(),
    starterReminderDefaultsVersion: 3,
    history: [], notificationMap: {}, notificationWindows: {}, activeSiteSession: null, siteUsage: {}, siteLimitPauses: {}
  });
  await syncReminderAlarms();
}

browser.runtime.onInstalled.addListener(({ reason }) => withLock(async () => {
  const current = await browser.storage.local.get(["settings", "reminders"]);
  if (!current.settings) await saveState({ settings: DEFAULT_SETTINGS });
  if (!current.reminders) await saveState({ reminders: makeDefaultReminders(), starterReminderDefaultsVersion: 3 });
  else await saveState({ settings: normalizeSettings(current.settings) });
  if (reason === "update") await migrateStarterReminderIntervals();
  await cleanupRuntimeState();
  await syncReminderAlarms();
  const updatedState = await getState();
  if (hasEnabledSiteFeature(updatedState.settings)) {
    await browser.alarms.create(TRACKING_ALARM, { periodInMinutes: 1 });
    await startOrSwitchSiteSession();
  }
  if (reason === "install") {
    const { settings } = updatedState;
    await saveState({ settings: { ...settings, onboardingCompleted: false }, activeSiteSession: null, siteUsage: {} });
    await browser.tabs.create({ url: browser.runtime.getURL("onboarding/onboarding.html") });
  }
}));

browser.runtime.onStartup.addListener(() => withLock(async () => {
  await endActiveSiteSession();
  await cleanupRuntimeState();
  await syncReminderAlarms();
  const { settings, reminders } = await getState();
  if (hasEnabledSiteFeature(settings)) {
    await browser.alarms.create(TRACKING_ALARM, { periodInMinutes: 1 });
    await startOrSwitchSiteSession();
  }
}));

browser.commands.onCommand.addListener(command => withLock(async () => {
  if (command === "add-reminder") await browser.tabs.create({ url: browser.runtime.getURL("options/options.html#new-reminder") });
}));

browser.tabs.onActivated.addListener(() => withLock(async () => {
  const { settings } = await getState();
  if (settings.siteTrackingEnabled) await startOrSwitchSiteSession();
  await checkSiteLimitsAndBlocks();
}));
browser.windows?.onFocusChanged?.addListener(windowId => withLock(async () => {
  if (windowId === browser.windows.WINDOW_ID_NONE) return endActiveSiteSession();
  const { settings } = await getState();
  if (settings.siteTrackingEnabled) await startOrSwitchSiteSession();
  await checkSiteLimitsAndBlocks();
}));
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => withLock(async () => {
  if (tab.active && (changeInfo.status === "complete" || changeInfo.url)) {
    const { settings } = await getState();
    if (settings.siteTrackingEnabled) await startOrSwitchSiteSession();
    await checkSiteLimitsAndBlocks();
  }
}));
browser.tabs.onRemoved.addListener(tabId => withLock(async () => {
  const { activeSiteSession, notificationWindows = {} } = await getState();
  if (activeSiteSession?.tabId === tabId) await endActiveSiteSession();
  const notificationKey = `tab:${tabId}`;
  if (Object.prototype.hasOwnProperty.call(notificationWindows, notificationKey)) {
    delete notificationWindows[notificationKey];
    await saveState({ notificationWindows });
  }
}));
browser.permissions.onRemoved.addListener(permissions => withLock(async () => {
  if (!permissions.origins?.length) return;
  await startOrSwitchSiteSession();
  await checkSiteLimitsAndBlocks();
}));

browser.windows?.onRemoved?.addListener(windowId => withLock(async () => {
  const { notificationWindows = {} } = await getState();
  if (Object.prototype.hasOwnProperty.call(notificationWindows, windowId)) {
    delete notificationWindows[windowId];
    await saveState({ notificationWindows });
  }
}));

browser.alarms.onAlarm.addListener(alarm => withLock(async () => {
  if (alarm.name === TRACKING_ALARM) return checkSiteReminders();
  if (alarm.name === HOUSEKEEPING_ALARM) {
    await cleanupRuntimeState();
    await syncReminderAlarms();
    return;
  }
  if (alarm.name.startsWith("snooze:")) {
    const id = alarm.name.slice("snooze:".length);
    const reminder = await getReminder(id);
    if (reminder?.enabled) await showReminder(reminder, { isSnooze: true });
    return;
  }
  if (alarm.name.startsWith("quiet:")) {
    const id = alarm.name.slice("quiet:".length);
    const reminder = await getReminder(id);
    if (reminder?.enabled) await showReminder(reminder, { ignoreQuiet: true });
    return;
  }
  if (!alarm.name.startsWith("reminder:")) return;
  const id = alarm.name.slice("reminder:".length);
  const reminder = await getReminder(id);
  if (!reminder?.enabled) return;
  await showReminder(reminder);
  if (reminder.type === "once") {
    await updateReminder(id, { enabled: false });
    await clearReminderAlarms(id);
  }
}));

browser.notifications.onClicked.addListener(notificationId => withLock(async () => {
  const { notificationMap = {}, settings } = await getState();
  const entry = notificationMap[notificationId];
  if (!entry) return;
  const reminder = await getReminder(entry.reminderId);
  try {
    if (entry.test) {
      await openNotificationWindow(null, settings);
    } else if (reminder) await openNotificationWindow(reminder, settings);
    else await browser.runtime.openOptionsPage();
  } catch {}
  try { await browser.notifications.clear(notificationId); } catch {}
  delete notificationMap[notificationId];
  await saveState({ notificationMap });
}));

browser.notifications.onClosed.addListener(notificationId => withLock(async () => {
  const { notificationMap = {} } = await getState();
  const entry = notificationMap[notificationId];
  if (!entry) return;
  await recordHistory({ reminderId: entry.reminderId, status: "dismissed" });
  delete notificationMap[notificationId];
  await saveState({ notificationMap });
}));

async function handleMessage(message, sender) {
  if (!message) return undefined;
  if (message.type === "CLOSE_EXERCISE_TAB") {
    const exercisePagePrefix = browser.runtime.getURL("exercises/");
    if (!sender?.url?.startsWith(exercisePagePrefix) || !Number.isInteger(sender.tab?.id)) {
      return { ok: false, error: "Zapreti je mogoče samo zavihek z vajo." };
    }
    await browser.tabs.remove(sender.tab.id);
    return { ok: true };
  }
  const state = await getState();

  if (message.type === "GET_STATE") return { ...state, siteUsage: pruneSiteUsage(state.siteUsage), currentVersion: VERSION };
  if (message.type === "EXPORT_DATA") {
    const exportState = {
      format: "web-nudge-backup", version: VERSION, schemaVersion: 1, exportedAt: new Date().toISOString(),
      settings: state.settings, reminders: state.reminders, history: state.history, siteUsage: pruneSiteUsage(state.siteUsage)
    };
    return { ok: true, data: exportState };
  }
  if (message.type === "IMPORT_DATA") {
    const incoming = message.data;
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming) || incoming.format !== "web-nudge-backup" || !Array.isArray(incoming.reminders) || !incoming.settings || typeof incoming.settings !== "object" || Array.isArray(incoming.settings)) {
      return { ok: false, error: "Datoteka ni veljavna varnostna kopija Spletnega opomnika." };
    }
    if (![undefined, 1].includes(incoming.schemaVersion)) return { ok: false, error: "Različica varnostne kopije ni podprta." };
    if (incoming.settings.blockRules != null && !Array.isArray(incoming.settings.blockRules)) return { ok: false, error: "Pravila spletnega fokusa v varnostni kopiji niso veljavna." };
    if ((incoming.settings.blockRules || []).length > 50) return { ok: false, error: "Varnostna kopija vsebuje preveč pravil spletnega fokusa." };
    if ((incoming.settings.blockRules || []).some(rule => !normalizeBlockRule(rule))) return { ok: false, error: "Varnostna kopija vsebuje neveljavno pravilo spletnega fokusa." };
    if (incoming.reminders.length > MAX_REMINDERS) return { ok: false, error: "Varnostna kopija vsebuje preveč opomnikov." };
    if (incoming.reminders.some(item => !item || typeof item !== "object" || Array.isArray(item))) {
      return { ok: false, error: "Varnostna kopija vsebuje neveljaven opomnik." };
    }
    if (incoming.history != null && !Array.isArray(incoming.history)) return { ok: false, error: "Zgodovina v varnostni kopiji ni veljavna." };
    if (incoming.siteUsage != null && (typeof incoming.siteUsage !== "object" || Array.isArray(incoming.siteUsage))) {
      return { ok: false, error: "Podatki o času na spletnih straneh v varnostni kopiji niso veljavni." };
    }
    let reminders;
    try { reminders = incoming.reminders.map(normalizeReminder); } catch (error) {
      return { ok: false, error: error.message || "Opomnikov ni bilo mogoče uvoziti." };
    }
    if (new Set(reminders.map(reminder => reminder.id)).size !== reminders.length) {
      return { ok: false, error: "Varnostna kopija vsebuje podvojene identifikatorje opomnikov." };
    }
    const settings = normalizeSettings(incoming.settings);
    if (settings.blockRules.some(rule => rule.enabled) || reminders.some(reminder => reminder.enabled && reminder.type === "site")) {
      settings.siteTrackingEnabled = true;
    }
    const importedRules = settings.blockRules.filter(rule => rule.enabled);
    const ruleOrigins = importedRules.map(rule => normalizeHost(rule.host)).filter(Boolean).flatMap(originPatternsForHost);
    const reminderOrigins = reminders.filter(r => r.enabled && r.type === "site").map(r => normalizeHost(r.site)).filter(Boolean).flatMap(originPatternsForHost);
    const importOrigins = [...new Set([...reminderOrigins, ...ruleOrigins])];
    if (settings.siteTrackingEnabled && importOrigins.length && !(await browser.permissions.contains({ origins: importOrigins }).catch(() => false))) {
      return { ok: true, needsPermission: true, origins: importOrigins };
    }
    await clearAllReminderAlarms();
    await saveState({ settings, reminders, history: sanitizeHistory(incoming.history), siteUsage: sanitizeUsage(incoming.siteUsage || {}), activeSiteSession: null, notificationMap: {}, notificationWindows: {} });
    await syncReminderAlarms();
    if (hasEnabledSiteFeature(settings)) {
      await browser.alarms.create(TRACKING_ALARM, { periodInMinutes: 1 });
      await startOrSwitchSiteSession();
    } else {
      await browser.alarms.clear(TRACKING_ALARM);
    }
    return { ok: true };
  }
  if (message.type === "SAVE_SETTINGS") {
    const patch = message.patch || {};
    const next = normalizeSettings({ ...state.settings, ...patch });
    if (patch.siteTrackingEnabled === false) {
      const error = siteTrackingDisableError(next, state.reminders);
      if (error) return { ok: false, error };
    }
    const hasActiveFocusRules = next.blockRules.some(rule => rule.enabled);
    if (hasActiveFocusRules && patch.blockRules) next.siteTrackingEnabled = true;
    await saveState({ settings: next });
    if (patch.blockRules) {
      if (hasEnabledSiteFeature(next)) {
        await browser.alarms.create(TRACKING_ALARM, { periodInMinutes: 1 });
        await startOrSwitchSiteSession();
      } else {
        await browser.alarms.clear(TRACKING_ALARM);
        await endActiveSiteSession();
      }
    }
    return { ok: true, settings: next };
  }
  if (message.type === "GET_REQUIRED_ORIGINS") return { origins: requestRequiredOrigins(message.reminder || {}) };

  if (message.type === "SAVE_REMINDER") {
    let reminder;
    try { reminder = normalizeReminder(message.reminder || {}); } catch (error) { return { ok: false, error: error.message }; }
    const requiredOrigins = requestRequiredOrigins(reminder);
    if (reminder.enabled && requiredOrigins.length) {
      let granted = false;
      try { granted = await browser.permissions.contains({ origins: requiredOrigins }); } catch {}
      if (!granted) return { ok: false, needsPermission: true, origins: requiredOrigins };
    }
    const reminders = state.reminders.slice();
    const index = reminders.findIndex(r => r.id === reminder.id);
    if (index < 0 && reminders.length >= MAX_REMINDERS) return { ok: false, error: "Doseženo je največje število opomnikov (100)." };
    if (index < 0) reminders.push(reminder); else reminders[index] = { ...reminders[index], ...reminder };
    const settings = reminder.type === "site" ? { ...state.settings, siteTrackingEnabled: true } : state.settings;
    await saveState({ reminders, settings });
    await scheduleReminder(reminder);
    if (reminder.type === "site") {
      await browser.alarms.create(TRACKING_ALARM, { periodInMinutes: 1 });
      await startOrSwitchSiteSession();
    }
    return { ok: true, reminder };
  }

  if (message.type === "DELETE_REMINDER") {
    await clearReminderAlarms(message.id);
    await clearRelatedNotifications(message.id);
    await hideInPageReminder(message.id);
    await closeReminderWindows(message.id);
    const { reminders } = await getState();
    await saveState({ reminders: reminders.filter(r => r.id !== message.id) });
    await startOrSwitchSiteSession();
    return { ok: true };
  }

  if (message.type === "SET_REMINDER_ENABLED") {
    const current = await getReminder(message.id);
    if (!current) return { ok: false, error: "Opomnik ne obstaja." };
    const enabled = Boolean(message.enabled);
    if (enabled && current.type === "once" && !nextDueDate({ ...current, enabled }, Date.now())) {
      return { ok: false, error: "Ta enkratni opomnik je že potekel. Uredite datum ali ga podvojite." };
    }
    const now = Date.now();
    const reminder = await updateReminder(message.id, {
      enabled,
      ...(enabled && current.type === "interval" ? { createdAt: now, lastTriggeredAt: now } : {}),
      updatedAt: now
    });
    await scheduleReminder(reminder);
    if (reminder.type === "site") await startOrSwitchSiteSession();
    return { ok: true, reminder };
  }

  if (message.type === "SET_ALL_ENABLED") {
    const reminders = await setAllRemindersEnabled(message.enabled);
    return { ok: true, reminders };
  }

  if (message.type === "TRIGGER_REMINDER_NOW") return triggerReminderNow(message.id);

  if (message.type === "SNOOZE") return { ok: await snoozeReminder(message.id, message.minutes) };

  if (message.type === "REMINDER_ACTION") {
    if (message.action === "snoozed") return { ok: await snoozeReminder(message.reminderId, message.minutes || state.settings.defaultSnooze) };
    await actionForReminder(message.reminderId, message.action || "completed");
    return { ok: true };
  }

  if (message.type === "DISMISS_REMINDER") { await actionForReminder(message.reminderId, "dismissed"); return { ok: true }; }

  if (message.type === "TRIGGER_TEST") {
    const channels = getChannelsForMode(message.mode || state.settings.notificationMode);
    const test = { id: "__test__", name: "Preizkusno obvestilo", message: "To je predogled izbranega načina obvestila.", snoozeEnabled: true };
    if (channels.includes("system")) { try { await createNativeNotification(test); } catch {} }
    if (channels.includes("window")) { try { await openNotificationWindow(test, state.settings); } catch {} }
    if (channels.includes("inpage")) await showInPageOnActiveTab(test, state.settings);
    await recordHistory({ reminderId: "__test__", name: test.name, status: "test", channel: channels.join("+") });
    return { ok: true };
  }

  if (message.type === "ENABLE_SITE_TRACKING") {
    const info = await enableSiteTrackingFromUserGesture();
    if (info.origins.length) {
      const granted = await browser.permissions.contains({ origins: info.origins }).catch(() => false);
      if (!granted) return { ok: false, needsPermission: true, origins: info.origins };
    }
    await setSiteTracking(true);
    return { ok: true };
  }

  if (message.type === "DISABLE_SITE_TRACKING") return setSiteTracking(false);
  if (message.type === "PAUSE_SITE_LIMIT") {
    const blockedPageUrl = browser.runtime.getURL("exercises/blocked.html");
    const host = normalizeHost(message.host);
    let blockedHost = "";
    try { blockedHost = normalizeHost(new URL(sender?.url || "").searchParams.get("host")); } catch {}
    if (!sender?.url?.startsWith(blockedPageUrl) || blockedHost !== host || !validateDomain(host)) {
      return { ok: false, error: "Podaljšanje je mogoče uporabiti samo na strani z omejitvijo." };
    }
    const { settings } = await getState();
    const hasMatchingRule = (settings.blockRules || []).some(rule =>
      rule.enabled && (rule.host === host || host.endsWith("." + rule.host))
    );
    if (!hasMatchingRule) return { ok: false, error: "Za to spletno mesto ni aktivne omejitve." };
    const minutes = Math.min(30, Math.max(1, Math.round(Number(message.minutes) || 5)));
    const { siteLimitPauses = {} } = await getState();
    const until = Date.now() + minutes * 60_000;
    await saveState({ siteLimitPauses: { ...siteLimitPauses, [host]: until } });
    return { ok: true, until };
  }
  if (message.type === "RESET_CURRENT_SITE") { await endActiveSiteSession(); return { ok: true }; }
  if (message.type === "SET_ONBOARDING_COMPLETE") {
    await saveState({ settings: { ...state.settings, onboardingCompleted: true } });
    return { ok: true };
  }
  if (message.type === "RESET") { await resetEverything(); return { ok: true }; }
  return undefined;
}

browser.runtime.onMessage.addListener((message, sender) => withLock(() => handleMessage(message, sender)));
