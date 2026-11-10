const getState = async () => {
  if (typeof browser === "undefined" || !browser.runtime?.sendMessage) {
    throw new Error("Pojavno okno ni povezano z dodatkom.");
  }
  const state = await browser.runtime.sendMessage({ type: "GET_STATE" });
  if (!state || !Array.isArray(state.reminders)) throw new Error("Podatkov opomnikov ni bilo mogoče naložiti.");
  return state;
};

const $ = id => document.getElementById(id);
const esc = s => String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const { nextDueDate, formatRemainingDuration, hostFromUrl, localDateKey } = WebNudgeCore;

function nextDue(r, now = Date.now()) { return nextDueDate(r, now); }

function label(r) {
  if (r.type === "interval") return `vsakih ${r.intervalMinutes} min`;
  if (r.type === "once") return `enkrat · ${new Date(r.when).toLocaleString("sl-SI", { dateStyle: "short", timeStyle: "short" })}`;
  if (r.type === "site") return `${r.site} · po ${r.afterMinutes} min`;
  return r.scheduleKind === "weekly" ? `${r.time} · izbrani dnevi` : `vsak dan ob ${r.time}`;
}

function relativeCountdown(timestamp, now = Date.now()) {
  if (!timestamp) return "—";
  const diff = timestamp - now;
  if (diff <= 0) return "Zdaj";
  return `Čez ${formatRemainingDuration(diff)}`;
}

function showToast(message) { const t = $("toast"); t.textContent = message; t.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => t.classList.remove("show"), 2200); }

function reportActionError(error) {
  console.error("Pojavnega okna ni bilo mogoče dokončati.", error);
  showToast(error?.message || "Dejanje ni uspelo. Poskusite znova.");
}

async function openExtensionPage(path) {
  await browser.tabs.create({ url: browser.runtime.getURL(path) });
}

async function quickAdd(minutes, iconKey = "bell") {
  const presets = {
    eye: { name: "Odmor za oči", message: "Poglejte za 20 sekund v daljavo in sprostite pogled.", actionType: "eyes" },
    "water-glass": { name: "Kozarec vode", message: "Vzemite nekaj požirkov vode, če vam ustreza.", actionType: "none" },
    stretch: { name: "Kratek razteg", message: "Vstanite, nežno raztegnite telo in sprostite ramena.", actionType: "stretches" }
  };
  const preset = presets[iconKey];
  const name = preset?.name || `Opomnik (${minutes < 60 ? `${minutes} min` : `${minutes / 60} h`})`;
  const reminder = {
    id: crypto.randomUUID(),
    name,
    type: "interval",
    intervalMinutes: minutes,
    icon: iconKey,
    enabled: true,
    message: preset?.message || "Čas je za opomnik.",
    notificationMode: "system",
    snoozeEnabled: true,
    actionType: preset?.actionType || "none"
  };
  const response = await browser.runtime.sendMessage({ type: "SAVE_REMINDER", reminder });
  if (!response?.ok) { showToast(response?.error || "Opomnika ni bilo mogoče ustvariti."); return; }
  showToast("Hiter opomnik je dodan."); await render();
}

let popupTimer = null;
let countdownRefreshPending = false;

function updateCountdowns(s, now = Date.now()) {
  const active = (s.reminders || []).filter(r => r.enabled);
  const due = active.map(r => ({ r, at: nextDue(r, now) })).filter(x => x.at).sort((a, b) => a.at - b.at)[0];
  $("next-name").textContent = due?.r.name || (active.length ? "Opomniki za spletno stran" : "Ni nastavljenih opomnikov");

  if (due) {
    $("next-time").textContent = relativeCountdown(due.at, now);
    const progress = $("next-progress");
    if (due.r.type === "interval") {
      const intervalMs = Math.max(1, Number(due.r.intervalMinutes) || 20) * 60000;
      const progressPercent = due.at <= now + 1000 ? 100 : Math.max(0, Math.min(100, (1 - (due.at - now) / intervalMs) * 100));
      progress.classList.remove("hidden");
      progress.setAttribute("aria-valuenow", String(Math.round(progressPercent)));
      $("next-progress-fill").style.width = `${progressPercent}%`;
    } else {
      progress.classList.add("hidden");
      progress.setAttribute("aria-valuenow", "0");
      $("next-progress-fill").style.width = "0%";
    }
  } else {
    $("next-time").textContent = active.length ? "Ob obisku spletne strani" : "Dodajte prvi opomnik.";
    $("next-progress").classList.add("hidden");
    $("next-progress").setAttribute("aria-valuenow", "0");
    $("next-progress-fill").style.width = "0%";
  }

}

