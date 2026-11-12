const $ = id => document.getElementById(id);
const { formatRemainingDuration } = WebNudgeCore;
const STANDALONE_SETTINGS_KEY = "vmes-options-preview-settings";
const PUBLIC_SITE_URL = "https://mihaknific.github.io/Vmes-opomniki-za-odmore-in-spletni-fokus/";

function getStandaloneSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STANDALONE_SETTINGS_KEY) || "{}");
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  } catch (error) {
    console.error("Could not read standalone Vmes settings:", error);
    return {};
  }
}

function updateReminderSoundSummary() {
  const summary = $("reminder-sound-summary");
  const select = $("reminder-sound");
  if (summary && select) summary.textContent = select.selectedOptions[0]?.textContent || "Privzeti zvok";
}

const state = async () => {
  if (typeof browser !== "undefined" && browser.runtime?.sendMessage) {
    const res = await browser.runtime.sendMessage({ type: "GET_STATE" });
    if (!res || !Array.isArray(res.reminders)) throw new Error("Podatkov dodatka ni bilo mogoče naložiti.");
    return res;
  }
  // Standalone fallback za neposreden ogled v brskalniku (file://)
  return {
    settings: {
      theme: "forest",
      fontFamily: "system",
      fontSize: "standard",
      notificationMode: "system",
      notificationDuration: 8,
      defaultSnooze: 5,
      sound: true,
      soundName: "soft-click",
      soundVolume: 0.55,
      siteTrackingEnabled: false,
      ...getStandaloneSettings()
    },
    reminders: [
      { id: "demo-1", name: "Kozarec vode", type: "interval", intervalMinutes: 5, enabled: true, message: "Vzemite nekaj požirkov vode, če vam ustreza.", notificationMode: "system", icon: "water-glass", actionType: "none", soundName: "soft-click", lastTriggeredAt: Date.now() - 2500000 },
      { id: "demo-2", name: "Odmor za oči", type: "interval", intervalMinutes: 10, enabled: true, message: "Poglejte za 20 sekund v daljavo in sprostite pogled.", notificationMode: "system", icon: "eye", actionType: "url", actionUrl: `${PUBLIC_SITE_URL}oci/`, actionOpenTiming: "click", soundName: "gentle-bell", lastTriggeredAt: Date.now() - 300000 },
      { id: "demo-3", name: "Kratek razteg", type: "interval", intervalMinutes: 20, enabled: true, message: "Vstanite, nežno raztegnite telo in sprostite ramena.", notificationMode: "system", icon: "stretch", actionType: "url", actionUrl: `${PUBLIC_SITE_URL}gibanje/`, actionOpenTiming: "click", soundName: "gentle-switch", lastTriggeredAt: Date.now() - 1200000 },
      { id: "demo-4", name: "Dihalni premor", type: "interval", intervalMinutes: 45, enabled: true, message: "Ustavite se za trenutek in nekajkrat mirno vdihnite.", notificationMode: "system", icon: "wind", actionType: "url", actionUrl: `${PUBLIC_SITE_URL}dihanje/`, actionOpenTiming: "click", soundName: "soft-click", lastTriggeredAt: Date.now() - 2700000 }
    ],
    history: [
      { id: "h-1", name: "Pogled stran od zaslona", status: "completed", timestamp: Date.now() - 1800000, channel: "system" },
      { id: "h-2", name: "Kozarec vode", status: "snoozed", timestamp: Date.now() - 3600000, channel: "window" },
      { id: "h-3", name: "Razgibavanje", status: "dismissed", timestamp: Date.now() - 7200000, channel: "inpage" }
    ]
  };
};

async function requestOrigins(origins) {
  const unique = [...new Set((origins || []).filter(Boolean))];
  if (!unique.length) return true;
  try { return await browser.permissions.request({ origins: unique }); } catch { return false; }
}

async function ensureReminderPermissions(reminder) {
  const origins = WebNudgeCore.getRequiredOrigins(reminder);
  if (!origins || !origins.length) return { ok: true, granted: true };
  try {
    const granted = await browser.permissions.request({ origins });
    return { ok: Boolean(granted), granted: Boolean(granted) };
  } catch (error) {
    return { ok: false, granted: false, error };
  }
}

function localDateTimeValue(iso) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const STATUS_LABELS = {
  shown: "Prikazano",
  completed: "Zaključeno",
  snoozed: "Odloženo",
  dismissed: "Zaprtje",
  timeout: "Poteklo",
  "quiet-hours": "Ne moti",
  unavailable: "Kanal ni na voljo",
  test: "Preizkus"
};

function esc(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

const { formatDuration, normalizeHost } = WebNudgeCore;
let appearanceSettings = {};
const CUSTOM_COLOR_FIELDS = {
  background: "custom-color-background",
  surface: "custom-color-surface",
  accent: "custom-color-accent",
  text: "custom-color-text",
  muted: "custom-color-muted",
  border: "custom-color-border"
};

function readAppearanceColors() {
  const styles = getComputedStyle(document.body);
  const hexFromColor = value => {
    const hex = value.match(/^#([0-9a-f]{6})$/i);
    if (hex) return `#${hex[1]}`;
    const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!rgb) return null;
    return `#${rgb.slice(1, 4).map(channel => Number(channel).toString(16).padStart(2, "0")).join("")}`;
  };
  const properties = { background: "--bg", surface: "--surface", accent: "--accent", text: "--text", muted: "--muted", border: "--border" };
  return Object.fromEntries(Object.entries(properties).map(([key, property]) => [
    key,
    hexFromColor(styles.getPropertyValue(property).trim()) || "#000000"
  ]));
}

function syncCustomThemeControls(settings) {
  const isCustom = settings.theme === "custom";
  const colors = isCustom && settings.customColors ? settings.customColors : readAppearanceColors();
  for (const [key, id] of Object.entries(CUSTOM_COLOR_FIELDS)) {
    const input = $(id);
    if (input && /^#[0-9a-f]{6}$/i.test(colors[key] || "")) input.value = colors[key];
  }
  const status = $("custom-theme-state");
  if (status) {
    status.textContent = isCustom ? "Po meri aktivno" : "Po meri ni aktivno";
    status.dataset.active = String(isCustom);
  }
  const reset = $("reset-custom-colors");
  if (reset) reset.disabled = !isCustom;
}

function applyAppearance(settings = {}) {
  appearanceSettings = settings;
  WebNudgeAppearance.apply(settings);
  updateThemeCards(settings.theme || "forest");
  syncCustomThemeControls(settings);
}

const REMINDER_PRESETS = {
  eyes: { name: "Odmor za oči", message: "Za nekaj trenutkov poglejte v daljavo in sprostite oči.", messageMode: "rotate", interval: 10, icon: "eye", actionType: "url", actionUrl: `${PUBLIC_SITE_URL}oci/`, soundName: "gentle-bell" },
  water: { name: "Kozarec vode", message: "Čas za nekaj požirkov vode, če vam ustreza.", messageMode: "rotate", interval: 5, icon: "water-glass", actionType: "none", soundName: "soft-click" },
  movement: { name: "Kratek razteg", message: "Vstanite, sprostite ramena in se nežno raztegnite.", messageMode: "rotate", interval: 20, icon: "stretch", actionType: "url", actionUrl: `${PUBLIC_SITE_URL}gibanje/`, soundName: "gentle-switch" },
  breathing: { name: "Dihalni premor", message: "Ustavite se za trenutek in nekajkrat mirno vdihnite.", messageMode: "rotate", interval: 45, icon: "wind", actionType: "url", actionUrl: `${PUBLIC_SITE_URL}dihanje/`, soundName: "soft-click" },
  custom: { name: "Moj opomnik", message: "Čas je za opomnik.", messageMode: "custom", interval: 30, icon: "bell", actionType: "none", soundName: "default" }
};

function updateMessageModeUi() {
  const isRotating = $("message-mode")?.value === "rotate";
  $("custom-message-field")?.classList.toggle("hidden", isRotating);
  const rotationHelp = $("rotating-message-help");
  if (rotationHelp) {
    rotationHelp.classList.toggle("hidden", !isRotating);
    if (isRotating) {
      const pool = WebNudgeCore.getReminderMessagePool({
        icon: $("reminder-icon")?.value || "bell",
        actionType: $("action-type")?.value || "none"
      });
      rotationHelp.textContent = `Ob vsakem prikazu se izmenjujejo: ${pool.map(message => `„${message}“`).join(" · ")}`;
    }
  }
}

let modalReturnFocus = null;
let modalConfirmHandler = null;
let modalCancelHandler = null;

function closeModal(confirmed) {
  const modal = $("global-modal");
  if (!modal?.classList.contains("visible")) return;
  modal.classList.remove("visible");
  modal.setAttribute("aria-hidden", "true");
  const handler = confirmed ? modalConfirmHandler : modalCancelHandler;
  modalConfirmHandler = null;
  modalCancelHandler = null;
  try {
    if (typeof handler === "function") handler();
  } finally {
    if (modalReturnFocus?.isConnected) modalReturnFocus.focus();
    modalReturnFocus = null;
  }
}

function showModal(title, message, { confirmText = "V redu", cancelText = null, onConfirm = null, onCancel = null } = {}) {
  const modal = document.getElementById("global-modal");
  if (!modal) return;
  const titleEl = document.getElementById("modal-title");
  const messageEl = document.getElementById("modal-message");
  const confirmBtn = document.getElementById("modal-confirm");
  const cancelBtn = document.getElementById("modal-cancel");
  if (!modal.classList.contains("visible")) modalReturnFocus = document.activeElement;
  modalConfirmHandler = onConfirm;
  modalCancelHandler = onCancel;
  titleEl.textContent = title;
  messageEl.textContent = message;
  confirmBtn.textContent = confirmText;
  confirmBtn.onclick = () => closeModal(true);
  if (cancelText) {
    cancelBtn.textContent = cancelText;
    cancelBtn.classList.remove("hidden");
    cancelBtn.onclick = () => closeModal(false);
  } else {
    cancelBtn.classList.add("hidden");
    cancelBtn.onclick = null;
  }
  modal.classList.add("visible");
  modal.setAttribute("aria-hidden", "false");
  (cancelText ? cancelBtn : confirmBtn).focus();
}

function showInfoMessage(title, message) {
  showModal(title, message, { confirmText: "V redu" });
}

function askConfirm(title, message, onConfirm, onCancel) {
  showModal(title, message, { confirmText: "Potrdi", cancelText: "Prekliči", onConfirm, onCancel });
}

function askConfirmAsync(title, message, { confirmText = "Potrdi", cancelText = "Prekliči" } = {}) {
  return new Promise(resolve => {
    showModal(title, message, {
      confirmText,
      cancelText,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });
}

let toastTimer = null;
function showToast(message, duration = 3200) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, duration);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("sl-SI", { dateStyle: "short", timeStyle: "short" });
}

function formatClockTime(timestamp) {
  const d = new Date(timestamp);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("sl-SI", { hour: "2-digit", minute: "2-digit" });
}

function formatRemainingTime(ms) {
  return formatRemainingDuration(ms);
}

function computeCountdownText(r, now = Date.now()) {
  if (!r.enabled) return "Opomnik je izklopljen";
  if (r.type === "site") {
    return `ob obisku ${r.site || "strani"} (${r.afterMinutes || 30} min)`;
  }
  if (r.type === "once") {
    const due = Date.parse(r.when || "");
    if (!Number.isFinite(due)) return "Čas ni določen";
    const diff = due - now;
    if (diff <= 0) return "Čas je že potekel";
    return `čez ${formatRemainingTime(diff)}`;
  }
  if (r.type === "interval") {
    const due = nextForReminder(r, now);
    if (!due) return "—";
    const diff = due - now;
    if (diff <= 0) return "Sprožitev zdaj";
    return `čez ${formatRemainingTime(diff)}`;
  }
  if (r.type === "schedule") {
    const due = nextForReminder(r, now);
    if (!due) return "—";
    const diff = due - now;
    if (diff <= 0) return "Sprožitev zdaj";
    const dueDay = new Date(due).toDateString();
    const today = new Date(now).toDateString();
    const tmrw = new Date(now + 86400000).toDateString();
    let dayPrefix = "";
    if (dueDay === today) dayPrefix = "danes ";
    else if (dueDay === tmrw) dayPrefix = "jutri ";
    else dayPrefix = `${new Date(due).toLocaleDateString("sl-SI", { weekday: "short" })} `;
    return `${dayPrefix}ob ${formatClockTime(due)}`;
  }
  return "—";
}

let liveTimerInterval = null;
let liveTimerReminders = [];
function updateLiveTimers() {
  const now = Date.now();
  const map = new Map(liveTimerReminders.map(r => [r.id, r]));
  document.querySelectorAll(".live-countdown").forEach(el => {
    const r = map.get(el.dataset.id);
    if (!r) return;
    el.textContent = computeCountdownText(r, now);
    el.className = `timing-val ${r.enabled ? "countdown-active" : "countdown-idle"} live-countdown`;
  });
}

function startLiveTimer(remindersList = liveTimerReminders) {
  liveTimerReminders = remindersList;
  if (liveTimerInterval) clearInterval(liveTimerInterval);
  liveTimerInterval = null;
  if (document.visibilityState === "hidden") return;
  updateLiveTimers();
  liveTimerInterval = setInterval(updateLiveTimers, 1000);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    if (liveTimerInterval) clearInterval(liveTimerInterval);
    liveTimerInterval = null;
  } else {
    startLiveTimer();
  }
});
window.addEventListener("pagehide", () => {
  if (liveTimerInterval) clearInterval(liveTimerInterval);
  liveTimerInterval = null;
});
window.addEventListener("pageshow", () => startLiveTimer());

