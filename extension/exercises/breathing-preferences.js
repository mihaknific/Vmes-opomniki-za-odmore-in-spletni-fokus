(() => {
  const FORMAT = "vmes-breathing-preferences";
  const VERSION = 1;
  const PREFERENCE_KEYS = [
    "figureColor", "glow", "appearance", "tempo", "technique", "shape", "visualStyle",
    "motif", "backgroundMode", "soundMode", "soundStyle", "soundVolume",
    "words", "duration", "phases"
  ];
  const ENUMS = {
    figureColor: ["theme", "red", "orange", "amber", "coral", "teal", "pink", "blue", "green", "violet", "yellow", "mint", "sky", "lavender", "fuchsia"],
    appearance: ["color", "lagoon", "forest", "sunset", "mono", "mono-dark", "dark-color", "ocean", "cyber", "synth", "system"],
    technique: ["box", "relax", "coherent", "sigh", "wimhof", "pursed", "nadi", "ujjayi", "belly", "buteyko", "tummo", "fire", "custom"],
    shape: ["circle", "square", "oval", "blob"],
    visualStyle: ["grow", "fill", "duotone", "rings", "ripple", "none"],
    motif: ["none", "monk-orange", "monk-gold", "meditator-woman"],
    backgroundMode: ["breath", "orbit", "combined", "center", "still", "off"],
    soundMode: ["off", "cues", "ambience", "both"],
    soundStyle: ["glass", "warm", "drop", "air"],
    duration: ["60000", "180000", "300000", "infinite"]
  };
  const PHASE_RANGES = {
    inhale: [0.5, 15],
    holdIn: [0, 15],
    exhale: [0.5, 15],
    holdOut: [0, 15]
  };

  function hasOnlyKeys(value, keys) {
    return value !== null
      && typeof value === "object"
      && !Array.isArray(value)
      && Object.keys(value).length === keys.length
      && keys.every(key => Object.hasOwn(value, key));
  }

  function isSteppedNumber(value, min, max, step) {
    if (!Number.isFinite(value) || value < min || value > max) return false;
    return Math.abs((value - min) / step - Math.round((value - min) / step)) < 1e-8;
  }

  function validatePreferences(preferences) {
    const legacyPreferenceKeys = PREFERENCE_KEYS.filter(key => key !== "glow");
    const hasCurrentShape = hasOnlyKeys(preferences, PREFERENCE_KEYS);
    const hasLegacyShape = hasOnlyKeys(preferences, legacyPreferenceKeys);
    if (!hasCurrentShape && !hasLegacyShape) {
      throw new Error("Datoteka nima pričakovane strukture nastavitev.");
    }
    const normalizedPreferences = { ...preferences, glow: preferences.glow ?? true };
    if (typeof normalizedPreferences.glow !== "boolean") {
      throw new Error("Nastavitev barvnega sija v datoteki ni veljavna.");
    }
    for (const [key, values] of Object.entries(ENUMS)) {
      if (!values.includes(normalizedPreferences[key])) throw new Error(`Neveljavna vrednost nastavitve »${key}«.`);
    }
    if (!isSteppedNumber(normalizedPreferences.tempo, 0.5, 1.5, 0.1)) {
      throw new Error("Hitrost dihanja v datoteki ni veljavna.");
    }
    if (!isSteppedNumber(normalizedPreferences.soundVolume, 0, 60, 5)) {
      throw new Error("Glasnost zvoka v datoteki ni veljavna.");
    }
    if (typeof normalizedPreferences.words !== "boolean") {
      throw new Error("Nastavitev prikaza besedila v datoteki ni veljavna.");
    }
    if (!hasOnlyKeys(normalizedPreferences.phases, Object.keys(PHASE_RANGES))) {
      throw new Error("Datoteka nima veljavnih časov dihalnih faz.");
    }
    for (const [phase, [min, max]] of Object.entries(PHASE_RANGES)) {
      if (!isSteppedNumber(normalizedPreferences.phases[phase], min, max, 0.5)) {
        throw new Error(`Čas faze »${phase}« v datoteki ni veljaven.`);
      }
    }
    return {
      ...normalizedPreferences,
      phases: { ...normalizedPreferences.phases }
    };
  }

  function createBackup(preferences) {
    const portablePreferences = Object.fromEntries(PREFERENCE_KEYS.map(key => [key, preferences[key]]));
    const validatedPreferences = validatePreferences(portablePreferences);
    return {
      format: FORMAT,
      version: VERSION,
      preferences: validatedPreferences
    };
  }

  function parseBackup(value) {
    if (!hasOnlyKeys(value, ["format", "version", "preferences"])
      || value.format !== FORMAT
      || value.version !== VERSION) {
      throw new Error("Datoteka ni podprta varnostna kopija nastavitev Vmes.");
    }
    return validatePreferences(value.preferences);
  }

  window.WebNudgeBreathingPreferences = Object.freeze({ createBackup, parseBackup });
})();