function formatSiteUsage(seconds) {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

function siteUsageForRule(rule, s, todayKey, now) {
  const usage = s.siteUsage?.[todayKey] || {};
  let seconds = Object.entries(usage).reduce((total, [host, value]) => (
    host === rule.host || host.endsWith(`.${rule.host}`) ? total + (Number(value) || 0) : total
  ), 0);
  const session = s.activeSiteSession;
  if (session?.host && (session.host === rule.host || session.host.endsWith(`.${rule.host}`))) {
    const lastSeen = Number(session.lastSeenAt || session.startedAt || now);
    const end = Math.min(now, lastSeen + 90000);
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const start = Math.max(Number(session.startedAt) || now, dayStart.getTime());
    if (end > start) seconds += Math.floor((end - start) / 1000);
  }
  return seconds;
}

function renderFocusRules(s, now = Date.now()) {
  const list = $("focus-list");
  const empty = $("focus-empty");
  const more = $("more-focus-rules");
  const rules = (s.settings?.blockRules || []).filter(rule => rule && rule.host);
  const enabledRules = rules.filter(rule => rule.enabled);
  const todayKey = localDateKey(new Date(now));
  $("site-state").textContent = enabledRules.length ? `${enabledRules.length} aktivnih` : "Prikaži";
  list.replaceChildren();
  empty.classList.toggle("hidden", rules.length > 0);

  const shownRules = [...rules].sort((a, b) => Number(b.enabled) - Number(a.enabled)).slice(0, 3);
  shownRules.forEach(rule => {
    const item = document.createElement("div");
    item.className = `focus-rule${rule.enabled ? "" : " disabled"}`;

    const icon = document.createElement("span");
    icon.className = "focus-rule-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = WebNudgeIcons.getSvg(rule.mode === "block" ? "window" : "clock");

    const copy = document.createElement("div");
    copy.className = "focus-rule-copy";
    const host = document.createElement("strong");
    host.textContent = rule.host;
    const description = document.createElement("span");
    let progressPercent = 0;
    if (rule.mode === "limit") {
      const usedSeconds = siteUsageForRule(rule, s, todayKey, now);
      const limitMinutes = Math.max(1, Number(rule.dailyLimitMinutes) || 30);
      description.textContent = `${formatSiteUsage(usedSeconds)} / ${limitMinutes} min danes${rule.enabled ? " · dnevna omejitev" : " · izklopljeno"}`;
      progressPercent = Math.min(100, usedSeconds / (limitMinutes * 60) * 100);
    } else {
      description.textContent = rule.enabled ? "Vedno blokirano" : "Blokada je izklopljena";
    }
    copy.style.cursor = "pointer";
    copy.title = "Odpri upravljanje omejitev";
    copy.addEventListener("click", () => openExtensionPage("options/options.html#focus").catch(reportActionError));
    copy.append(host, description);

    item.append(icon, copy);
    if (rule.mode === "limit") {
      const progress = document.createElement("span");
      progress.className = "focus-rule-progress";
      progress.setAttribute("role", "progressbar");
      progress.setAttribute("aria-label", `Dnevna kvota za ${rule.host}`);
      progress.setAttribute("aria-valuemin", "0");
      progress.setAttribute("aria-valuemax", "100");
      progress.setAttribute("aria-valuenow", String(Math.round(progressPercent)));
      const fill = document.createElement("span");
      fill.style.width = `${progressPercent}%`;
      progress.append(fill);
      item.append(progress);
    }
    list.append(item);
  });

  if (rules.length > shownRules.length) {
    more.textContent = `Prikazanih ${shownRules.length} od ${rules.length} pravil.`;
    more.classList.remove("hidden");
  } else {
    more.textContent = "";
    more.classList.add("hidden");
  }
}

async function refreshCountdowns() {
  if (countdownRefreshPending) return;
  countdownRefreshPending = true;
  try {
    updateCountdowns(await getState());
  } catch (error) {
    console.error("Odštevanja opomnikov ni bilo mogoče osvežiti.", error);
    showStateError(error);
  } finally {
    countdownRefreshPending = false;
  }
}

function showStateError(error) {
  const message = error?.message || "Podatkov dodatka ni bilo mogoče naložiti.";
  $("state-error-message").textContent = `${message} Poskusite znova.`;
  $("state-error").classList.remove("hidden");
  $("next-name").textContent = "Opomniki niso na voljo";
  $("next-time").textContent = "Preverite povezavo z dodatkom.";
  $("reminder-list").replaceChildren();
  $("empty").classList.add("hidden");
}

async function render() {
  let s;
  try {
    s = await getState();
  } catch (error) {
    console.error("Pojavnega okna ni bilo mogoče naložiti.", error);
    showStateError(error);
    return;
  }
  $("state-error").classList.add("hidden");
  WebNudgeAppearance.apply(s.settings || {});
  const now = Date.now();
  const active = (s.reminders || []).filter(r => r.enabled);
  renderFocusRules(s, now);

  const pauseBtn = $("pause-all");
  const hasActive = active.length > 0;
  const hasReminders = (s.reminders || []).length > 0;
  const toggleLabel = hasReminders ? (hasActive ? "Izklopi opomnike" : "Vklopi opomnike") : "Ni opomnikov";
  pauseBtn.innerHTML = `${hasActive
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="7 4 20 12 7 20 7 4"/></svg>'}<span>${toggleLabel}</span>`;
  pauseBtn.disabled = !hasReminders;
  pauseBtn.setAttribute("aria-label", hasReminders
    ? (hasActive ? "Izklopi vse opomnike" : "Vklopi vse opomnike")
    : "Ni opomnikov za vklop");

  const list = $("reminder-list");
  const shown = active.slice(0, 5);
  const more = $("more-reminders");
  $("empty").classList.toggle("hidden", shown.length !== 0);
  if (active.length > shown.length) {
    more.textContent = `Prikazanih ${shown.length} od ${active.length} aktivnih opomnikov.`;
    more.classList.remove("hidden");
  } else {
    more.classList.add("hidden");
    more.textContent = "";
  }
  list.replaceChildren();

  shown.forEach(r => {
    const item = document.createElement("div");
    item.className = "reminder";

    const icon = document.createElement("div");
    icon.className = "r-icon";
    icon.setAttribute("aria-hidden", "true");
    if (typeof WebNudgeIcons !== "undefined") {
      icon.innerHTML = WebNudgeIcons.getSvg(r.icon || "bell");
    } else {
      icon.textContent = "●";
    }

    const main = document.createElement("button");
    main.className = "r-main";
    main.type = "button";
    const strong = document.createElement("strong");
    strong.textContent = r.name;

    const metaRow = document.createElement("span");
    metaRow.className = "r-meta-row";

    const span = document.createElement("span");
    span.className = "r-label-text";
    span.textContent = label(r);
    metaRow.appendChild(span);

    main.style.cursor = "pointer";
    main.title = `Uredi opomnik »${r.name}«`;
    main.addEventListener("click", () => openExtensionPage(`options/options.html#reminder/edit?id=${encodeURIComponent(r.id)}`).catch(reportActionError));
    main.append(strong, metaRow);

    const actions = document.createElement("div");
    actions.className = "r-actions";

    const runBtn = document.createElement("button");
    runBtn.className = "tiny-action run";
    runBtn.type = "button";
    runBtn.title = "Prikaži zdaj";
    runBtn.setAttribute("aria-label", `Prikaži ${r.name} zdaj`);
    runBtn.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    runBtn.addEventListener("click", () => runUiAction(async () => {
      const result = await browser.runtime.sendMessage({ type: "TRIGGER_REMINDER_NOW", id: r.id });
      if (result?.ok === false || result?.error) throw new Error(result.error || "Opomnika ni bilo mogoče prikazati.");
      showToast(result?.shown === false ? "Kanal trenutno ni na voljo." : "Predogled opomnika je prikazan.");
    }));

    const switchBtn = document.createElement("button");
    switchBtn.className = "switch on";
    switchBtn.type = "button";
    switchBtn.setAttribute("aria-pressed", "true");
    switchBtn.setAttribute("aria-label", `Izklopi ${r.name}`);
    const switchSpan = document.createElement("span");
    switchBtn.appendChild(switchSpan);
    switchBtn.addEventListener("click", () => runUiAction(async () => {
      const result = await browser.runtime.sendMessage({ type: "SET_REMINDER_ENABLED", id: r.id, enabled: false });
      if (result?.ok === false) throw new Error(result.error || "Opomnika ni bilo mogoče izklopiti.");
      await render();
    }));

    actions.append(runBtn, switchBtn);
    item.append(icon, main, actions);
    list.appendChild(item);
  });

  if (typeof browser !== "undefined" && browser.tabs) {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      $("current-site").textContent = hostFromUrl(tabs[0]?.url || "") || "Ni na voljo";
    } catch {
      $("current-site").textContent = "Ni na voljo";
    }
  }
  $("enable-site").textContent = s.settings?.siteTrackingEnabled ? "Onemogoči spremljanje" : "Omogoči spremljanje";
  updateCountdowns(s, now);

  // Osveži samo odštevanje; ponovna izgradnja seznama bi premaknila fokus tipkovnice.
  if (!popupTimer) {
    popupTimer = setInterval(refreshCountdowns, 1000);
  }
}
async function runUiAction(action) {
  try {
    await action();
  } catch (error) {
    reportActionError(error);
  }
}