function reminderLabel(r) {
  if (r.type === "interval") return `vsakih ${r.intervalMinutes} min`;
  if (r.type === "once") return `enkrat · ${formatDate(r.when)}`;
  if (r.type === "site") return `${r.site} · po ${r.afterMinutes} min aktivne seje`;
  if (r.scheduleKind === "weekly") {
    const days = (r.weekdays || []).map(Number).sort((a, b) => ((a === 0 ? 7 : a) - (b === 0 ? 7 : b))).map(n => ["Ned", "Pon", "Tor", "Sre", "Čet", "Pet", "Sob"][n]).join(", ");
    return `${r.time} · ${days || "izbrani dnevi"}`;
  }
  return `vsak dan · ${r.time || "17:00"}`;
}

function nextForReminder(r, now = Date.now()) { return WebNudgeCore.nextDueDate(r, now); }

async function duplicateReminder(r) {
  const rightNow = Date.now();
  const copy = { ...r, id: crypto.randomUUID(), name: `${r.name} (kopija)`, createdAt: rightNow, updatedAt: rightNow };
  if (r.type === "interval") {
    copy.lastTriggeredAt = rightNow;
    delete copy.intervalPhaseMinutes;
  }
  if (r.type === "once") copy.when = new Date(Math.max(rightNow + 5 * 60_000, Date.parse(r.when || "") || 0)).toISOString();
  const permResult = await ensureReminderPermissions(copy);
  if (!permResult.ok) {
    showInfoMessage("Dovoljenja niso odobrena", "Dovoljenja niso bila odobrena. Opomnik ni bil podvojen.");
    return;
  }
  const response = await browser.runtime.sendMessage({ type: "SAVE_REMINDER", reminder: copy });
  if (!response?.ok) {
    showInfoMessage("Napaka", response?.error || "Opomnika ni bilo mogoče podvojiti.");
    return;
  }
  showToast(`Opomnik »${copy.name}« je bil ustvarjen.`);
  location.hash = "reminders";
  renderReminders();
}

function deleteReminder(r) {
  askConfirm("Izbriši opomnik", `Res želite izbrisati opomnik »${r.name}«?`, async () => {
    const response = await browser.runtime.sendMessage({ type: "DELETE_REMINDER", id: r.id });
    if (!response?.ok) {
      showInfoMessage("Napaka", response?.error || "Opomnika ni bilo mogoče izbrisati.");
      return;
    }
    showToast(`Opomnik »${r.name}« je bil izbrisan.`);
    location.hash = "reminders";
    renderReminders();
  });
}

function createReminderCard(r, now) {
  const article = document.createElement("article");
  article.className = `reminder-card ${r.enabled ? "" : "disabled"}`;
  article.dataset.id = r.id;
  article.setAttribute("role", "row");

  const headerRow = document.createElement("div");
  headerRow.className = "card-header-row";
  headerRow.setAttribute("role", "cell");

  const toggleLabel = document.createElement("label");
  toggleLabel.className = "toggle-switch";
  toggleLabel.title = r.enabled ? "Kliknite za izklop" : "Kliknite za vklop";

  const toggleInput = document.createElement("input");
  toggleInput.type = "checkbox";
  toggleInput.className = "card-toggle";
  toggleInput.checked = Boolean(r.enabled);
  toggleInput.setAttribute("aria-label", `${r.enabled ? "Izklopi" : "Vklopi"} opomnik ${r.name}`);
  toggleInput.addEventListener("change", async () => {
    const nextEnabled = toggleInput.checked;
    const res = await browser.runtime.sendMessage({ type: "SET_REMINDER_ENABLED", id: r.id, enabled: nextEnabled });
    if (res?.ok === false) {
      toggleInput.checked = !nextEnabled;
      showInfoMessage("Ni mogoče spremeniti stanja", res.error || "Opomnika ni bilo mogoče vključiti.");
    } else {
      showToast(nextEnabled ? `Opomnik »${r.name}« je vklopljen.` : `Opomnik »${r.name}« je izklopljen.`);
    }
    renderReminders();
  });

  const slider = document.createElement("span");
  slider.className = "switch-slider";
  toggleLabel.append(toggleInput, slider);

  const mainInfo = document.createElement("div");
  mainInfo.className = "card-main-info";
  mainInfo.setAttribute("role", "cell");

  const titleRow = document.createElement("div");
  titleRow.className = "card-title-row";

  const cardTitle = document.createElement("h2");
  cardTitle.textContent = r.name;
  titleRow.appendChild(cardTitle);
  headerRow.appendChild(titleRow);

  const schedText = document.createElement("span");
  schedText.className = "card-schedule-text";
  schedText.textContent = reminderLabel(r);
  const scheduleLabel = document.createElement("span");
  scheduleLabel.className = "card-schedule-label";
  scheduleLabel.textContent = "Urnik";
  mainInfo.append(scheduleLabel, schedText);

  const timingStrip = document.createElement("div");
  timingStrip.className = "timing-strip";
  timingStrip.setAttribute("role", "cell");
  const cellNext = document.createElement("div");
  cellNext.className = "timing-cell";
  const lblNext = document.createElement("span");
  lblNext.className = "timing-label";
  lblNext.textContent = "Naslednji opomnik";
  const valNext = document.createElement("span");
  valNext.className = `timing-val ${r.enabled ? "countdown-active" : "countdown-idle"} live-countdown`;
  valNext.dataset.id = r.id;
  valNext.textContent = computeCountdownText(r, now);
  cellNext.append(lblNext, valNext);
  timingStrip.appendChild(cellNext);

  const actionsRow = document.createElement("div");
  actionsRow.className = "card-actions-row";
  actionsRow.setAttribute("role", "cell");
  const actionsBtns = document.createElement("div");
  actionsBtns.className = "card-actions-buttons";
  actionsBtns.appendChild(toggleLabel);

  const btnEdit = document.createElement("button");
  btnEdit.className = "btn-action edit";
  btnEdit.type = "button";
  btnEdit.title = "Uredi nastavitve opomnika";
  btnEdit.textContent = "Uredi";
  btnEdit.addEventListener("click", () => startEdit(r));

  actionsBtns.appendChild(btnEdit);
  actionsRow.appendChild(actionsBtns);

  article.append(headerRow, mainInfo, timingStrip, actionsRow);
  return article;
}

