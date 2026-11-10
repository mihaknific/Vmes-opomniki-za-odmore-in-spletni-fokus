(() => {
  const VERSION = "0.9.2";
  const VALID_TYPES = new Set(["interval", "once", "schedule", "site"]);
  const VALID_MODES = new Set([
    "system",
    "window",
    "inpage",
    "system+window",
    "system+inpage",
    "window+inpage",
    "system+window+inpage",
    "both",
    "all"
  ]);
  const DEFAULT_SETTINGS = Object.freeze({
    theme: "forest",
    customThemeBase: "forest",
    customColors: null,
    appearanceSchemaVersion: 1,
    fontFamily: "system",
    fontSize: "standard",
    notificationMode: "system",
    notificationDuration: 8,
    defaultSnooze: 5,
    snoozeOptions: [5, 10, 30],
    sound: false,
    soundName: "soft-click",
    soundVolume: 0.55,
    showInPage: true,
    notificationWindow: { width: 430, height: 520 },
    quietHours: false,
    quietFrom: "22:00",
    quietTo: "06:00",
    quietBehavior: "skip",
    historyEnabled: true,
    siteTrackingEnabled: false,
    siteTrackingMode: "active-session",
    onboardingCompleted: false,
    schemaVersion: VERSION,
    blockRules: []
  });
  const REMINDER_MESSAGE_POOLS = Object.freeze({
    eyes: Object.freeze([
      "Za nekaj trenutkov poglejte v daljavo in sprostite oči.",
      "Odmaknite pogled od zaslona; oči si zaslužijo kratek počitek.",
      "Pomežiknite, sprostite pogled in se zazrite skozi okno.",
      "Naj pogled za hip počiva nekje daleč stran."
    ]),
    water: Object.freeze([
      "Čas za nekaj požirkov vode, če vam ustreza.",
      "Vzemite si trenutek za kozarec vode.",
      "Majhen požirek, majhen premor — osvežite se z vodo.",
      "Poskrbite zase: spijte nekaj vode, če je pravi trenutek."
    ]),
    movement: Object.freeze([
      "Vstanite, sprostite ramena in se nežno raztegnite.",
      "Čas za kratek odmik od sedenja — premaknite se po občutku.",
      "Nežen razteg lahko naredi prijeten premor.",
      "Razgibajte telo brez hitenja; izberite gib, ki vam ustreza."
    ]),
    breathing: Object.freeze([
      "Ustavite se za trenutek in nekajkrat mirno vdihnite.",
      "Naj bo naslednji vdih nekoliko počasnejši; sprostite ramena.",
      "Vzemite si kratek trenutek za miren vdih in izdih.",
      "Za hip se ustavite in opazite svoj dih."
    ]),
    general: Object.freeze([
      "Čas za kratek premor — vstanite ali sprostite pogled.",
      "Vzemite si trenutek zase, brez hitenja.",
      "Majhen premor lahko pomaga ponastaviti pozornost.",
      "Ustavite se za hip in preverite, kaj vam zdaj najbolj ustreza."
    ])
  });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const safeNumber = (value, fallback, min = -Infinity, max = Infinity) => {
    const number = Number(value);
    return Number.isFinite(number) ? clamp(number, min, max) : fallback;
  };

  function normalizeHost(value = "") {
    return String(value).trim().toLowerCase()
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split(/[/?#]/)[0]
      .replace(/\.$/, "");
  }

  function hostFromUrl(url = "") {
    try { return normalizeHost(new URL(url).hostname); } catch { return ""; }
  }

  function isHttpUrl(url = "") { return /^https?:\/\//i.test(url); }

  function parseTime(value = "00:00") {
    const match = /^(\d{2}):(\d{2})$/.exec(String(value));
    if (!match) return 0;
    return clamp(Number(match[1]), 0, 23) * 60 + clamp(Number(match[2]), 0, 59);
  }

  function localDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function minutesNow(date = new Date()) { return date.getHours() * 60 + date.getMinutes(); }

  function isQuietHours(settings, date = new Date()) {
    if (!settings?.quietHours) return false;
    const now = minutesNow(date), from = parseTime(settings.quietFrom), to = parseTime(settings.quietTo);
    return from <= to ? now >= from && now < to : now >= from || now < to;
  }

  function quietEnd(settings, from = new Date()) {
    if (!settings?.quietHours) return null;
    const d = new Date(from);
    const to = parseTime(settings.quietTo);
    d.setHours(Math.floor(to / 60), to % 60, 0, 0);
    if (d <= from) d.setDate(d.getDate() + 1);
    return d;
  }

  function originPatternsForHost(host) {
    const normalized = normalizeHost(host);
    if (!validateDomain(normalized)) return [];
    return [`*://${normalized}/*`, `*://*.${normalized}/*`];
  }

  function validateDomain(host) {
    const value = normalizeHost(host);
    if (!value || value.length > 253 || value.includes("..")) return false;
    if (!/^[a-z0-9.-]+$/.test(value) || /^[-.]|[-.]$/.test(value)) return false;
    const labels = value.split(".");
    return labels.every(label => label.length <= 63 && !/^[-]|[-]$/.test(label));
  }

  function getChannelsForMode(mode = "system") {
    if (Array.isArray(mode)) {
      const set = new Set();
      for (const item of mode) {
        for (const ch of getChannelsForMode(item)) set.add(ch);
      }
      const order = ["system", "window", "inpage"];
      const filtered = order.filter(c => set.has(c));
      return filtered.length ? filtered : ["system"];
    }
    const str = String(mode || "system").trim().toLowerCase();
    if (str === "all") return ["system", "window", "inpage"];
    if (str === "both") return ["system", "inpage"];
    const parts = str.split(/[+,| ]+/).map(s => s.trim()).filter(Boolean);
    const valid = new Set(["system", "window", "inpage"]);
    const set = new Set(parts.filter(p => valid.has(p)));
    if (!set.size) return ["system"];
    const order = ["system", "window", "inpage"];
    return order.filter(c => set.has(c));
  }

  function getRequiredOrigins(reminder) {
    if (!reminder || typeof reminder !== "object") return [];
    const origins = [];
    if (reminder.type === "site" && reminder.site) {
      origins.push(...originPatternsForHost(reminder.site));
    }
    const channels = getChannelsForMode(reminder.notificationMode);
    if (channels.includes("inpage") && reminder.type !== "site") {
      origins.push("*://*/*");
    }
    return [...new Set(origins.filter(Boolean))];
  }

  function nextOccurrenceForSchedule(reminder, from = new Date()) {
    const target = parseTime(reminder.time || "17:00");
    const weekdays = Array.isArray(reminder.weekdays) ? reminder.weekdays.map(Number) : [];
    for (let offset = 0; offset <= 14; offset += 1) {
      const d = new Date(from);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + offset);
      d.setHours(Math.floor(target / 60), target % 60, 0, 0);
      if (d <= from) continue;
      if (reminder.scheduleKind === "daily") return d;
      if (weekdays.includes(d.getDay())) return d;
    }
    return null;
  }

  function nextDueDate(reminder, now = Date.now()) {
    if (!reminder?.enabled || reminder.type === "site") return null;
    if (reminder.type === "once") {
      const when = Date.parse(reminder.when || "");
      return Number.isFinite(when) && when > now ? when : null;
    }
    if (reminder.type === "interval") {
      const mins = safeNumber(reminder.intervalMinutes, 20, 1, 10080);
      const anchor = Number(reminder.lastTriggeredAt || reminder.createdAt || now);
      const due = anchor + mins * 60000;
      return due > now ? due : now + 1000;
    }
    if (reminder.type === "schedule") {
      const anchor = Math.max(now, Number(reminder.lastTriggeredAt || 0) + 1000);
      return nextOccurrenceForSchedule(reminder, new Date(anchor))?.getTime() ?? null;
    }
    return null;
  }

  function formatRemainingDuration(milliseconds) {
    const remaining = Math.max(0, Number(milliseconds) || 0);
    if (remaining === 0) return "0 s";
    let seconds = Math.ceil(remaining / 1000);
    const days = Math.floor(seconds / 86400);
    seconds %= 86400;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;
    return [
      days ? `${days} d` : "",
      hours ? `${hours} h` : "",
      minutes ? `${minutes} min` : "",
      seconds ? `${seconds} s` : ""
    ].filter(Boolean).join(" ");
  }

  function normalizeSettings(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const legacyThemes = { light: "mono", color: "mono", dark: "dark-color" };
    const presetThemes = ["system", "indigo", "lagoon", "forest", "sunset", "mono", "mono-dark", "dark-color", "ocean", "cyber", "synth"];
    const validThemes = [...presetThemes, "custom"];
    let theme = validThemes.includes(source.theme) ? source.theme : (legacyThemes[source.theme] || DEFAULT_SETTINGS.theme);
    const customThemeBase = presetThemes.includes(source.customThemeBase) ? source.customThemeBase : DEFAULT_SETTINGS.customThemeBase;
    const defaultCustomColors = { background: "#f5f8f0", surface: "#ffffff", accent: "#267c68", text: "#253832", muted: "#63736b", border: "#dce7dc" };
    const normalizeColor = (value, fallback) => {
      if (typeof value !== "string" || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return fallback;
      const hex = value.slice(1);
      return `#${hex.length === 3 ? [...hex].map(channel => channel + channel).join("") : hex}`.toLowerCase();
    };
    const customColors = Object.fromEntries(
      Object.entries(defaultCustomColors).map(([key, fallback]) => [key, normalizeColor(source.customColors?.[key], fallback)])
    );
    const fontFamily = ["system", "humanist", "serif", "readable"].includes(source.fontFamily) ? source.fontFamily : DEFAULT_SETTINGS.fontFamily;
    const fontSize = ["compact", "standard", "large", "larger"].includes(source.fontSize) ? source.fontSize : DEFAULT_SETTINGS.fontSize;
    const notificationMode = VALID_MODES.has(source.notificationMode)
      ? source.notificationMode
      : getChannelsForMode(source.notificationMode).join("+");
    const quietBehavior = ["skip", "queue"].includes(source.quietBehavior) ? source.quietBehavior : DEFAULT_SETTINGS.quietBehavior;
    const snoozeOptions = [...new Set((Array.isArray(source.snoozeOptions) ? source.snoozeOptions : DEFAULT_SETTINGS.snoozeOptions)
      .map(v => safeNumber(v, 5, 1, 1440)))].slice(0, 6);
    const legacySoundMap = {
      bell: DEFAULT_SETTINGS.soundName,
      chime: DEFAULT_SETTINGS.soundName,
      "water-drop": "soft-click",
      "water-stream": "gentle-switch",
      "water-ripple": "soft-click",
      "rain-tap": "gentle-switch"
    };
    return {
      theme,
      customThemeBase,
      customColors,
      appearanceSchemaVersion: DEFAULT_SETTINGS.appearanceSchemaVersion,
      fontFamily,
      fontSize,
      notificationMode,
      notificationDuration: safeNumber(source.notificationDuration, 8, 3, 60),
      defaultSnooze: safeNumber(source.defaultSnooze, 5, 1, 1440),
      snoozeOptions: snoozeOptions.length ? snoozeOptions : [...DEFAULT_SETTINGS.snoozeOptions],
      sound: Boolean(source.sound),
      soundName: typeof source.soundName === "string" && source.soundName
        ? (legacySoundMap[source.soundName] || source.soundName)
        : DEFAULT_SETTINGS.soundName,
      soundVolume: safeNumber(source.soundVolume, DEFAULT_SETTINGS.soundVolume, 0, 1),
      showInPage: source.showInPage !== false,
      notificationWindow: {
        width: safeNumber(source.notificationWindow?.width, DEFAULT_SETTINGS.notificationWindow.width, 280, 1200),
        height: safeNumber(source.notificationWindow?.height, DEFAULT_SETTINGS.notificationWindow.height, 220, 1200)
      },
      quietHours: Boolean(source.quietHours),
      quietFrom: /^\d{2}:\d{2}$/.test(source.quietFrom || "") ? source.quietFrom : DEFAULT_SETTINGS.quietFrom,
      quietTo: /^\d{2}:\d{2}$/.test(source.quietTo || "") ? source.quietTo : DEFAULT_SETTINGS.quietTo,
      quietBehavior,
      historyEnabled: source.historyEnabled !== false,
      siteTrackingEnabled: Boolean(source.siteTrackingEnabled),
      siteTrackingMode: "active-session",
      onboardingCompleted: Boolean(source.onboardingCompleted),
      schemaVersion: VERSION,
      blockRules: Array.isArray(source.blockRules) ? source.blockRules.map(normalizeBlockRule).filter(Boolean).slice(0, 50) : []
    };
  }

  function normalizeBlockRule(raw = {}) {
    if (!raw || typeof raw !== "object") return null;
    const host = normalizeHost(raw.host || "");
    if (!host || !validateDomain(host)) return null;
    const mode = ["block", "limit"].includes(raw.mode) ? raw.mode : "block";
    const dailyLimitMinutes = safeNumber(raw.dailyLimitMinutes, 30, 1, 1440);
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : crypto.randomUUID(),
      host,
      mode,
      dailyLimitMinutes,
      enabled: raw.enabled !== false,
      createdAt: safeNumber(raw.createdAt, Date.now(), 0)
    };
  }

  function inferReminderIcon(source) {
    const text = `${source.name || ""} ${source.message || ""}`.toLocaleLowerCase();
    if (/zaslon|oči|oci|vid|eyes?|20[- ]?20[- ]?20/.test(text)) return "eye";
    if (/vod|hidr|kozarec|water|drink|pitje/.test(text)) return "water-glass";
    if (/dih|breath|umir|medit/.test(text)) return "wind";
    if (/sprehod|korak|walk/.test(text)) return "footprints";
    if (/razteg|razgib|raztez|stretch|exercise|gibanj/.test(text)) return "dumbbell";
    if (/kava|coffee|čaj|caj|tea/.test(text)) return "coffee";
    if (/spanje|počitek|pocitek|sleep/.test(text)) return "bed";
    if (/delo|work|sestanek|nalog|focus|fokus/.test(text)) return "briefcase";
    return "bell";
  }

  function normalizeReminder(input = {}, now = Date.now()) {
    const source = input && typeof input === "object" ? input : {};
    const type = VALID_TYPES.has(source.type) ? source.type : "interval";
    const sourceId = typeof source.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(source.id) ? source.id : crypto.randomUUID();
    const channels = getChannelsForMode(source.notificationMode);
    const notificationMode = channels.join("+");
    const reminder = {
      id: sourceId,
      name: String(source.name || "Nov opomnik").trim().slice(0, 120),
      message: String(source.message || "Čas je za opomnik.").trim().slice(0, 500),
      messageMode: source.messageMode === "rotate" ? "rotate" : "custom",
      messageCursor: Math.floor(safeNumber(source.messageCursor, 0, 0, 1000000)),
      icon: typeof source.icon === "string" && source.icon.trim() ? source.icon.trim().slice(0, 50) : inferReminderIcon(source),
      soundName: typeof source.soundName === "string" && source.soundName.trim()
        ? ({ "water-drop": "soft-click", "water-stream": "gentle-switch", "water-ripple": "soft-click", "rain-tap": "gentle-switch" }[source.soundName.trim()] || source.soundName.trim().slice(0, 50))
        : "default",
      type,
      enabled: source.enabled !== false,
      snoozeEnabled: source.snoozeEnabled !== false,
      notificationMode,
      imageData: typeof source.imageData === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(source.imageData) && source.imageData.length <= 420000 ? source.imageData : "",
      actionType: ["none", "breathing", "eyes", "stretches", "url"].includes(source.actionType) ? source.actionType : "none",
      actionUrl: typeof source.actionUrl === "string" ? source.actionUrl.trim().slice(0, 500) : "",
      actionUrls: Array.isArray(source.actionUrls)
        ? source.actionUrls.map(u => String(u || "").trim().slice(0, 500)).filter(Boolean).slice(0, 20)
        : (typeof source.actionUrl === "string" && source.actionUrl.trim() ? [source.actionUrl.trim().slice(0, 500)] : []),
      actionUrlMode: ["iterate", "all"].includes(source.actionUrlMode) ? source.actionUrlMode : "iterate",
      actionUrlLastIndex: safeNumber(source.actionUrlLastIndex, -1, -1, 100),
      stretchGroupIndex: Number.isInteger(source.stretchGroupIndex) ? source.stretchGroupIndex : -1,
      createdAt: safeNumber(source.createdAt, now, 0),
      updatedAt: now
    };
    if (!reminder.name) throw new Error("Vnesite ime opomnika.");

    if (type === "interval") {
      reminder.intervalMinutes = safeNumber(source.intervalMinutes, 20, 1, 10080);
      reminder.lastTriggeredAt = safeNumber(source.lastTriggeredAt, now, 0);
    } else if (type === "once") {
      const when = Date.parse(source.when || "");
      if (!Number.isFinite(when) || (reminder.enabled && when <= now)) throw new Error("Izberite prihodnji datum in čas.");
      reminder.when = new Date(when).toISOString();
    } else if (type === "schedule") {
      reminder.scheduleKind = source.scheduleKind === "weekly" ? "weekly" : "daily";
      reminder.time = /^\d{2}:\d{2}$/.test(source.time || "") ? source.time : "17:00";
      reminder.weekdays = [...new Set((Array.isArray(source.weekdays) ? source.weekdays : []).map(Number).filter(n => n >= 0 && n <= 6))];
      if (reminder.scheduleKind === "weekly" && reminder.weekdays.length === 0) throw new Error("Izberite vsaj en dan.");
    } else {
      reminder.site = normalizeHost(source.site || "");
      if (!validateDomain(reminder.site)) throw new Error("Vnesite veljavno domeno, npr. youtube.com.");
      reminder.afterMinutes = safeNumber(source.afterMinutes, 30, 1, 10080);
      reminder.resetSiteTimerAfterNudge = source.resetSiteTimerAfterNudge !== false;
    }
    return reminder;
  }

  function getReminderMessagePool(reminder = {}) {
    if (reminder.actionType === "eyes" || reminder.icon === "eye") return REMINDER_MESSAGE_POOLS.eyes;
    if (reminder.actionType === "stretches" || reminder.icon === "stretch" || reminder.icon === "dumbbell") return REMINDER_MESSAGE_POOLS.movement;
    if (reminder.actionType === "breathing" || reminder.icon === "wind") return REMINDER_MESSAGE_POOLS.breathing;
    if (reminder.icon === "water-glass" || reminder.icon === "water") return REMINDER_MESSAGE_POOLS.water;
    return REMINDER_MESSAGE_POOLS.general;
  }

  function formatDuration(totalSeconds = 0) {
    const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h) return `${h} h ${m} min`;
    if (m) return `${m} min ${s ? `${s} s` : ""}`.trim();
    return `${s} s`;
  }

  function pruneSiteUsage(usage = {}, maxDays = 14) {
    if (!usage || typeof usage !== "object") return {};
    const dates = Object.keys(usage).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    const limit = Math.max(1, safeNumber(maxDays, 14, 1, 365));
    if (dates.length <= limit) return { ...usage };
    const keep = new Set(dates.slice(dates.length - limit));
    const result = {};
    for (const date of dates) {
      if (keep.has(date)) result[date] = usage[date];
    }
    return result;
  }

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  globalThis.WebNudgeCore = Object.freeze({
    VERSION,
    VALID_TYPES,
    VALID_MODES,
    DEFAULT_SETTINGS,
    clamp,
    safeNumber,
    normalizeHost,
    hostFromUrl,
    isHttpUrl,
    parseTime,
    localDateKey,
    minutesNow,
    isQuietHours,
    quietEnd,
    originPatternsForHost,
    validateDomain,
    getChannelsForMode,
    getRequiredOrigins,
    nextOccurrenceForSchedule,
    nextDueDate,
    formatRemainingDuration,
    normalizeSettings,
    normalizeReminder,
    getReminderMessagePool,
    normalizeBlockRule,
    formatDuration,
    pruneSiteUsage,
    cloneDefaults
  });
})();