$("new-reminder")?.addEventListener("click", () => openExtensionPage("options/options.html#reminder/new").catch(reportActionError));
$("manage-focus")?.addEventListener("click", () => openExtensionPage("options/options.html#focus").catch(reportActionError));
$("add-focus")?.addEventListener("click", () => openExtensionPage("options/options.html#focus/new").catch(reportActionError));
$("open-manage")?.addEventListener("click", () => openExtensionPage("options/options.html#reminders").catch(reportActionError));
$("retry-state")?.addEventListener("click", () => runUiAction(render));
$("open-settings")?.addEventListener("click", () => runUiAction(() => browser.runtime.openOptionsPage()));
$("pause-all")?.addEventListener("click", () => runUiAction(async () => { const s = await getState(); const enabling = !s.reminders.some(r => r.enabled); const result = await browser.runtime.sendMessage({ type: "SET_ALL_ENABLED", enabled: enabling }); if (result?.ok === false) throw new Error(result.error || "Opomnikov ni bilo mogoče spremeniti."); showToast(enabling ? "Vsi opomniki so vključeni." : "Vsi opomniki so izklopljeni."); await render(); }));
$("enable-site")?.addEventListener("click", () => runUiAction(async () => {
  const s = await getState();
  if (s.settings.siteTrackingEnabled) { await browser.runtime.sendMessage({ type: "DISABLE_SITE_TRACKING" }); await render(); return; }
  const result = await browser.runtime.sendMessage({ type: "ENABLE_SITE_TRACKING" });
  if (result?.needsPermission) {
    try { const granted = await browser.permissions.request({ origins: result.origins || [] }); if (!granted) { showToast("Dovoljenja niso bila odobrena."); return; } } catch { showToast("Dovoljenj ni bilo mogoče zahtevati."); return; }
    const retry = await browser.runtime.sendMessage({ type: "ENABLE_SITE_TRACKING" }); if (retry?.ok === false) { showToast(retry.error || "Spremljanje ni bilo mogoče vključiti."); return; }
  } else if (result?.ok === false) { showToast(result.error || "Spremljanje ni bilo mogoče vključiti."); return; }
  await render();
}));
document.querySelectorAll(".quick-buttons button").forEach(button => {
  button.addEventListener("click", () => runUiAction(() => quickAdd(Number(button.dataset.minutes), button.dataset.icon || "bell")));
});
if (typeof browser !== "undefined" && browser.storage?.onChanged) {
  browser.storage.onChanged.addListener(() => render());
}
render();