async function renderReminders() {
  const s = await state();
  const box = $("all-reminders");
  const tableHead = $("reminders-table-head");
  const allReminders = s.reminders || [];

  const totalCount = allReminders.length;
  const enabledCount = allReminders.filter(r => r.enabled).length;
  const summary = $("reminder-summary");
  const disabledCount = totalCount - enabledCount;
  if (summary) summary.textContent = `Opomniki: ${totalCount} · Aktivni: ${enabledCount} · Izklopljeni: ${disabledCount}`;
  $("stat-all-count").textContent = totalCount;
  $("stat-enabled-count").textContent = enabledCount;
  $("stat-disabled-count").textContent = disabledCount;

  const search = ($("reminder-search")?.value || "").trim().toLowerCase();
  const filter = $("reminder-filter")?.value || "all";
  document.querySelectorAll("#filter-pills [data-filter]").forEach(button => {
    const selected = button.dataset.filter === filter;
    button.setAttribute("aria-pressed", String(selected));
    button.classList.toggle("pill-selected", selected);
  });

  const reminders = allReminders.filter(r => {
    const matchesSearch = !search || [r.name, r.message, r.site].filter(Boolean).some(v => String(v).toLowerCase().includes(search));
    const matchesFilter = filter === "all" || (filter === "enabled" && r.enabled) || (filter === "disabled" && !r.enabled) || (filter === "site" && r.type === "site");
    return matchesSearch && matchesFilter;
  });

  box.replaceChildren();
  if (tableHead) tableHead.hidden = reminders.length === 0;

  if (!reminders.length) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "empty-state";
    emptyDiv.setAttribute("role", "note");
    const strong = document.createElement("strong");
    strong.textContent = allReminders.length ? "Ni opomnikov za izbrane filtre." : "Še nimate opomnikov.";
    const span = document.createElement("span");
    span.textContent = allReminders.length
      ? "Spremenite iskanje ali izberite drug filter."
      : "Ustvarite prvi opomnik in ga prilagodite svojemu načinu dela.";
    emptyDiv.append(strong, span);
    if (allReminders.length) {
      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "secondary";
      clearButton.textContent = "Počisti iskanje in filtre";
      clearButton.addEventListener("click", () => {
        $("reminder-search").value = "";
        $("reminder-filter").value = "all";
        renderReminders();
        $("reminder-search").focus();
      });
      emptyDiv.appendChild(clearButton);
    } else {
      const createButton = document.createElement("button");
      createButton.type = "button";
      createButton.className = "primary";
      createButton.textContent = "Ustvari prvi opomnik";
      createButton.addEventListener("click", () => { location.hash = "reminder/new"; });
      emptyDiv.appendChild(createButton);
    }
    box.appendChild(emptyDiv);
    if (liveTimerInterval) clearInterval(liveTimerInterval);
    return;
  }

  const now = Date.now();
  reminders.forEach(r => {
    box.appendChild(createReminderCard(r, now));
  });

  startLiveTimer(allReminders);
}

let wizardStep = 1;
function setWizardStep(step) {
  wizardStep = Math.min(3, Math.max(1, step));
  document.querySelectorAll(".wizard-panel").forEach(p => p.classList.toggle("hidden", Number(p.dataset.panel) !== wizardStep));
  document.querySelectorAll(".wizard-step").forEach(b => b.classList.toggle("active", Number(b.dataset.step) === wizardStep));
  if (wizardStep === 1) $("name").focus();
}

document.querySelectorAll(".wizard-step").forEach(button => button.addEventListener("click", () => setWizardStep(Number(button.dataset.step))));

function toggleType() {
  const type = $("type").value;
  const isOnce = type === "once";
  const isSite = type === "site";
  const isSchedule = type === "schedule";
  
  // Sync Vertikalnih kartic
  document.querySelectorAll(".vertical-trigger-card").forEach(card => {
    const isSelected = card.dataset.typeVal === type;
    card.classList.toggle("active", isSelected);
    const radio = card.querySelector(".trigger-type-choice");
    if (radio) radio.checked = isSelected;
  });

  // Skrij ali prikaži posebne pod-elemente urnika
  $("weekdays-field")?.classList.toggle("hidden", !(isSchedule && $("schedule-kind")?.value === "weekly"));
  
  updateReminderSummaryPreview();
}

document.querySelectorAll(".vertical-trigger-card").forEach(card => {
  card.addEventListener("click", e => {
    // Če klikne neposredno v input/select znotraj telesa, ne preprečujemo fokusa
    if (e.target.closest("input, select, textarea, button.interval-chip")) return;
    const val = card.dataset.typeVal;
    if (val && $("type")) {
      $("type").value = val;
      toggleType();
    }
  });
});
document.querySelectorAll(".trigger-type-choice").forEach(radio => {
  radio.addEventListener("change", () => {
    if (radio.checked && $("type")) {
      $("type").value = radio.value;
      toggleType();
    }
  });
});

function updateReminderSummaryPreview() {
  const type = $("type")?.value || "interval";
  const sumType = $("sum-type");
  if (sumType) {
    if (type === "interval") {
      const min = $("interval")?.value || 20;
      sumType.textContent = `Interval: vsakih ${min} minut`;
    } else if (type === "once") {
      const when = $("when")?.value;
      sumType.textContent = when ? `Enkratno: ${when.replace("T", " ob ")}` : "Enkratno: točen datum in ura";
    } else if (type === "site") {
      const domain = $("site")?.value.trim() || "spletna stran";
      const after = $("after")?.value || 30;
      sumType.textContent = `Spletna stran: ${domain} (po ${after} min)`;
    } else if (type === "schedule") {
      const time = $("schedule-time")?.value || "17:00";
      const kind = $("schedule-kind")?.value === "weekly" ? "izbrani dnevi" : "vsak dan";
      sumType.textContent = `Urnik: ${kind} ob ${time}`;
    }
  }

  const sumChannels = $("sum-channels");
  if (sumChannels) {
    const channels = getFormChannels();
    const map = { system: "Sistemsko", window: "Ločeno okno", inpage: "Na strani" };
    sumChannels.textContent = channels.length ? channels.map(c => map[c] || c).join(" + ") : "Ni izbranega kanala";
  }

  const sumSound = $("sum-sound");
  if (sumSound) {
    const sound = $("reminder-sound")?.value || "default";
    const soundNames = {
      default: "Privzeti zvok",
      "soft-click": "Mehak zvočni poudarek",
      "clear-click": "Jasen zvočni poudarek",
      "gentle-switch": "Mehak dvojni signal",
      chime: "Kristalni zvonec",
      "gentle-bell": "Nežen ton",
      marimba: "Marimba akord",
      celesta: "Svetleči zvončki",
      relax: "Zen gong",
      "tibetan-bowl": "Tibetanska posoda",
      digital: "Digitalni ping",
      "soft-synth": "Sodoben sintetični ton",
      none: "Brez zvoka (tiho)"
    };
    sumSound.textContent = soundNames[sound] || sound;
  }

  const sumSnooze = $("sum-snooze");
  if (sumSnooze) {
    const enabled = $("snooze")?.checked ?? true;
    sumSnooze.textContent = enabled ? "Omogočen (odlog opomnika)" : "Izklopljen";
  }

  const sumAction = $("sum-action");
  if (sumAction) {
    const actType = $("action-type")?.value || "none";
    const actLabels = {
      none: "Brez odpiranja",
      breathing: "Dihalna vaja",
      eyes: "Vaja za oči (20–20–20)",
      stretches: "Vaje med sedenjem",
      url: "Spletna povezava"
    };
    sumAction.textContent = actLabels[actType] || actType;
    const actionSummary = $("action-details-summary");
    if (actionSummary) actionSummary.textContent = `Dejanje: ${actLabels[actType] || actType}`;
  }

  const sumVisuals = $("sum-visuals");
  if (sumVisuals) {
    const iconKey = $("reminder-icon")?.value || "bell";
    const hasImage = Boolean($("image-preview")?.querySelector("img"));
    const iconName = typeof WebNudgeIcons !== "undefined" ? (WebNudgeIcons.getIconInfo(iconKey)?.name || iconKey) : iconKey;
    sumVisuals.textContent = `${iconName} ${hasImage ? "(s sliko)" : "(brez slike)"}`;
  }
}

function setFormChannels(channels = ["system"]) {
  const set = new Set(WebNudgeCore.getChannelsForMode(channels));
  document.querySelectorAll('input[name="channel"]').forEach(cb => {
    cb.checked = set.has(cb.value);
  });
  updatePermissionHint();
}

function getFormChannels() {
  return [...document.querySelectorAll('input[name="channel"]:checked')].map(cb => cb.value);
}

function updatePermissionHint() {
  const inpageChecked = document.querySelector('input[name="channel"][value="inpage"]')?.checked;
  const hint = $("permission-hint");
  if (hint) hint.classList.toggle("hidden", !inpageChecked);
}

function updateIntervalReadable(minutes) {
  const el = $("interval-readable");
  if (!el) return;
  const mins = Number(minutes) || 0;
  if (mins <= 0) {
    el.textContent = "Vnesite veljavno število minut";
    return;
  }
  if (mins < 60) {
    const times = (60 / mins);
    const timesStr = Number.isInteger(times) ? `${times}×` : `~${times.toFixed(1)}×`;
    el.textContent = `Sproži se vsakih ${mins} minut (${timesStr} na uro)`;
  } else if (mins === 60) {
    el.textContent = "Sproži se vsako uro (1× na uro)";
  } else {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const hStr = h === 1 ? "1 uro" : h === 2 ? "2 uri" : (h === 3 || h === 4) ? `${h} ure` : `${h} ur`;
    const mStr = m > 0 ? ` ${m} min` : "";
    el.textContent = `Sproži se vsakih ${mins} minut (${hStr}${mStr})`;
  }

  document.querySelectorAll(".interval-chip").forEach(chip => {
    chip.classList.toggle("active", Number(chip.dataset.min) === mins);
  });
}

function renderIconSelector() {
  const container = $("icon-selector-grid");
  const recommended = $("recommended-icon-choices");
  if ((!container && !recommended) || typeof WebNudgeIcons === "undefined") return;
  const currentKey = $("reminder-icon")?.value || "bell";
  const icons = WebNudgeIcons.getAllIcons();
  const iconByKey = new Map(icons.map(icon => [icon.key, icon]));
  if (recommended) {
    recommended.replaceChildren();
    ["eye", "stretch", "water-glass"].forEach(key => {
      const icon = iconByKey.get(key);
      if (icon) recommended.append(createIconChoice(icon, currentKey, true));
    });
  }
  if (container) {
    container.replaceChildren();
    icons.forEach(icon => container.append(createIconChoice(icon, currentKey)));
  }
  updateIconSelectedLabel(currentKey);
}

function createIconChoice(icon, selectedKey, showName = false) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `icon-choice-btn ${showName ? "icon-choice-featured" : ""} ${icon.key === selectedKey ? "active" : ""}`.trim();
    btn.dataset.iconKey = icon.key;
    btn.title = `${icon.name} (${icon.category})`;
    btn.setAttribute("aria-pressed", String(icon.key === selectedKey));
    btn.setAttribute("aria-label", `Izberi ikono: ${icon.name}`);
    btn.innerHTML = showName
      ? `<span class="icon-choice-art" aria-hidden="true">${icon.svg}</span><span>${esc(icon.name)}</span>`
      : icon.svg;
    btn.addEventListener("click", () => {
      selectIcon(icon.key);
    });
    return btn;
}

function selectIcon(key = "bell") {
  const hidden = $("reminder-icon");
  if (hidden) hidden.value = key;
  document.querySelectorAll(".icon-choice-btn").forEach(btn => {
    const selected = btn.dataset.iconKey === key;
    btn.classList.toggle("active", selected);
    btn.setAttribute("aria-pressed", String(selected));
  });
  const library = document.querySelector(".icon-library");
  if (library) library.open = !["eye", "stretch", "water-glass"].includes(key);
  updateIconSelectedLabel(key);
  updateMessageModeUi();
}

