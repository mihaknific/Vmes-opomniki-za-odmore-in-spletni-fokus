const params = new URLSearchParams(location.search);
const id = params.get("reminder");
const isTest = params.get("test") === "1";
const snoozeMinutes = Number(params.get("snooze")) || 5;

async function getState() {
  if (typeof browser !== "undefined" && browser.runtime?.sendMessage) {
    try {
      const res = await browser.runtime.sendMessage({ type: "GET_STATE" });
      if (res) return res;
    } catch {}
  }
  return {
    settings: { theme: "forest", sound: true, soundName: "soft-click", soundVolume: 0.55, notificationDuration: 8 },
    reminders: [
      { id: "demo-1", name: "Odmor za oči", message: "Poglejte 20 sekund v daljavo za sprostitev oči.", snoozeEnabled: true, soundName: "soft-click" }
    ]
  };
}

function playSound(settings, reminder) {
  if (!settings?.sound) return;
  const soundName = (reminder?.soundName && reminder.soundName !== "default")
    ? reminder.soundName
    : (settings.soundName || "chime");
  const volume = Number(settings.soundVolume) || 0.55;

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
    gain.gain.setValueAtTime(Math.max(0.001, volume), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
  } catch {}
}

let closeTimer = null;

async function finish(action, extra = {}) {
  if (closeTimer) clearTimeout(closeTimer);
  if (id && !isTest) await browser.runtime.sendMessage({ type: "REMINDER_ACTION", reminderId: id, action, ...extra });
  window.close();
}

async function load() {
  const s = await getState();
  WebNudgeAppearance.apply(s?.settings || {});
  const r = s.reminders.find(x => x.id === id);
  const snooze = document.getElementById("snooze");
  if (isTest) {
    document.getElementById("title").textContent = "Preizkusno obvestilo";
    document.getElementById("message").textContent = "To je predogled obvestila Spletnega opomnika.";
  } else if (r) {
    document.getElementById("title").textContent = r.name || "Opomnik";
    document.getElementById("message").textContent = r.message || "Čas je za opomnik.";
    const image = document.getElementById("reminder-image");
    if (r.imageData) { image.src = r.imageData; image.alt = r.name || "Slika opomnika"; image.classList.remove("hidden"); }
    snooze.hidden = r.snoozeEnabled === false;
    const doneBtn = document.getElementById("done");
    if (r.actionType && r.actionType !== "none") {
      const labels = {
        breathing: "Začni dihalno vajo",
        eyes: "Začni vajo za oči",
        stretches: "Odpri vaje med sedenjem",
        url: "Odpri spletno stran"
      };
      doneBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:6px"><polygon points="5 3 19 12 5 21 5 3"/></svg>${labels[r.actionType] || "Začni"}`;
    }
  } else {
    document.getElementById("title").textContent = "Preizkusno obvestilo";
    document.getElementById("message").textContent = "To je predogled obvestila Spletnega opomnika.";
  }
  snooze.textContent = `Odloži (${snoozeMinutes} min)`;
  playSound(s.settings, r);
  document.getElementById("done").focus();
  if (!isTest) {
    const duration = Math.max(3, Math.min(60, Number(s.settings?.notificationDuration) || 8));
    const bar = document.getElementById("progress-bar");
    bar.style.transition = `transform ${duration}s linear`;
    requestAnimationFrame(() => { bar.style.transform = "scaleX(0)"; });
    closeTimer = window.setTimeout(() => finish("timeout"), duration * 1000);
  }
}

document.getElementById("done").onclick = () => finish("completed");

document.getElementById("snooze").onclick = async () => {
  if (closeTimer) clearTimeout(closeTimer);
  if (id && !isTest) await browser.runtime.sendMessage({ type: "SNOOZE", id, minutes: snoozeMinutes });
  window.close();
};

document.getElementById("close").onclick = () => finish("dismissed");

document.addEventListener("keydown", event => {
  if (event.key === "Escape") finish("dismissed");
});

load();
