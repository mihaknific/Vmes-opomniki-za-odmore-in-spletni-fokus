(() => {
  if (typeof browser !== "undefined" && browser.storage?.local) {
    browser.storage.local.get("settings").then(data => {
      if (data?.settings && typeof WebNudgeAppearance !== "undefined") {
        WebNudgeAppearance.apply(data.settings);
      }
    });

    browser.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.settings?.newValue && typeof WebNudgeAppearance !== "undefined") {
        WebNudgeAppearance.apply(changes.settings.newValue);
      }
    });
  }

  const params = new URLSearchParams(window.location.search);
  const host = params.get("host") || "";
  const reason = params.get("reason") || "blocked";
  const spentSeconds = Number(params.get("spent") || 0);
  const limitMinutes = Number(params.get("limit") || 0);

  const blockDomain = document.getElementById("block-domain");
  const blockTitle = document.getElementById("block-title");
  const blockBadge = document.getElementById("block-badge");
  const blockReason = document.getElementById("block-reason");
  const spentSpan = document.getElementById("time-spent-today");
  const limitBox = document.getElementById("limit-stat-box");
  const limitVal = document.getElementById("time-limit-val");

  if (blockDomain) blockDomain.textContent = host || "Spletna stran";

  const spentMinutes = Math.round(spentSeconds / 60);
  if (spentSpan) spentSpan.textContent = spentMinutes >= 60 ? `${Math.floor(spentMinutes / 60)} h ${spentMinutes % 60} min` : `${spentMinutes} min`;

  if (reason === "limit") {
    if (blockBadge) blockBadge.textContent = "Dnevna omejitev dosežena";
    if (blockTitle) blockTitle.textContent = "Časovna omejitev je potekla";
    if (blockReason) blockReason.textContent = `Danes ste za stran »${host}« že porabili vso predvideno časovno kvoto (${limitMinutes} min). Vzemite si odmor ali se posvetite drugim nalogam.`;
    if (limitBox) {
      limitBox.style.display = "flex";
      if (limitVal) limitVal.textContent = `${limitMinutes} min`;
    }
  } else {
    if (blockBadge) blockBadge.textContent = "Prepovedana stran (Fokus)";
    if (blockTitle) blockTitle.textContent = "Dostop do te strani je onemogočen";
    if (blockReason) blockReason.textContent = `Spletna stran »${host}« je uvrščena med vaše prepovedane strani za večjo produktivnost in osredotočenost.`;
  }

  const quotes = [
    { text: "»Kjer je vaša pozornost, tam teče vaša energija.«", author: "Tony Robbins" },
    { text: "»Osredotočenost je odločitev, čemu se boš odrekel.«", author: "Steve Jobs" },
    { text: "»Globoko delo je sposobnost, da se brez motenj osredotočiš na zahtevno nalogo.«", author: "Cal Newport" },
    { text: "»Najdragocenejši vir ni tvoj čas, temveč tvoja osredotočenost.«", author: "Spodbuda za fokus" },
    { text: "»Vsak trenutek, ko se upreš motnji, krepiš svojo voljo.«", author: "Navdih za danes" }
  ];
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  const quoteText = document.getElementById("quote-text");
  const quoteAuthor = document.getElementById("quote-author");
  if (quoteText) quoteText.textContent = randomQuote.text;
  if (quoteAuthor) quoteAuthor.textContent = `— ${randomQuote.author}`;

  document.getElementById("open-settings-btn")?.addEventListener("click", () => {
    browser.runtime.openOptionsPage().catch(() => {
      window.open(browser.runtime.getURL("options/options.html#focus"), "_blank");
    });
  });

  document.getElementById("start-breathing-btn")?.addEventListener("click", () => {
    window.location.href = browser.runtime.getURL("exercises/breathing.html");
  });

  document.getElementById("snooze-site-btn")?.addEventListener("click", async () => {
    if (host && typeof browser !== "undefined" && browser.runtime) {
      const button = document.getElementById("snooze-site-btn");
      if (button) button.disabled = true;
      try {
        const response = await browser.runtime.sendMessage({ type: "PAUSE_SITE_LIMIT", host, minutes: 5 });
        if (response?.ok) {
          window.location.href = `https://${host}`;
        } else {
          if (blockReason) blockReason.textContent = response?.error || "Podaljšanja trenutno ni mogoče vključiti.";
          if (button) button.disabled = false;
        }
      } catch (error) {
        if (blockReason) blockReason.textContent = error?.message || "Podaljšanja trenutno ni mogoče vključiti.";
        if (button) button.disabled = false;
      }
    } else {
      window.closeExerciseTab();
    }
  });
})();