function updateIconSelectedLabel(key = "bell") {
  const label = $("icon-selected-label");
  if (!label || typeof WebNudgeIcons === "undefined") return;
  const info = WebNudgeIcons.getIconInfo(key);
  label.innerHTML = `Izbrana ikona: <strong>${esc(info.name)}</strong> · <small style="color:var(--muted)">${esc(info.category)}</small>`;
}

function clearForm() {
  $("reminder-form").reset();
  $("reminder-form").dataset.editId = "";
  $("reminder-form").dataset.messageCursor = "0";
  const editorActions = $("editor-more-actions");
  if (editorActions) {
    editorActions.classList.add("hidden");
  }
  const heading = $("form-heading");
  if (heading) heading.textContent = "Ustvari nov opomnik";
  const eyebrow = $("form-eyebrow");
  if (eyebrow) eyebrow.textContent = "NOV OPOMNIK";
  const subheading = $("form-subheading");
  if (subheading) subheading.textContent = "Vse nastavitve za ta opomnik na enem mestu.";
  const breadcrumb = $("breadcrumb-current");
  if (breadcrumb) breadcrumb.textContent = "Nov opomnik";
  const presets = $("presets-container");
  if (presets) presets.classList.remove("hidden");
  const submitBtn = $("form-submit");
  if (submitBtn) submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><polyline points="20 6 9 17 4 12"/></svg> Shrani opomnik`;
  $("name").value = "Odmor za oči";
  $("message").value = "Poglejte za 20 sekund v daljavo in sprostite pogled.";
  $("message-mode").value = "custom";
  updateMessageModeUi();
  selectIcon("eye");
  document.querySelectorAll("#reminder-form details").forEach(details => { details.open = false; });
  $("reminder-image").value = "";
  setImagePreview("");
  $("interval").value = 20;
  updateIntervalReadable(20);
  $("after").value = 30;
  $("schedule-kind").value = "daily";
  $("schedule-time").value = "17:00";
  $("reset-site-timer").checked = true;
  $("snooze").checked = true;
  $("type").value = "interval";
  if ($("action-type")) $("action-type").value = "eyes";
  if ($("action-open-timing")) $("action-open-timing").value = "click";
  if ($("action-urls")) $("action-urls").value = "";
  if ($("action-url-mode")) $("action-url-mode").value = "iterate";
  updateActionUi();
  if ($("reminder-sound")) $("reminder-sound").value = "default";
  updateReminderSoundSummary();
  setFormChannels(["system"]);
  [...$("weekdays").options].forEach(o => { o.selected = false; });
  syncWeekdayChipsFromSelect();
  toggleType();
}

function applyPreset(name) {
  const preset = REMINDER_PRESETS[name];
  if (!preset) return;
  clearForm();
  $("name").value = preset.name;
  $("message").value = preset.message;
  $("message-mode").value = preset.messageMode;
  updateMessageModeUi();
  $("interval").value = preset.interval;
  updateIntervalReadable(preset.interval);
  if (preset.icon) selectIcon(preset.icon);
  if ($("reminder-sound")) $("reminder-sound").value = preset.soundName || "default";
  updateReminderSoundSummary();
  if (preset.actionType && $("action-type")) {
    $("action-type").value = preset.actionType;
    if ($("action-urls")) $("action-urls").value = preset.actionUrl || "";
    if ($("action-open-timing")) $("action-open-timing").value = "click";
    updateActionUi();
  }
  updateMessageModeUi();
  updateReminderSummaryPreview();
  if (name === "custom") $("name").focus();
}

function setImagePreview(data = "") {
  const preview = $("image-preview");
  if (!preview) return;
  preview.replaceChildren();
  if (data) {
    const img = document.createElement("img");
    img.src = data;
    img.alt = "Predogled izbrane slike";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "image-remove";
    btn.textContent = "Odstrani sliko";
    btn.addEventListener("click", () => {
      const fileInput = $("reminder-image");
      if (fileInput) fileInput.value = "";
      setImagePreview("");
    });
    preview.append(img, btn);
  }
  preview.classList.toggle("hidden", !data);
}

document.querySelectorAll("[data-preset]").forEach(button => button.addEventListener("click", () => applyPreset(button.dataset.preset)));

function handleFileSelection(file) {
  const fileInput = $("reminder-image");
  if (!file) return;
  if (!file.type.startsWith("image/") || file.size > 300 * 1024) {
    if (fileInput) fileInput.value = "";
    showInfoMessage("Slika ni primerna", "Izberite PNG, JPG, WebP ali GIF do velikosti 300 KB.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || "");
    if (!/^data:image\/(png|jpeg|webp|gif);base64,/i.test(result) || result.length > 420000) {
      if (fileInput) fileInput.value = "";
      showInfoMessage("Slike ni bilo mogoče uporabiti", "Izberite veljavno sliko PNG, JPG, WebP ali GIF do velikosti 300 KB.");
      return;
    }
    setImagePreview(result);
  };
  reader.readAsDataURL(file);
}

const dropzone = $("image-dropzone");
const reminderFileInput = $("reminder-image");
if (dropzone && reminderFileInput) {
  dropzone.addEventListener("click", event => {
    if (event.target !== reminderFileInput) reminderFileInput.click();
  });
  dropzone.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      reminderFileInput.click();
    }
  });
  dropzone.addEventListener("dragover", e => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", e => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("dragover");
  });
  dropzone.addEventListener("drop", e => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file) handleFileSelection(file);
  });
  reminderFileInput.addEventListener("change", e => {
    const file = e.target.files?.[0];
    if (file) handleFileSelection(file);
  });
}

document.querySelectorAll(".interval-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const min = Number(chip.dataset.min);
    $("interval").value = min;
    updateIntervalReadable(min);
  });
});
$("interval")?.addEventListener("input", e => {
  updateIntervalReadable(e.target.value);
});

function fillForm(r) {
  $("reminder-form").dataset.editId = r.id;
  $("reminder-form").dataset.messageCursor = String(r.messageCursor || 0);
  const editorActions = $("editor-more-actions");
  if (editorActions) editorActions.classList.remove("hidden");
  const heading = $("form-heading");
  if (heading) heading.textContent = `Uredi opomnik: ${r.name || ""}`;
  const eyebrow = $("form-eyebrow");
  if (eyebrow) eyebrow.textContent = "UREJANJE OPOMNIKA";
  const subheading = $("form-subheading");
  if (subheading) subheading.textContent = "Spremenite nastavitve, čas ali način obveščanja.";
  const breadcrumb = $("breadcrumb-current");
  if (breadcrumb) breadcrumb.textContent = `Uredi: ${r.name || "Opomnik"}`;
  const presets = $("presets-container");
  if (presets) presets.classList.add("hidden");
  const submitBtn = $("form-submit");
  if (submitBtn) submitBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><polyline points="20 6 9 17 4 12"/></svg> Shrani spremembe`;
  document.querySelectorAll("#reminder-form details").forEach(details => { details.open = false; });
  if ($("name")) $("name").value = r.name || "";
  if ($("message")) $("message").value = r.message || "";
  if ($("message-mode")) $("message-mode").value = r.messageMode === "rotate" ? "rotate" : "custom";
  updateMessageModeUi();
  selectIcon(r.icon || "bell");
  if ($("type")) $("type").value = r.type || "interval";
  const intervalVal = r.intervalMinutes || 20;
  if ($("interval")) $("interval").value = intervalVal;
  updateIntervalReadable(intervalVal);
  if ($("when")) $("when").value = r.when ? localDateTimeValue(r.when) : "";
  if ($("site")) $("site").value = r.site || "";
  if ($("after")) $("after").value = r.afterMinutes || 30;
  if ($("schedule-kind")) $("schedule-kind").value = r.scheduleKind || "daily";
  if ($("schedule-time")) $("schedule-time").value = r.time || "17:00";
  if ($("reset-site-timer")) $("reset-site-timer").checked = r.resetSiteTimerAfterNudge !== false;
  if ($("reminder-image")) $("reminder-image").value = "";
  setImagePreview(r.imageData || "");
  if ($("snooze")) $("snooze").checked = r.snoozeEnabled !== false;
  if ($("action-type")) $("action-type").value = r.actionType || "none";
  if ($("action-open-timing")) $("action-open-timing").value = r.actionOpenTiming || "click";
  if ($("action-urls")) {
    const list = Array.isArray(r.actionUrls) && r.actionUrls.length ? r.actionUrls : (r.actionUrl ? [r.actionUrl] : []);
    $("action-urls").value = list.join("\n");
  }
  if ($("action-url-mode")) $("action-url-mode").value = r.actionUrlMode || "iterate";
  updateActionUi();
  updateMessageModeUi();
  if ($("reminder-sound")) $("reminder-sound").value = r.soundName || "default";
  updateReminderSoundSummary();
  if ($("weekdays")) {
    [...$("weekdays").options].forEach(o => { o.selected = (r.weekdays || []).map(Number).includes(Number(o.value)); });
    syncWeekdayChipsFromSelect();
  }
  setFormChannels(r.notificationMode || "system");
  toggleType();
  location.hash = `reminder/edit?id=${r.id}`;
}

function startEdit(r) { fillForm(r); }

async function getEditingReminder() {
  const editId = $("reminder-form").dataset.editId;
  const currentState = await state();
  const reminder = (currentState.reminders || []).find(item => item.id === editId);
  if (!reminder) showInfoMessage("Opomnik ni na voljo", "Opomnika ni bilo mogoče najti. Vrnite se na seznam in poskusite znova.");
  return reminder;
}

$("editor-duplicate")?.addEventListener("click", async () => {
  const reminder = await getEditingReminder();
  if (reminder) await duplicateReminder(reminder);
});
$("editor-delete")?.addEventListener("click", async () => {
  const reminder = await getEditingReminder();
  if (reminder) deleteReminder(reminder);
});

