(() => {
  const HOST_ID = "web-nudge-shadow-host";
  let timer = null;

  function esc(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function playSound(name, volume) {
    if (name === "none" || name === "off") return;
    if (typeof WebNudgeSounds !== "undefined") {
      WebNudgeSounds.play(name, volume);
      return;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const vol = Math.max(0.001, Math.min(1, Number(volume) || 0.5));
      const now = ctx.currentTime;

      if (name === "water-drop") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.16);
        gain.gain.setValueAtTime(vol * 0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.24);
        return;
      }

      if (name === "digital") {
        [987.77, 1318.51].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = now + (idx * 0.07);
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(vol * 0.7, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t); osc.stop(t + 0.16);
        });
        return;
      }

      if (name === "relax") {
        [220, 440, 660, 880].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(vol * 0.4 * (1 / (idx + 1)), now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now); osc.stop(now + 0.95);
        });
        return;
      }

      const freqs = name === "marimba"
        ? [329.63, 440, 523.25, 659.25]
        : (name === "gentle-bell" || name === "soft")
          ? [440, 554.37, 659.25]
          : [523.25, 659.25, 783.99, 1046.50];

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + (idx * 0.08);
        osc.type = name === "marimba" ? "sine" : "triangle";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(vol * 0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t); osc.stop(t + 0.38);
      });
    } catch {}
  }

  let activeEscHandler = null;

  function close() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (activeEscHandler) {
      window.removeEventListener("keydown", activeEscHandler, true);
      activeEscHandler = null;
    }
    document.getElementById(HOST_ID)?.remove();
  }

  function show(reminder, options = {}) {
    close();
    const host = document.createElement("div");
    host.id = HOST_ID;
    host.dataset.reminderId = reminder.id;
    host.style.all = "initial";
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    const googleSansUrl = browser.runtime.getURL("fonts/GoogleSans-Variable.ttf");
    const googleSansItalicUrl = browser.runtime.getURL("fonts/GoogleSans-Italic-Variable.ttf");
    style.textContent = `
      @font-face { font-family: 'Google Sans'; font-style: normal; font-weight: 100 900; font-display: swap; src: url("${googleSansUrl}") format("truetype"); }
      @font-face { font-family: 'Google Sans'; font-style: italic; font-weight: 100 900; font-display: swap; src: url("${googleSansItalicUrl}") format("truetype"); }
      :host { all: initial; }
      .wrap { position: fixed; inset: auto 22px 22px auto; z-index: 2147483647; font: 14px/1.45 'Google Sans',"Segoe UI",sans-serif; color: #253832; }
      .card { width: min(410px, calc(100vw - 44px)); box-sizing: border-box; padding: 20px; background: #fff; border: 1px solid #dce7dc; border-radius: 18px; box-shadow: 0 20px 65px rgba(20,40,32,.18); }
      .reminder-image { width: 100%; max-height: 160px; object-fit: cover; border-radius: 12px; margin: 0 0 14px; display: block; }
      .close { float:right; width:36px; height:36px; border:0; background:transparent; color:#777; font-size:24px; cursor:pointer; border-radius:9px; transition: background .15s ease, color .15s ease; }
      .close:hover { background: #e1f1e7; color: #253832; }
      .close:focus-visible, button:focus-visible { outline: 3px solid rgba(38,124,104,.35); outline-offset:2px; }
      .meta { display:flex; gap:8px; align-items:center; color:#267c68; font-size:9px; font-weight:800; letter-spacing:.14em; margin-bottom:12px; }
      .dot { width:20px; height:20px; border-radius:7px; background:linear-gradient(135deg,#3b9c84,#267c68); display:inline-block; }
      h2 { margin:0 40px 7px 0; font-size:18px; line-height:1.2; font-weight: 700; letter-spacing: -0.015em; }
      p { margin:0 0 17px; color:#63736b; line-height: 1.5; }
      .actions { display:flex; gap:8px; flex-wrap:wrap; }
      button.action { border-radius:10px; padding:10px 14px; font:inherit; font-weight: 650; cursor:pointer; transition: all .16s ease; }
      .primary { background:#267c68; border:1px solid #267c68; color:#fff; box-shadow: 0 4px 12px rgba(38,124,104,.22); }
      .primary:hover { background:#1d6251; border-color:#1d6251; transform: translateY(-1px); }
      .secondary { background:#fff; border:1px solid #dce7dc; color:#253832; }
      .secondary:hover { background:#edf3e9; border-color:#c5dacf; transform: translateY(-1px); }
      @media (prefers-color-scheme: dark) { .card{background:#192521;color:#f1f5f2;border-color:#33473e} p{color:#aab9b1}.secondary{background:#25342e;border-color:#42574c;color:#eef5f0}.secondary:hover{background:#304239}.close{color:#aab9b1}.close:hover{background:#2d4037;color:#fff} }
    `;

    const wrap = document.createElement("div");
    wrap.className = "wrap";
    const card = document.createElement("section");
    card.className = "card";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "true");
    card.setAttribute("aria-labelledby", "title");

    const closeBtn = document.createElement("button");
    closeBtn.className = "close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Zapri");
    closeBtn.textContent = "×";

    const meta = document.createElement("div");
    meta.className = "meta";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.setAttribute("aria-hidden", "true");
    const metaText = document.createElement("span");
    metaText.textContent = "SPLETNI OPOMNIK";
    meta.append(dot, metaText);

    card.append(closeBtn, meta);

    if (reminder.imageData) {
      const img = document.createElement("img");
      img.className = "reminder-image";
      img.src = reminder.imageData;
      img.alt = reminder.name || "Slika opomnika";
      card.appendChild(img);
    }

    const h2 = document.createElement("h2");
    h2.id = "title";
    h2.textContent = reminder.name || "Opomnik";

    const p = document.createElement("p");
    p.textContent = reminder.message || "Čas je za opomnik.";

    const actions = document.createElement("div");
    actions.className = "actions";

    const doneBtn = document.createElement("button");
    doneBtn.className = "action primary";
    doneBtn.dataset.action = "done";
    doneBtn.type = "button";
    if (reminder.actionType && reminder.actionType !== "none") {
      const labels = {
        breathing: "Začni dihalno vajo",
        eyes: "Začni vajo za oči",
        stretches: "Odpri vaje med sedenjem",
        url: "Odpri spletno stran"
      };
      doneBtn.textContent = labels[reminder.actionType] || "Začni";
    } else {
      doneBtn.textContent = "Zaključeno";
    }
    actions.appendChild(doneBtn);

    if (options.snoozeEnabled !== false) {
      const snoozeBtn = document.createElement("button");
      snoozeBtn.className = "action secondary";
      snoozeBtn.dataset.action = "snooze";
      snoozeBtn.type = "button";
      snoozeBtn.textContent = `Odloži (${Number(options.snooze) || 5} min)`;
      actions.appendChild(snoozeBtn);
    }

    card.append(h2, p, actions);
    wrap.appendChild(card);
    shadow.append(style, wrap);

    if (options.sound) playSound(options.soundName, options.soundVolume);
    shadow.querySelector(".close")?.addEventListener("click", async () => { await browser.runtime.sendMessage({ type: "DISMISS_REMINDER", reminderId: reminder.id }); close(); });
    shadow.querySelector('[data-action="done"]')?.addEventListener("click", async () => { await browser.runtime.sendMessage({ type: "REMINDER_ACTION", reminderId: reminder.id, action: "completed" }); close(); });
    shadow.querySelector('[data-action="snooze"]')?.addEventListener("click", async () => { await browser.runtime.sendMessage({ type: "SNOOZE", id: reminder.id, minutes: Number(options.snooze) || 5 }); close(); });
    shadow.querySelector('[data-action="done"]')?.focus();
    activeEscHandler = event => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        browser.runtime.sendMessage({ type: "DISMISS_REMINDER", reminderId: reminder.id });
        close();
      }
    };
    window.addEventListener("keydown", activeEscHandler, true);

    const duration = Math.max(3, Number(options.duration) || 8);
    timer = window.setTimeout(async () => { await browser.runtime.sendMessage({ type: "REMINDER_ACTION", reminderId: reminder.id, action: "timeout" }); close(); }, duration * 1000);
  }

  browser.runtime.onMessage.addListener(message => {
    if (message?.type === "SHOW_IN_PAGE_REMINDER") show(message.reminder, message.options);
    if (message?.type === "HIDE_IN_PAGE_REMINDER") {
      const current = document.getElementById(HOST_ID);
      if (current && (!message.reminderId || current.dataset.reminderId === message.reminderId)) close();
    }
  });
})();
