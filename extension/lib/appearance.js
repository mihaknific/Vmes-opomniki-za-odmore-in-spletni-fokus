(() => {
  const darkPalettes = new Set(["mono-dark", "dark-color", "ocean", "cyber", "synth"]);
  const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)");
  const customProperties = [
    "--bg", "--surface", "--surface-soft", "--surface-alt", "--surface-card", "--text", "--text-main",
    "--muted", "--text-muted", "--text-subtle", "--border", "--border-subtle", "--accent", "--accent-dark",
    "--accent-light", "--accent-soft", "--accent-glow", "--primary", "--primary-hover", "--primary-soft",
    "--primary-border", "--primary-shadow", "--primary-shadow-hover", "--surface-subtle", "--hero-border",
    "--hero-from", "--hero-to", "--badge-bg", "--progress-track", "--paper", "--ink", "--page",
    "--page-bg", "--text-color"
  ];
  let activeSettings = {};

  function applyCustomColors(target, colors) {
    const background = colors.background;
    const surface = colors.surface;
    const accent = colors.accent;
    const text = colors.text;
    const muted = colors.muted;
    const border = colors.border;
    const soft = `color-mix(in srgb, ${accent} 10%, ${surface})`;
    const accentDark = `color-mix(in srgb, ${accent} 82%, #000)`;
    const accentLight = `color-mix(in srgb, ${accent} 70%, #fff)`;

    for (const property of customProperties) target.style.removeProperty(property);
    for (const [property, value] of Object.entries({
      "--bg": background,
      "--surface": surface,
      "--surface-soft": soft,
      "--surface-alt": background,
      "--surface-card": surface,
      "--text": text,
      "--text-main": text,
      "--muted": muted,
      "--text-muted": muted,
      "--text-subtle": muted,
      "--border": border,
      "--border-subtle": border,
      "--accent": accent,
      "--accent-dark": accentDark,
      "--accent-light": accentLight,
      "--accent-soft": soft,
      "--accent-glow": `color-mix(in srgb, ${accent} 26%, transparent)`,
      "--primary": accent,
      "--primary-hover": accentDark,
      "--primary-soft": soft,
      "--primary-border": border,
      "--primary-shadow": `color-mix(in srgb, ${accent} 18%, transparent)`,
      "--primary-shadow-hover": `color-mix(in srgb, ${accent} 28%, transparent)`,
      "--surface-subtle": soft,
      "--hero-border": border,
      "--hero-from": surface,
      "--hero-to": soft,
      "--badge-bg": soft,
      "--progress-track": border,
      "--paper": background,
      "--ink": text,
      "--page": background,
      "--page-bg": background,
      "--text-color": text
    })) {
      target.style.setProperty(property, value);
    }
  }

  function apply(settings = {}, target = document.body) {
    activeSettings = settings;
    const palette = ["color", "light"].includes(settings.theme) ? "mono" : (settings.theme || "forest");
    const basePalette = palette === "custom" ? (settings.customThemeBase || "forest") : palette;
    const dark = basePalette === "system" ? Boolean(systemDark?.matches) : darkPalettes.has(basePalette);
    target.dataset.theme = dark ? "dark" : "light";
    target.dataset.palette = palette;
    target.dataset.fontFamily = settings.fontFamily || "system";
    target.dataset.fontSize = settings.fontSize || "standard";
    if (palette === "custom" && settings.customColors) applyCustomColors(target, settings.customColors);
    else for (const property of customProperties) target.style.removeProperty(property);
  }

  systemDark?.addEventListener?.("change", () => {
    if (activeSettings.theme === "system") apply(activeSettings);
  });

  globalThis.WebNudgeAppearance = Object.freeze({ apply });
})();