$("type").addEventListener("change", toggleType);
$("schedule-kind").addEventListener("change", toggleType);
$("message-mode")?.addEventListener("change", updateMessageModeUi);
$("reset-form").addEventListener("click", () => {
  clearForm();
  location.hash = "reminders";
});
$("add-top").addEventListener("click", () => {
  clearForm();
  location.hash = "reminder/new";
});
$("step-next-1")?.addEventListener("click", () => {
  if (!$("name").value.trim()) { $("name").focus(); return; }
  setWizardStep(2);
});
$("step-next-2")?.addEventListener("click", () => {
  const type = $("type").value;
  if (type === "once") {
    if (!$("when").value) { $("when").focus(); return; }
    const when = Date.parse($("when").value);
    if (!Number.isFinite(when) || when <= Date.now()) {
      showInfoMessage("Neveljaven čas", "Izberite prihodnji datum in čas.");
      $("when").focus();
      return;
    }
    updateReminderSummaryPreview();
  }
  if (type === "site") {
    const site = $("site").value.trim();
    if (!site) { $("site").focus(); return; }
    if (!WebNudgeCore.validateDomain(site)) {
      showInfoMessage("Neveljavna domena", "Vnesite veljavno domeno, npr. youtube.com.");
      $("site").focus();
      return;
    }
  }
  if (type === "schedule" && $("schedule-kind").value === "weekly" && !$("weekdays").selectedOptions.length) {
    showInfoMessage("Izberite dneve", "Izberite vsaj en dan za tedensko ponavljanje.");
    $("weekdays").focus();
    return;
  }
  setWizardStep(3);
});
$("step-back-2")?.addEventListener("click", () => setWizardStep(1));
$("step-back-3")?.addEventListener("click", () => setWizardStep(2));

document.querySelectorAll('input[name="channel"]').forEach(cb => {
  cb.addEventListener("change", () => {
    const checked = getFormChannels();
    if (checked.length === 0) {
      cb.checked = true;
      showInfoMessage("Kanal obveščanja", "Izbran mora biti vsaj en način obveščanja.");
    }
    updatePermissionHint();
    updateReminderSummaryPreview();
  });
});

function updateActionUi() {
  const type = $("action-type")?.value || "none";
  const urlField = $("action-url-field");
  const timingField = $("action-open-timing-field");
  if (urlField) urlField.classList.toggle("hidden", type !== "url");
  if (timingField) timingField.classList.toggle("hidden", type === "none");

  const previewIcon = $("action-preview-icon");
  const previewTitle = $("action-preview-title");
  const previewDesc = $("action-preview-desc");
  const previewBtn = $("preview-exercise-btn");

  const data = {
    none: {
      uiKey: "info",
      title: "Samo običajno obvestilo",
      desc: "Prikazalo se bo samo obvestilo z gumbom za zaključek ali odlog. Noben nov zavihek se ne bo odprl.",
      hasPreview: false
    },
    breathing: {
      uiKey: "breathing",
      title: "Vodena dihalna vaja",
      desc: "Ob kliku na »Začni« se v novem zavihku odpre pomirjujoča interaktivna dihalna vaja z animiranim krogom in vodenim ritmom.",
      hasPreview: true,
      file: "exercises/breathing.html"
    },
    eyes: {
      uiKey: "eyes",
      title: "Vgrajena vaja za oči (pravilo 20–20–20)",
      desc: "Ob kliku na »Začni« se odpre interaktivna stran z 20-sekundnim odštevanjem in animirano točko za premikanje pogleda.",
      hasPreview: true,
      file: "exercises/eyes.html"
    },
    stretches: {
      uiKey: "stretches",
      title: "Vgrajene vaje med sedenjem",
      desc: "Ob kliku se odpre vodnik z 18 vajami za vrat, ramena, trup, roke in noge ter ločeno vajo za umirjeno dihanje; vse lahko izvajate sede.",
      hasPreview: true,
      file: "exercises/stretches.html"
    },
    url: {
      uiKey: "url",
      title: "Odpiranje spletne strani",
      desc: "Ob kliku na opomnik se v novem zavihku naloži zgoraj vneseni spletni naslov.",
      hasPreview: true,
      isExternal: true
    }
  };

  const item = data[type] || data.none;
  const opensImmediately = $("action-open-timing")?.value === "immediate";
  if (previewIcon) {
    if (window.WebNudgeIcons && WebNudgeIcons.getUiSvg) {
      previewIcon.innerHTML = WebNudgeIcons.getUiSvg(item.uiKey, 24);
    } else {
      previewIcon.textContent = "";
    }
  }
  if (previewTitle) previewTitle.textContent = item.title;
  if (previewDesc) previewDesc.textContent = opensImmediately && type !== "none"
    ? "Povezana stran se bo odprla samodejno, ko se prikaže opomnik."
    : item.desc;
  if (previewBtn) {
    previewBtn.classList.toggle("hidden", !item.hasPreview);
    previewBtn.onclick = () => {
      if (item.file) {
        window.open(browser.runtime.getURL(item.file), "_blank");
      } else if (item.isExternal) {
        const text = $("action-urls")?.value || "";
        const urls = text.split("\n").map(s => s.trim()).filter(Boolean);
        let u = urls[0] || "https://example.com";
        if (!/^https?:\/\//i.test(u)) u = "https://" + u;
        window.open(u, "_blank");
      }
    };
  }
}

$("action-type")?.addEventListener("change", () => {
  updateActionUi();
  updateMessageModeUi();
  updateReminderSummaryPreview();
});
$("action-open-timing")?.addEventListener("change", () => {
  updateActionUi();
  updateReminderSummaryPreview();
});
$("action-urls")?.addEventListener("input", updateReminderSummaryPreview);
$("action-url-mode")?.addEventListener("change", updateReminderSummaryPreview);

["name", "when", "site", "after", "schedule-time", "schedule-kind", "reminder-sound", "snooze", "action-type", "action-urls", "action-url-mode", "action-open-timing"].forEach(id => {
  $(id)?.addEventListener("input", updateReminderSummaryPreview);
  $(id)?.addEventListener("change", updateReminderSummaryPreview);
});

$("reminder-form").addEventListener("submit", async event => {
  event.preventDefault();
  const selectedChannels = getFormChannels();
  if (!selectedChannels.length) {
    showInfoMessage("Izberite kanal", "Izberite vsaj en način obveščanja (sistemsko, ločeno okno ali na strani).");
    return;
  }
  const editId = $("reminder-form").dataset.editId;
  const rawUrls = ($("action-urls")?.value || "")
    .split("\n")
    .map(s => s.trim())
    .filter(Boolean);

  const reminder = {
    id: editId || crypto.randomUUID(),
    name: $("name").value.trim(),
    type: $("type").value,
    intervalMinutes: Number($("interval").value) || 20,
    when: $("when").value ? new Date($("when").value).toISOString() : null,
    site: $("site").value.trim(),
    afterMinutes: Number($("after").value) || 30,
    scheduleKind: $("schedule-kind").value,
    time: $("schedule-time").value,
    weekdays: [...$("weekdays").selectedOptions].map(o => Number(o.value)),
    message: $("message").value.trim(),
    messageMode: $("message-mode")?.value === "rotate" ? "rotate" : "custom",
    messageCursor: Number($("reminder-form").dataset.messageCursor) || 0,
    icon: $("reminder-icon")?.value || "bell",
    soundName: $("reminder-sound")?.value || "default",
    imageData: $("image-preview img")?.src || "",
    notificationMode: selectedChannels.join("+"),
    snoozeEnabled: $("snooze").checked,
    actionType: $("action-type")?.value || "none",
    actionOpenTiming: $("action-open-timing")?.value || "click",
    actionUrl: rawUrls[0] || "",
    actionUrls: rawUrls,
    actionUrlMode: $("action-url-mode")?.value || "iterate",
    actionUrlLastIndex: -1,
    resetSiteTimerAfterNudge: $("reset-site-timer").checked,
    enabled: true
  };

  const permResult = await ensureReminderPermissions(reminder);
  if (!permResult.ok) {
    const nonInPageChannels = selectedChannels.filter(c => c !== "inpage");

    if (reminder.type === "site") {
      const confirmSaveDisabled = await askConfirmAsync(
        "Dovoljenje za spletno mesto ni bilo odobreno",
        `Za samodejno merjenje časa na »${reminder.site}« je potrebno dovoljenje za to spletno mesto.\n\nKer dovoljenje ni bilo odobreno, merilnik ne more spremljati obiska. Ali želite opomnik kljub temu shraniti (kot začasno izklopljenega)?`,
        { confirmText: "Shrani kot izklopljen", cancelText: "Uredi opomnik" }
      );
      if (confirmSaveDisabled) {
        reminder.enabled = false;
      } else {
        return;
      }
    } else if (nonInPageChannels.length > 0) {
      reminder.notificationMode = nonInPageChannels.join("+");
      const names = nonInPageChannels.map(c => c === "system" ? "Sistemsko obvestilo" : "Ločeno okno").join(" + ");
      showInfoMessage(
        "Prikaz na strani ni na voljo",
        `Ker dovoljenje za dostop do spletnih strani ni bilo odobreno, je bil opomnik shranjen z ostalimi izbranimi kanali (${names}).`
      );
    } else {
      const confirmSwitchToSystem = await askConfirmAsync(
        "Dovoljenje ni bilo odobreno",
        "Prikaz obvestila neposredno na spletnih straneh zahteva dovoljenje za dostop do strani.\n\nKer dovoljenje ni bilo odobreno, opomnik ne more delovati na spletni strani. Ali želite opomnik shraniti kot sistemsko obvestilo (deluje brez posebnih dovoljenj)?",
        { confirmText: "Shrani kot sistemsko", cancelText: "Uredi opomnik" }
      );
      if (confirmSwitchToSystem) {
        reminder.notificationMode = "system";
      } else {
        return;
      }
    }
  }

  const response = await browser.runtime.sendMessage({ type: "SAVE_REMINDER", reminder });
  if (!response?.ok) {
    showInfoMessage("Napaka", response?.error || "Opomnika ni bilo mogoče shraniti.");
    return;
  }
  clearForm();
  location.hash = "reminders";
  showToast(editId ? `Spremembe opomnika »${reminder.name}« so shranjene.` : `Opomnik »${reminder.name}« je bil uspešno ustvarjen.`);
  renderReminders();
});

async function loadSettings() {
  const s = await state();
  const settings = s.settings || {};
  if ($("notification-mode")) $("notification-mode").value = settings.notificationMode || "system";
  if ($("duration")) $("duration").value = String(settings.notificationDuration ?? 8);
  if ($("default-snooze")) $("default-snooze").value = String(settings.defaultSnooze ?? 5);
  if ($("window-size")) $("window-size").value = `${settings.notificationWindow?.width || 430} × ${settings.notificationWindow?.height || 520}`;
  if ($("quiet-hours")) $("quiet-hours").checked = Boolean(settings.quietHours);
  if ($("quiet-from")) $("quiet-from").value = settings.quietFrom || "22:00";
  if ($("quiet-to")) $("quiet-to").value = settings.quietTo || "06:00";
  if ($("quiet-behavior")) $("quiet-behavior").value = settings.quietBehavior || "skip";
  if ($("history-enabled")) $("history-enabled").checked = settings.historyEnabled !== false;
  if ($("sound-enabled")) $("sound-enabled").checked = settings.sound === true;
  if ($("sound-name")) $("sound-name").value = settings.soundName || "soft-click";
  if ($("sound-volume")) $("sound-volume").value = String(settings.soundVolume ?? 0.55);
  if ($("volume-val")) $("volume-val").textContent = `${Math.round((settings.soundVolume ?? 0.55) * 100)} %`;
  applyAppearance(settings);
  if ($("font-family")) $("font-family").value = settings.fontFamily || "system";
  if ($("font-size")) $("font-size").value = settings.fontSize || "standard";
  updateSettingsConditionalPanels();
}

function updateSettingsConditionalPanels() {
  const quietHoursChecked = $("quiet-hours")?.checked || false;
  $("quiet-hours-subpanel")?.classList.toggle("hidden", !quietHoursChecked);

  const soundChecked = $("sound-enabled")?.checked || false;
  $("sound-subpanel")?.classList.toggle("hidden", !soundChecked);

  const mode = $("notification-mode")?.value || "system";
  const hasInpage = mode === "inpage" || mode === "both" || mode === "all";
  $("duration-field")?.classList.toggle("hidden", !hasInpage);
}

function playPreviewSound(soundName, volume) {
  if (typeof WebNudgeSounds !== "undefined") {
    WebNudgeSounds.play(soundName, volume);
    return;
  }
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = soundName === "soft" ? 660 : soundName === "double" ? 820 : 740;
    gain.gain.setValueAtTime(Math.max(0.001, Number(volume) || 0.55), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
  } catch {}
}

$("preview-reminder-sound-btn")?.addEventListener("click", () => {
  let name = $("reminder-sound")?.value || "default";
  if (name === "default") name = $("sound-name")?.value || "chime";
  const vol = Number($("sound-volume")?.value) || 0.55;
  playPreviewSound(name, vol);
});

async function saveSettings(patch) {
  if (typeof browser === "undefined" || !browser.runtime?.sendMessage) {
    const settings = { ...(await state()).settings, ...patch };
    try {
      localStorage.setItem(STANDALONE_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Could not save standalone Vmes settings:", error);
      showInfoMessage("Napaka", "Nastavitve videza ni bilo mogoče shraniti v tem brskalniku.");
      return;
    }
    if (patch.theme || patch.fontFamily || patch.fontSize) {
      applyAppearance(settings);
      const status = $("appearance-status");
      if (status) status.textContent = "Videz shranjen v tem brskalniku.";
    }
    return;
  }

  const response = await browser.runtime.sendMessage({ type: "SAVE_SETTINGS", patch });
  if (!response?.ok) { showInfoMessage("Napaka", response?.error || "Nastavitve ni bilo mogoče shraniti."); return; }
  if (patch.theme || patch.fontFamily || patch.fontSize) {
    applyAppearance(response.settings);
    const status = $("appearance-status");
    if (status) status.textContent = "Videz shranjen v tem brskalniku.";
  }
}

function updateThemeCards(theme) {
  const selectedTheme = ["color", "light"].includes(theme) ? "mono" : (theme || "forest");
  document.querySelectorAll(".theme-option").forEach(option => {
    const selected = option.dataset.themeChoice === selectedTheme;
    option.setAttribute("aria-pressed", String(selected));
    option.classList.toggle("selected", selected);
  });
}

 $("reminder-sound")?.addEventListener("change", updateReminderSoundSummary);
$("notification-mode").addEventListener("change", e => {
  saveSettings({ notificationMode: e.target.value });
  updateSettingsConditionalPanels();
});
$("duration").addEventListener("change", e => saveSettings({ notificationDuration: Number(e.target.value) }));
$("default-snooze").addEventListener("change", e => saveSettings({ defaultSnooze: Number(e.target.value) }));
$("quiet-hours").addEventListener("change", e => {
  saveSettings({ quietHours: e.target.checked });
  updateSettingsConditionalPanels();
});
$("quiet-from").addEventListener("change", e => saveSettings({ quietFrom: e.target.value }));
$("quiet-to").addEventListener("change", e => saveSettings({ quietTo: e.target.value }));
$("quiet-behavior").addEventListener("change", e => saveSettings({ quietBehavior: e.target.value }));
$("history-enabled").addEventListener("change", e => saveSettings({ historyEnabled: e.target.checked }));
$("sound-enabled").addEventListener("change", e => {
  saveSettings({ sound: e.target.checked });
  updateSettingsConditionalPanels();
});
$("sound-name").addEventListener("change", e => saveSettings({ soundName: e.target.value }));
$("sound-volume").addEventListener("input", e => {
  const val = Number(e.target.value);
  if ($("volume-val")) $("volume-val").textContent = `${Math.round(val * 100)} %`;
  saveSettings({ soundVolume: val });
});
$("preview-sound-btn")?.addEventListener("click", () => {
  const name = $("sound-name")?.value || "soft-click";
  const vol = Number($("sound-volume")?.value) || 0.55;
  playPreviewSound(name, vol);
});
$("window-size")?.addEventListener("change", e => {
  const match = e.target.value.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (match) saveSettings({ notificationWindow: { width: Math.min(1200, Math.max(280, Number(match[1]))), height: Math.min(1200, Math.max(220, Number(match[2]))) } });
});
$("test-notification").addEventListener("click", async () => {
  const mode = $("notification-mode").value;
  const channels = WebNudgeCore.getChannelsForMode(mode);
  if (channels.includes("inpage")) {
    const granted = await requestOrigins(["*://*/*"]);
    if (!granted) { showInfoMessage("Dovoljenje za strani", "Za obvestilo na strani potrebujemo dovoljenje za spletne strani."); return; }
  }
  await browser.runtime.sendMessage({ type: "TRIGGER_TEST", mode });
});

document.querySelectorAll(".theme-option").forEach(btn => btn.addEventListener("click", () => {
  const theme = btn.dataset.themeChoice;
  saveSettings({ theme, customThemeBase: theme, customColors: null });
}));
Object.values(CUSTOM_COLOR_FIELDS).forEach(id => $(id)?.addEventListener("change", async () => {
  const settings = (await state()).settings || {};
  const customThemeBase = settings.theme === "custom" ? settings.customThemeBase : (settings.theme || "forest");
  const customColors = Object.fromEntries(Object.entries(CUSTOM_COLOR_FIELDS).map(([key, fieldId]) => [key, $(fieldId).value]));
  await saveSettings({ theme: "custom", customThemeBase, customColors });
}));
$("reset-custom-colors")?.addEventListener("click", () => {
  const theme = appearanceSettings.customThemeBase || "forest";
  saveSettings({ theme, customThemeBase: theme, customColors: null });
});
$("font-family")?.addEventListener("change", event => saveSettings({ fontFamily: event.target.value }));
$("font-size")?.addEventListener("change", event => saveSettings({ fontSize: event.target.value }));

async function renderStats() {
  const s = await state();
  const history = s.history || [];
  const shown = history.filter(x => x.status === "shown").length;
  const completed = history.filter(x => x.status === "completed").length;
  const snoozed = history.filter(x => x.status === "snoozed").length;
  const dismissed = history.filter(x => x.status === "dismissed").length;
  const todayKey = new Date().toDateString();
  const today = history.filter(x => new Date(x.timestamp).toDateString() === todayKey).length;
  const completionRate = shown ? Math.round((completed / shown) * 100) : 0;

  const statsGrid = $("stats-grid");
  if (statsGrid) {
    statsGrid.replaceChildren();
    [
      ["Prikazi", shown],
      ["Danes", today],
      ["Zaključeno", completed],
      ["Odlog ali zaprtje", snoozed + dismissed]
    ].forEach(([label, value]) => {
      const stat = document.createElement("div");
      stat.className = "stat";
      const b = document.createElement("b");
      b.textContent = String(value);
      const span = document.createElement("span");
      span.textContent = label;
      stat.append(b, span);
      statsGrid.appendChild(stat);
    });
  }

  $("completion-rate").textContent = `${completionRate} %`;
  const days = Array.from({ length: 7 }, (_, index) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - index));
    const count = history.filter(x => new Date(x.timestamp).toDateString() === d.toDateString()).length;
    return { label: d.toLocaleDateString("sl-SI", { weekday: "short" }), count };
  });
  const max = Math.max(1, ...days.map(d => d.count));
  const bars = $("bars");
  if (bars) {
    bars.replaceChildren();
    days.forEach(d => {
      const wrap = document.createElement("div");
      wrap.className = "bar-wrap";
      const bar = document.createElement("div");
      bar.className = "bar";
      bar.title = `${d.count} dogodkov`;
      bar.style.height = `${Math.max(5, (d.count / max) * 135)}px`;
      const span = document.createElement("span");
      span.className = "bar-label";
      span.textContent = d.label;
      wrap.append(bar, span);
      bars.appendChild(wrap);
    });
  }

  const siteUsage = s.siteUsage || {};
  const recentDays = Object.values(siteUsage);
  const siteSeconds = recentDays.reduce((sum, day) => sum + Object.entries(day).filter(([k]) => !k.startsWith("__fired__:")).reduce((a, [, seconds]) => a + Number(seconds || 0), 0), 0);
  $("site-minutes").textContent = Math.round(siteSeconds / 60);
}

async function renderHistory() {
  const s = await state();
  const box = $("history-list");
  if (!box) return;
  const rows = (s.history || []).slice(0, 200);
  box.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state history-empty";
    const icon = document.createElement("div");
    icon.className = "empty-icon";
    icon.innerHTML = `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted)"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
    const strong = document.createElement("strong");
    strong.textContent = "Zgodovina je prazna.";
    const span = document.createElement("span");
    span.textContent = "Ko se opomniki začnejo prikazovati, boste tukaj videli zabeležene dogodke in odzive.";
    empty.append(icon, strong, span);
    box.appendChild(empty);
    return;
  }
  rows.forEach(item => {
    const row = document.createElement("div");
    row.className = "history-row";

    const left = document.createElement("div");
    left.className = "history-left";

    const dotIcon = document.createElement("div");
    dotIcon.className = `history-icon-box status-${item.status || "event"}`;
    if (typeof WebNudgeIcons !== "undefined") {
      const iconKey = item.status === "completed" ? "check" : item.status === "snoozed" ? "clock" : item.status === "dismissed" ? "x" : "bell";
      dotIcon.innerHTML = WebNudgeIcons.getUiSvg(iconKey);
    } else {
      dotIcon.textContent = "●";
    }

    const titleGroup = document.createElement("div");
    titleGroup.className = "history-title-group";
    const strong = document.createElement("strong");
    strong.textContent = item.name || item.reminderId || "Vmes";
    const small = document.createElement("small");
    small.textContent = formatDate(item.timestamp);
    titleGroup.append(strong, small);

    left.append(dotIcon, titleGroup);

    const right = document.createElement("div");
    right.className = "history-right";

    const statusPill = document.createElement("span");
    statusPill.className = `history-status-pill status-${item.status || "event"}`;
    statusPill.textContent = STATUS_LABELS[item.status] || item.status || "Dogodek";
    right.appendChild(statusPill);

    if (item.channel) {
      const channelPill = document.createElement("span");
      channelPill.className = "badge-channel";
      const iconKey = item.channel === "window" ? "window" : item.channel === "inpage" ? "pin" : "bell";
      const labelText = item.channel === "window" ? "Ločeno okno" : item.channel === "inpage" ? "Na strani" : "Sistemsko";
      if (typeof WebNudgeIcons !== "undefined") {
        channelPill.innerHTML = `${WebNudgeIcons.getUiSvg(iconKey, "badge-icon-svg")} <span>${esc(labelText)}</span>`;
      } else {
        channelPill.textContent = labelText;
      }
      right.appendChild(channelPill);
    }

    row.append(left, right);
    box.appendChild(row);
  });
}

$("clear-history").addEventListener("click", async () => {
  askConfirm("Počisti zgodovino", "Res želite počistiti vso lokalno zgodovino?", async () => {
    await browser.storage.local.set({ history: [] });
    await renderHistory();
    await renderStats();
  });
});

$("reset-all").addEventListener("click", async () => {
  askConfirm("Ponastavi vse", "Res želite ponastaviti vse podatke?", async () => {
    await browser.runtime.sendMessage({ type: "RESET" });
    clearForm();
    await Promise.all([renderReminders(), renderHistory(), renderStats(), loadSettings(), refreshSiteAccess()]);
  });
});

async function refreshSiteAccess() {
  const s = await state();
  const enabled = Boolean(s.settings.siteTrackingEnabled);
  $("toggle-site-access").textContent = enabled ? "Onemogoči spremljanje" : "Omogoči spremljanje";
  $("site-access-copy").textContent = enabled
    ? "Spremljanje je vklopljeno. Šteje samo aktivni zavihek v osredotočenem Firefoxovem oknu. Izklop ni mogoč, dokler so aktivni opomniki za spletne strani ali dnevne časovne omejitve."
    : "Dostop do strani je potreben za merjenje aktivnega časa in uveljavljanje pravil za izbrane domene.";
  const session = s.activeSiteSession;
  if (enabled && session?.host) {
    const lastSeen = Number(session.lastSeenAt || session.startedAt || Date.now());
    const seconds = Math.max(0, Math.floor((Math.min(Date.now(), lastSeen + 90000) - session.startedAt) / 1000));
    $("current-session").textContent = `${session.host} · ${Math.floor(seconds / 60)} min ${seconds % 60} s`;
  } else {
    $("current-session").textContent = "Ni aktivne seje.";
  }
}

$("toggle-site-access").addEventListener("click", async () => {
  const s = await state();
  if (!s.settings.siteTrackingEnabled) {
    const info = await browser.runtime.sendMessage({ type: "ENABLE_SITE_TRACKING" });
    if (info?.needsPermission) {
      const granted = await requestOrigins(info.origins);
      if (!granted) { showInfoMessage("Dovoljenja niso odobrena", "Dovoljenja za izbrane spletne strani niso bila odobrena."); return; }
      const retry = await browser.runtime.sendMessage({ type: "ENABLE_SITE_TRACKING" });
      if (retry?.ok === false) { showInfoMessage("Napaka", retry.error || "Spremljanja ni bilo mogoče vključiti."); return; }
    } else if (info?.ok === false) {
      showInfoMessage("Napaka", info.error || "Spremljanja ni bilo mogoče vključiti."); return;
    }
  } else {
    const response = await browser.runtime.sendMessage({ type: "DISABLE_SITE_TRACKING" });
    if (response?.ok === false) showInfoMessage("Napaka", response.error || "Spremljanja ni bilo mogoče izključiti.");
  }
  await refreshSiteAccess();
});
$("reset-current-site").addEventListener("click", async () => {
  await browser.runtime.sendMessage({ type: "RESET_CURRENT_SITE" });
  await refreshSiteAccess();
});


$("reminder-search")?.addEventListener("input", renderReminders);
$("reminder-filter")?.addEventListener("change", renderReminders);
document.querySelectorAll("#filter-pills [data-filter]").forEach(button => {
  button.addEventListener("click", () => {
    $("reminder-filter").value = button.dataset.filter;
    renderReminders();
  });
});
$("enable-all")?.addEventListener("click", async () => {
  await browser.runtime.sendMessage({ type: "SET_ALL_ENABLED", enabled: true });
  showToast("Vsi opomniki so bili vklopljeni.");
  await renderReminders();
});
$("disable-all")?.addEventListener("click", async () => {
  await browser.runtime.sendMessage({ type: "SET_ALL_ENABLED", enabled: false });
  showToast("Vsi opomniki so bili izklopljeni.");
  await renderReminders();
});
$("export-data")?.addEventListener("click", async () => {
  const response = await browser.runtime.sendMessage({ type: "EXPORT_DATA" });
  if (!response?.ok) return showInfoMessage("Napaka", "Podatkov ni bilo mogoče izvoziti.");
  const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `web-nudge-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
  URL.revokeObjectURL(url);
});
$("import-data")?.addEventListener("click", () => $("import-file")?.click());
$("import-file")?.addEventListener("change", async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error("Datoteka je prevelika (največja velikost je 5 MB).");
    const data = JSON.parse(await file.text());
    askConfirm("Uvoz podatkov", "Uvoz bo zamenjal trenutne opomnike, nastavitve in zgodovino. Nadaljujem?", async () => {
      let response = await browser.runtime.sendMessage({ type: "IMPORT_DATA", data });
      if (!response?.ok) return showInfoMessage("Napaka", response?.error || "Uvoz ni uspel.");
      if (response.needsPermission) {
        const granted = await requestOrigins(response.origins);
        if (!granted) return showInfoMessage("Dovoljenja niso odobrena", "Uvoz ni bil izveden. Odobrite zahtevana dovoljenja ali uvozite varnostno kopijo brez teh spletnih pravil.");
        response = await browser.runtime.sendMessage({ type: "IMPORT_DATA", data });
        if (!response?.ok || response.needsPermission) {
          return showInfoMessage("Uvoz ni uspel", response?.error || "Firefox ni potrdil vseh potrebnih dovoljenj; vaši trenutni podatki so ostali nespremenjeni.");
        }
      }
      await Promise.all([renderReminders(), renderStats(), renderHistory(), loadSettings(), refreshSiteAccess()]);
      showInfoMessage("Uvoz uspešen", "Podatki so bili uspešno uvoženi.");
    });
  } catch (error) {
    showInfoMessage("Napaka", error?.message || "Datoteke ni bilo mogoče prebrati kot veljaven JSON.");
  }
  event.target.value = "";
});

function handleRoute() {
  const hash = (location.hash || "").replace("#", "") || "reminders";
  let sectionId = "reminders";

  if (hash === "reminder/new") {
    sectionId = "reminder-editor";
    clearForm();
  } else if (hash.startsWith("reminder/edit")) {
    sectionId = "reminder-editor";
    const match = hash.match(/id=([^&]+)/);
    if (match && match[1]) {
      const targetId = decodeURIComponent(match[1]);
      state().then(s => {
        const r = (s.reminders || []).find(x => x.id === targetId);
        if (r) fillForm(r);
      });
    }
  } else if (hash === "new-reminder") {
    // Backwards compatibility
    sectionId = "reminder-editor";
    clearForm();
  } else if (hash === "focus/new") {
    sectionId = "focus";
  } else {
    const validSections = ["reminders", "notifications", "focus", "stats", "history", "appearance", "privacy", "data", "about"];
    if (validSections.includes(hash)) {
      sectionId = hash;
    }
  }

  // Activate appropriate page section
  document.querySelectorAll(".page-section").forEach(sec => {
    sec.classList.toggle("active-page", sec.id === sectionId);
  });

  const activeNav = hash === "focus/new"
    ? "focus-add"
    : sectionId === "reminder-editor"
      ? "reminder-editor"
      : sectionId;

  // Highlight the navigation link that matches the current route.
  document.querySelectorAll(".side-link").forEach(link => {
    const nav = link.dataset.nav || link.getAttribute("href")?.replace("#", "");
    const isActive = nav === activeNav;
    link.classList.toggle("active", Boolean(isActive));
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });

  // Scroll main container to top
  window.scrollTo({ top: 0, behavior: "instant" });
  if (hash === "focus/new") {
    requestAnimationFrame(() => $("block-host")?.focus());
  }
}

window.addEventListener("hashchange", handleRoute);

const mobileMenuToggle = $("mobile-menu-toggle");
const sidebarBackdrop = $("sidebar-backdrop");
const settingsSidebar = $("settings-sidebar");
const mobileSettingsMedia = window.matchMedia("(max-width: 900px)");
function syncSettingsSidebarInert() {
  settingsSidebar?.toggleAttribute("inert", mobileSettingsMedia.matches && !settingsSidebar.classList.contains("open"));
}
function syncMobileMenuToggle(isOpen) {
  mobileMenuToggle?.setAttribute("aria-expanded", String(isOpen));
  mobileMenuToggle?.setAttribute("aria-label", isOpen ? "Zapri meni" : "Odpri meni");
}
function closeMobileMenu({ restoreFocus = false } = {}) {
  const wasOpen = settingsSidebar?.classList.contains("open");
  settingsSidebar?.classList.remove("open");
  sidebarBackdrop?.setAttribute("hidden", "");
  syncMobileMenuToggle(false);
  document.body.classList.remove("menu-open");
  syncSettingsSidebarInert();
  if (restoreFocus && wasOpen && mobileSettingsMedia.matches) mobileMenuToggle?.focus();
}
syncSettingsSidebarInert();
function handleSettingsBreakpointChange() {
  settingsSidebar?.classList.remove("menu-transition-ready");
  closeMobileMenu();
  if (mobileSettingsMedia.matches) {
    requestAnimationFrame(() => settingsSidebar?.classList.add("menu-transition-ready"));
  }
}
if (mobileSettingsMedia.matches) {
  requestAnimationFrame(() => settingsSidebar?.classList.add("menu-transition-ready"));
}
mobileSettingsMedia.addEventListener("change", handleSettingsBreakpointChange);
mobileMenuToggle?.addEventListener("click", () => {
  const isOpen = settingsSidebar?.classList.toggle("open") || false;
  if (isOpen) sidebarBackdrop?.removeAttribute("hidden");
  else sidebarBackdrop?.setAttribute("hidden", "");
  syncMobileMenuToggle(isOpen);
  document.body.classList.toggle("menu-open", isOpen);
  syncSettingsSidebarInert();
});
sidebarBackdrop?.addEventListener("click", () => closeMobileMenu({ restoreFocus: true }));
document.querySelectorAll(".side-link").forEach(link => {
  link.addEventListener("click", () => {
    closeMobileMenu({ restoreFocus: true });
    const href = link.getAttribute("href");
    if (href && href.startsWith("#")) {
      const targetHash = href.slice(1);
      if (location.hash !== href) {
        location.hash = targetHash;
      } else {
        handleRoute();
      }
    }
  });
});

window.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeMobileMenu({ restoreFocus: true });
    const modal = document.getElementById("global-modal");
    if (modal?.classList.contains("visible")) {
      event.preventDefault();
      closeModal(false);
    }
  }
  if (event.key === "Tab") {
    const modal = $("global-modal");
    if (!modal?.classList.contains("visible")) return;
    const dialog = modal.querySelector('[role="dialog"]');
    const focusable = [...dialog.querySelectorAll('button:not([disabled])')]
      .filter(element => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }
});

function populateUiIcons() {
  if (typeof WebNudgeIcons === "undefined") return;
  document.querySelectorAll("[data-ui-icon]").forEach(el => {
    const key = el.dataset.uiIcon;
    if (key) el.innerHTML = WebNudgeIcons.getUiSvg(key);
  });
}

/* ── Omejitve & Fokus (Blocklist & Time Limits) ── */
$("block-mode")?.addEventListener("change", e => {
  const isLimit = e.target.value === "limit";
  $("block-limit-group")?.classList.toggle("hidden", !isLimit);
});

async function renderBlockRules() {
  const container = $("block-rules-list");
  const empty = $("block-rules-empty");
  if (!container || !empty) return;
  const currentState = await state();
  const rules = Array.isArray(currentState?.settings?.blockRules) ? currentState.settings.blockRules : [];
  container.replaceChildren();

  if (!rules.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  const accessStates = await Promise.all(rules.map(async rule => {
    if (!rule.enabled || typeof browser === "undefined" || !browser.permissions?.contains) return true;
    try {
      return await browser.permissions.contains({
        origins: WebNudgeCore.originPatternsForHost(rule.host)
      });
    } catch (error) {
      console.error(`Dovoljenja za ${rule.host} ni bilo mogoče preveriti.`, error);
      return null;
    }
  }));

  rules.forEach((rule, index) => {
    const accessGranted = accessStates[index];
    const card = document.createElement("div");
    card.className = "reminder-card block-rule-card";
    card.setAttribute("role", "group");
    card.setAttribute("aria-label", `Pravilo za ${rule.host}`);

    const left = document.createElement("div");
    left.className = "block-rule-details";

    const icon = document.createElement("div");
    icon.setAttribute("aria-hidden", "true");
    icon.style.color = rule.mode === "block" ? "#ef4444" : "#f59e0b";
    icon.innerHTML = rule.mode === "block"
      ? `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`
      : `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

    const text = document.createElement("div");
    text.className = "block-rule-copy";
    const title = document.createElement("strong");
    title.textContent = rule.host;

    const sub = document.createElement("div");
    sub.textContent = rule.mode === "block"
      ? "Strogo blokirano (vedno prepovedano)"
      : `Dnevna omejitev: ${rule.dailyLimitMinutes} min na dan`;

    text.append(title, sub);
    if (accessGranted === false || accessGranted === null) {
      const accessNote = document.createElement("small");
      accessNote.className = "block-rule-access-note";
      accessNote.textContent = accessGranted === false
        ? "Firefox nima več dovoljenja za to spletno mesto."
        : "Dovoljenja trenutno ni mogoče preveriti.";
      text.append(accessNote);
    }
    left.append(icon, text);

    const right = document.createElement("div");
    right.className = "block-rule-actions";

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "secondary mini-btn";
    toggle.textContent = rule.enabled && accessGranted === false ? "Dostop manjka" : rule.enabled ? "Vklopljeno" : "Izklopljeno";
    toggle.setAttribute("aria-pressed", String(Boolean(rule.enabled)));
    toggle.setAttribute("aria-label", `${rule.enabled ? "Izklopi" : "Vklopi"} pravilo za ${rule.host}`);
    toggle.onclick = async () => {
      rule.enabled = !rule.enabled;
      await saveUpdatedBlockRules(rules);
    };

    if (rule.enabled && accessGranted !== true && typeof browser !== "undefined" && browser.permissions?.request) {
      const grant = document.createElement("button");
      grant.type = "button";
      grant.className = "secondary mini-btn";
      grant.textContent = "Dovoli dostop";
      grant.setAttribute("aria-label", `Znova dovoli dostop za ${rule.host}`);
      grant.onclick = async () => {
        try {
          const granted = await browser.permissions.request({
            origins: WebNudgeCore.originPatternsForHost(rule.host)
          });
          if (!granted) {
            showInfoMessage("Dovoljenje ni odobreno", `Pravilo za ${rule.host} ne more delovati, dokler Firefox ne odobri dostopa.`);
            return;
          }
          await renderBlockRules();
        } catch (error) {
          showInfoMessage("Dovoljenja ni mogoče zahtevati", error?.message || "Firefox trenutno ne more odobriti dostopa do te spletne strani.");
        }
      };
      right.append(grant);
    }

    const del = document.createElement("button");
    del.type = "button";
    del.className = "secondary mini-btn";
    del.style.color = "var(--danger)";
    del.title = "Odstrani to pravilo";
    del.textContent = "Odstrani";
    del.onclick = async () => {
      const next = rules.filter(r => r.id !== rule.id);
      await saveUpdatedBlockRules(next);
    };

    right.append(toggle, del);
    card.append(left, right);
    container.append(card);
  });
}

async function saveUpdatedBlockRules(rules) {
  if (typeof browser === "undefined" || !browser.runtime?.sendMessage) {
    showInfoMessage("Odpri dodatek v Firefoxu", "Pravila omejitev lahko spreminjaš samo v nameščenem dodatku.");
    return false;
  }
  const origins = [...new Set(rules.filter(rule => rule.enabled)
    .flatMap(rule => WebNudgeCore.originPatternsForHost(rule.host)))];
  if (origins.length) {
    let permitted = false;
    try { permitted = await browser.permissions.contains({ origins }); } catch (error) {
      showInfoMessage("Dovoljenj ni mogoče preveriti", error?.message || "Firefox trenutno ne more preveriti dostopa do teh spletnih strani.");
      return false;
    }
    if (!permitted && !(await requestOrigins(origins))) {
      showInfoMessage("Dovoljenje ni odobreno", "Pravilo ni bilo shranjeno, ker dodatek nima dostopa do izbrane spletne strani.");
      return false;
    }
  }
  try {
    const response = await browser.runtime.sendMessage({ type: "SAVE_SETTINGS", patch: { blockRules: rules } });
    if (!response?.ok) {
      showInfoMessage("Shranjevanje ni uspelo", response?.error || "Pravil omejitev ni bilo mogoče shraniti.");
      await renderBlockRules();
      return false;
    }
  } catch (error) {
    showInfoMessage("Shranjevanje ni uspelo", error?.message || "Pravil omejitev ni bilo mogoče shraniti.");
    await renderBlockRules();
    return false;
  }
  await renderBlockRules();
  return true;
}

$("add-block-form")?.addEventListener("submit", async e => {
  e.preventDefault();
  const hostInput = $("block-host");
  const modeSelect = $("block-mode");
  const limitSelect = $("block-limit-minutes");
  if (!hostInput) return;

  const rawHost = hostInput.value.trim();
  const host = WebNudgeCore.normalizeHost(rawHost);
  if (!WebNudgeCore.validateDomain(host)) {
    showInfoMessage("Neveljavna domena", "Vnesite veljavno spletno domeno, npr. youtube.com ali reddit.com");
    return;
  }

  const currentState = await state();
  const currentRules = Array.isArray(currentState?.settings?.blockRules) ? [...currentState.settings.blockRules] : [];
  
  if (currentRules.some(r => r.host === host)) {
    showInfoMessage("Pravilo že obstaja", `Za domeno »${host}« že imate določeno pravilo.`);
    return;
  }

  const newRule = WebNudgeCore.normalizeBlockRule({
    id: crypto.randomUUID(),
    host,
    mode: modeSelect?.value || "block",
    dailyLimitMinutes: Number(limitSelect?.value) || 30,
    enabled: true,
    createdAt: Date.now()
  });

  if (newRule) {
    currentRules.push(newRule);
    const saved = await saveUpdatedBlockRules(currentRules);
    if (!saved) return;
    hostInput.value = "";
    showInfoMessage("Omejitev dodana", `Spletno mesto »${host}« je sedaj v načinu osredotočenosti.`);
  }
});

async function init() {
  populateUiIcons();
  document.querySelectorAll("[data-preset-icon]").forEach(el => {
    el.innerHTML = WebNudgeIcons.getSvg(el.dataset.presetIcon);
  });
  renderIconSelector();
  clearForm();
  try {
    await Promise.all([loadSettings(), renderReminders(), renderStats(), renderHistory(), refreshSiteAccess(), renderBlockRules()]);
    handleRoute();
  } catch (error) {
    console.error("Nastavitev dodatka ni bilo mogoče naložiti.", error);
    showToast(error?.message || "Nastavitev dodatka ni bilo mogoče naložiti. Osvežite stran.", 10000);
  }
}

if (typeof browser !== "undefined" && browser.storage?.onChanged) {
  browser.storage.onChanged.addListener(() => {
    renderReminders();
    renderStats();
    refreshSiteAccess();
    renderBlockRules();
  });
}

/* ── Weekday Toggle Chips ⟷ Hidden Select Sync ── */
function syncWeekdayChipsFromSelect() {
  const sel = $("weekdays");
  if (!sel) return;
  const selectedVals = new Set([...sel.selectedOptions].map(o => o.value));
  document.querySelectorAll(".weekday-chip").forEach(chip => {
    const selected = selectedVals.has(chip.dataset.day);
    chip.classList.toggle("active", selected);
    chip.setAttribute("aria-pressed", String(selected));
  });
}

document.querySelectorAll(".weekday-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const day = chip.dataset.day;
    const sel = $("weekdays");
    if (!sel) return;
    // Toggle the corresponding hidden option
    const opt = [...sel.options].find(o => o.value === day);
    if (opt) opt.selected = !opt.selected;
    syncWeekdayChipsFromSelect();
    updateReminderSummaryPreview();
  });
});

init();
