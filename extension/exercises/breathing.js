(() => {
  let extensionAppearanceSettings = null;
  const breathingPreferenceKey = "vmesBreathingPreferences";
  const breathingPreferencesCodec = window.WebNudgeBreathingPreferences;
  if (!breathingPreferencesCodec) throw new Error("Manjka podpora za prenos nastavitev dihalne vaje.");

  function applyExtensionAppearance(settings) {
    extensionAppearanceSettings = settings;
    WebNudgeAppearance.apply(settings);
    if (typeof applyExerciseAppearance === "function") applyExerciseAppearance();
  }

  if (typeof browser !== "undefined" && browser.storage?.local) {
    browser.storage.local.get("settings").then(data => {
      if (data?.settings && typeof WebNudgeAppearance !== "undefined") {
        applyExtensionAppearance(data.settings);
      }
    }).catch(error => console.error("Nastavitev videza razširitve ni bilo mogoče naložiti:", error));

    browser.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.settings?.newValue && typeof WebNudgeAppearance !== "undefined") {
        applyExtensionAppearance(changes.settings.newValue);
      }
    });
  }

  const TECHNIQUES = {
    box: {
      description: "Štiri enako dolge faze: vdih, zadržanje, izdih in zadržanje.",
      steps: [
        { key: "inhale", name: "Vdih", duration: 4, scale: 1.04 },
        { key: "holdIn", name: "Zadrži dih", duration: 4, scale: 1.04 },
        { key: "exhale", name: "Izdih", duration: 4, scale: 0.78 },
        { key: "holdOut", name: "Zadrži dih", duration: 4, scale: 0.78 }
      ]
    },
    relax: {
      description: "Vdih 4 s, udoben premor 7 s in počasen izdih 8 s.",
      steps: [
        { key: "inhale", name: "Vdih", duration: 4, scale: 1.04 },
        { key: "holdIn", name: "Zadrži dih", duration: 7, scale: 1.04 },
        { key: "exhale", name: "Izdih", duration: 8, scale: 0.78 }
      ]
    },
    coherent: {
      description: "Enakomeren vdih in izdih po 5,5 s, brez zadrževanja.",
      steps: [
        { key: "inhale", name: "Vdih", duration: 5.5, scale: 1.04 },
        { key: "exhale", name: "Izdih", duration: 5.5, scale: 0.78 }
      ]
    },
    sigh: {
      description: "Dva nežna vdiha zapored, dolg izdih in kratek udoben premor.",
      steps: [
        { key: "inhale", name: "Vdih", duration: 2.5, scale: 0.96 },
        { key: "inhaleAgain", name: "Še en vdih", duration: 1.5, scale: 1.04 },
        { key: "exhale", name: "Izdih", duration: 6, scale: 0.78 },
        { key: "holdOut", name: "Sproščen premor", duration: 1, scale: 0.78 }
      ]
    },
    wimhof: {
      description: "3 krogi po 30 vdihov z lastnim premorom med krogi; brez zadrževanja. Samo sede ali leže, nikoli med vožnjo ali v vodi. Ob nelagodju prenehaj.",
      rounds: 3,
      breathsPerRound: 30,
      steps: [
        { key: "inhale", name: "Vdih", duration: 1.5, scale: 1.04 },
        { key: "exhale", name: "Izdih", duration: 1.5, scale: 0.78 }
      ]
    },
    pursed: {
      description: "Nežen vdih skozi nos, nato daljši izdih skozi priprte ustnice.",
      steps: [
        { key: "inhale", name: "Vdih skozi nos", duration: 2, scale: 1.04 },
        { key: "exhale", name: "Izdih skozi priprte ustnice", duration: 4, scale: 0.78 }
      ]
    },
    nadi: {
      description: "Po navodilih izmenjuj nosnici; če ti ne ustreza, dihaj običajno.",
      steps: [
        { key: "inhale", name: "Vdih skozi levo nosnico", duration: 4, scale: 1.04 },
        { key: "holdIn", name: "Zadrži dih", duration: 4, scale: 1.04 },
        { key: "exhale", name: "Izdih skozi desno nosnico", duration: 4, scale: 0.78 },
        { key: "inhale", name: "Vdih skozi desno nosnico", duration: 4, scale: 1.04 },
        { key: "holdIn", name: "Zadrži dih", duration: 4, scale: 1.04 },
        { key: "exhale", name: "Izdih skozi levo nosnico", duration: 4, scale: 0.78 }
      ]
    },
    ujjayi: {
      description: "Mirno dihaj 4 s noter in 6 s ven; zvok v grlu naj bo komaj slišen.",
      steps: [
        { key: "inhale", name: "Nežen vdih", duration: 4, scale: 1.04 },
        { key: "exhale", name: "Nežen izdih", duration: 6, scale: 0.78 }
      ]
    },
    belly: {
      description: "Ob vdihu naj se trebuh nežno dvigne, ob izdihu sprosti.",
      steps: [
        { key: "inhale", name: "Vdih v trebuh", duration: 4, scale: 1.04 },
        { key: "exhale", name: "Izdih", duration: 6, scale: 0.78 }
      ]
    },
    buteyko: {
      description: "Kratek, lahek nosni vdih in izdih ter udoben premor po izdihu.",
      steps: [
        { key: "inhale", name: "Lahek vdih skozi nos", duration: 3, scale: 1.04 },
        { key: "exhale", name: "Lahek izdih skozi nos", duration: 3, scale: 0.78 },
        { key: "holdOut", name: "Udoben premor", duration: 3, scale: 0.78 }
      ]
    },
    tummo: {
      description: "Kratek ritmičen vdih in izdih; dodatnega zadrževanja ne dodajamo.",
      steps: [
        { key: "inhale", name: "Vdih", duration: 2, scale: 1.04 },
        { key: "exhale", name: "Izdih", duration: 1, scale: 0.78 }
      ]
    },
    fire: {
      description: "Hiter ritem izvajaj samo sede. Ob vrtoglavici ali nelagodju takoj prenehaj.",
      steps: [
        { key: "inhale", name: "Kratek vdih", duration: 0.75, scale: 1.04 },
        { key: "exhale", name: "Kratek izdih", duration: 0.75, scale: 0.78 }
      ]
    },
    custom: { steps: [] }
  };
  const techniqueButton = document.getElementById("technique-button");
  const techniqueAccordion = document.getElementById("technique-accordion");
  const techniqueOptions = [...document.querySelectorAll("[data-technique-choice]")];
  const techniqueOptionsPanel = document.getElementById("technique-options");
  const techniqueCurrentLabel = document.getElementById("technique-current-label");
  const techniqueCurrentPattern = document.getElementById("technique-current-pattern");
  const techniqueGuidance = document.getElementById("technique-guidance");
  const visual = document.getElementById("breathing-visual");
  const shapePath = document.getElementById("breathing-shape-path");
  const outlinePath = document.getElementById("breathing-outline");
  const ringsGroup = document.getElementById("breathing-rings");
  const rippleCore = document.getElementById("breathing-ripple-core");
  const monkImage = document.getElementById("breathing-monk-image");
  const motifSelect = document.getElementById("motif-select");
  const shapeChoices = document.querySelector(".breathing-shape-choices");
  const shapeCurrentValue = document.getElementById("shape-current-value");
  const customRhythmSection = document.querySelector(".breathing-custom-rhythm");
  const settingsButton = document.getElementById("settings-btn");
  const settingsNavButton = document.getElementById("settings-nav-btn");
  const settingsContent = document.getElementById("settings-content");
  const settingsToggleLabel = document.getElementById("settings-toggle-label");
  const settingsBackdrop = document.getElementById("settings-backdrop");
  document.body.append(settingsBackdrop, settingsButton.closest(".breathing-settings"));
  const atmosphereCanvas = document.getElementById("breathing-atmosphere");
  const atmosphereContext = atmosphereCanvas.getContext("2d");
  const instructionEl = document.getElementById("instruction");
  const countdownEl = document.getElementById("countdown");
  const statusEl = document.getElementById("session-status");
  const timeRemainingEl = document.getElementById("time-remaining");
  const toggleBtn = document.getElementById("toggle-btn");
  const resetBtn = document.getElementById("reset-btn");
  const wordsToggle = document.getElementById("words-toggle");
  const exportBreathingPreferencesButton = document.getElementById("export-breathing-preferences");
  const importBreathingPreferencesButton = document.getElementById("import-breathing-preferences");
  const breathingPreferencesFile = document.getElementById("breathing-preferences-file");
  const breathingPreferencesStatus = document.getElementById("breathing-preferences-status");
  const soundModeSelect = document.getElementById("sound-mode-select");
  const soundStyleSelect = document.getElementById("sound-style-select");
  const soundVolumeSlider = document.getElementById("breathing-sound-volume");
  const soundVolumeOutput = document.getElementById("breathing-sound-volume-value");
  const soundPreviewButton = document.getElementById("sound-preview");
  const backgroundModeSelect = document.getElementById("background-mode");
  const durationSelect = document.getElementById("duration-select");
  const visualStyleSelect = document.getElementById("visual-style");
  const breathingColorSelect = document.getElementById("breathing-color-select");
  const breathingGlowSelect = document.getElementById("breathing-glow-select");
  const exerciseAppearanceSelect = document.getElementById("exercise-appearance");
  const tempoSlider = document.getElementById("breathing-tempo");
  const tempoOutput = document.getElementById("breathing-tempo-value");
  const sessionElapsedEl = document.getElementById("session-elapsed");
  const sessionProgressEl = document.getElementById("session-progress");
  const settingsAccordions = [...document.querySelectorAll(".breathing-accordion")];
  const phaseSliders = [...document.querySelectorAll("[data-phase]")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compactSettingsViewport = window.matchMedia("(max-width: 760px)");
  const desktopSettingsViewport = window.matchMedia("(min-width: 761px)");

  let techniqueKey = techniqueOptions.find(option => option.getAttribute("aria-pressed") === "true")?.dataset.techniqueChoice ?? "belly";
  let shapeKey = "blob";
  let visualStyle = "grow";
  let breathingTempo = 1;
  let durationKey = "infinite";
  let durationMs = Infinity;
  let stepIndex = 0;
  let activeStepKey = null;
  let elapsedMs = 0;
  let lastElapsedSecond = -1;
  let phaseElapsedMs = 0;
  let roundNumber = 1;
  let breathsInRound = 0;
  let awaitingRoundStart = false;
  let ambienceActive = false;
  let ambienceStyle = "";
  let ambienceVolume = -1;
  let runStartedAt = 0;
  let phaseStartedAt = 0;
  let animationFrame = null;
  let atmosphereFrame = null;
  let hasStarted = false;
  let isRunning = false;
  let isComplete = false;
  let currentScale = 0.78;
  let targetScale = 0.78;
  let fromScale = 0.78;
  let particleFlowStart = 0.86;
  let particleFlowEnd = 0.86;
  let particleFlow = 0.86;
  let currentWaveProgress = 0.35;
  let particles = [];
  let backgroundMode = backgroundModeSelect.value;
  let backgroundEnabled = backgroundMode !== "off";
  let accentRgb = "79, 70, 229";
  let accentChannels = [79, 70, 229];
  let atmosphereSpread = 1;
  let lastAtmosphereFrame = 0;
  const BREATHING_COLORS = {
    theme: null,
    red: "#e11d48",
    orange: "#f97316",
    amber: "#f59e0b",
    coral: "#f16b63",
    green: "#54845f",
    teal: "#258d83",
    blue: "#397eb8",
    violet: "#795bb5",
    pink: "#c52668",
    yellow: "#ca8a04",
    mint: "#10b981",
    sky: "#0ea5e9",
    lavender: "#8b5cf6",
    fuchsia: "#d946ef"
  };
  const BREATHING_THEMES = new Set([
    "color", "lagoon", "forest", "sunset", "mono", "mono-dark",
    "dark-color", "ocean", "cyber", "synth", "system"
  ]);
  const LEGACY_BREATHING_THEMES = {
    theme: "system",
    light: "color",
    dark: "dark-color"
  };

  const SHAPE_MODES = {
    circle: "circle",
    square: "square",
    oval: "oval",
    blob: "blob"
  };

  const MOTIF_IMAGES = {
    "monk-orange": "images/dihanje/Meditirajoči menih v oranžni halji.png",
    "monk-gold": "images/dihanje/Meditirajoči menih v zlati opravi.png",
    "meditator-woman": "images/dihanje/Meditativna ženska v oranžni meniški opravi.png"
  };

  function getSteps() {
    let steps;
    if (techniqueKey === "custom") {
      const values = Object.fromEntries(phaseSliders.map(slider => [slider.dataset.phase, Number(slider.value)]));
      steps = [
        { key: "inhale", name: "Vdih", duration: values.inhale, scale: 1.04 },
        ...(values.holdIn > 0 ? [{ key: "holdIn", name: "Zadrži dih", duration: values.holdIn, scale: 1.04 }] : []),
        { key: "exhale", name: "Izdih", duration: values.exhale, scale: 0.78 },
        ...(values.holdOut > 0 ? [{ key: "holdOut", name: "Zadrži dih", duration: values.holdOut, scale: 0.78 }] : [])
      ];
    } else {
      steps = TECHNIQUES[techniqueKey].steps.map((step, index, techniqueSteps) => ({
        ...step,
        key: step.key ?? (step.name === "Še en vdih"
          ? "inhaleAgain"
          : step.name === "Vdih"
            ? "inhale"
            : step.name === "Izdih"
              ? "exhale"
              : techniqueSteps.slice(0, index).some(previous => previous.name === "Izdih") ? "holdOut" : "holdIn")
      }));
    }
    return steps.map(step => ({ ...step, duration: step.duration / breathingTempo }));
  }

  function updateSliderOutputs() {
    phaseSliders.forEach(slider => {
      const output = document.querySelector(`output[for="${slider.id}"]`);
      output.value = `${Number(slider.value).toLocaleString("sl-SI")} s`;
      output.textContent = output.value;
    });
  }

  function syncSlidersToTechnique() {
    const steps = getSteps();
    const durations = new Map();
    for (const step of steps) {
      if (step.key !== "inhaleAgain" && !durations.has(step.key)) durations.set(step.key, step.duration * breathingTempo);
    }
    phaseSliders.forEach(slider => {
      slider.value = durations.get(slider.dataset.phase) ?? "0";
    });
    updateSliderOutputs();
  }

  function makeBlobPath(scale, phase, extraRadius = 0) {
    if (shapeKey === "square") {
      const radius = 70 * scale + extraRadius;
      const left = 100 - radius;
      const right = 100 + radius;
      const top = 100 - radius;
      const bottom = 100 + radius;
      return `M ${left} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} Z`;
    }

    const points = Array.from({ length: 10 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 10;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const organic = shapeKey === "blob"
        ? 1 + 0.075 * Math.sin(angle * 3 + phase) + 0.035 * Math.cos(angle * 5 - phase * 0.7)
        : 1;
      const radiusX = (shapeKey === "oval" ? 82 : 70) * scale * organic + extraRadius;
      const radiusY = (shapeKey === "oval" ? 56 : 70) * scale * organic + extraRadius;
      return {
        x: 100 + cosine * radiusX,
        y: 100 + sine * radiusY
      };
    });
    const middle = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    let path = "";
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      const nextMiddle = middle(point, points[(index + 1) % points.length]);
      if (index === 0) {
        const start = middle(points[points.length - 1], point);
        path = `M ${start.x} ${start.y}`;
      }
      path += ` Q ${point.x} ${point.y} ${nextMiddle.x} ${nextMiddle.y}`;
    }
    return `${path} Z`;
  }

  function drawShape(scale = currentScale, phase = 0, breathProgress = currentWaveProgress) {
    if (reducedMotion.matches) phase = 0;
    currentWaveProgress = Math.max(0, Math.min(1, breathProgress));
    const glowProgress = Math.max(0, Math.min(1, (scale - 0.78) / 0.26));
    shapePath.setAttribute("d", makeBlobPath(scale, phase));
    const outlineScale = visualStyle === "fill" ? 1.04 : scale;
    const outlineRadius = visualStyle === "fill" ? 0 : 8;
    outlinePath.setAttribute("d", makeBlobPath(outlineScale, phase, outlineRadius));
    ringsGroup.setAttribute("transform", `translate(100 100) scale(${scale}) translate(-100 -100)`);
    monkImage.style.setProperty("--motif-scale", String(0.96 + (scale - 0.78) * 0.2));
    visual.style.setProperty("--breathing-glow-opacity", String((0.42 + glowProgress * 0.3).toFixed(3)));
    visual.style.setProperty("--breathing-halo-scale", String((0.94 + glowProgress * 0.12).toFixed(3)));
    rippleCore.setAttribute("r", String(30 + currentWaveProgress * 58));
  }

  function updateMotif() {
    const motif = motifSelect.value;
    visual.dataset.motif = motif;
    const imagePath = MOTIF_IMAGES[motif];
    monkImage.hidden = !imagePath;
    if (imagePath) monkImage.src = imagePath;
  }

  function resizeAtmosphere() {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    atmosphereCanvas.width = Math.round(window.innerWidth * ratio);
    atmosphereCanvas.height = Math.round(window.innerHeight * ratio);
    atmosphereContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    const spread = Math.hypot(window.innerWidth, window.innerHeight) * 0.44;
    atmosphereSpread = spread;
    particles = Array.from({ length: 900 }, () => {
      const speedTier = Math.random();
      const speed = speedTier < 0.45
        ? 0.00065 + Math.random() * 0.00185
        : speedTier < 0.72
          ? 0.00025 + Math.random() * 0.0007
          : speedTier < 0.9
            ? 0.00007 + Math.random() * 0.00018
            : speedTier < 0.98
              ? 0.000015 + Math.random() * 0.000055
              : 0.000003 + Math.random() * 0.000012;
      const flowTier = Math.random();
      const flowSpeed = flowTier < 0.5
        ? 0.0025 + Math.random() * 0.0065
        : flowTier < 0.78
          ? 0.0008 + Math.random() * 0.0017
          : flowTier < 0.95
            ? 0.00012 + Math.random() * 0.00048
            : 0.000015 + Math.random() * 0.000085;
      const depth = Math.random();
      const maxRadius = spread * (0.28 + Math.random() * 0.72);
      return {
        angle: Math.random() * Math.PI * 2,
        radius: maxRadius,
        maxRadius,
        inwardSpeed: spread * (0.00002 + depth * 0.00004),
        depth,
        size: 0.35 + depth * 1.95 + Math.random() * 0.4,
        speed: speed * (Math.random() < 0.5 ? -1 : 1),
        flow: particleFlow,
        flowSpeed,
        alpha: 0.2 + depth * 0.35
      };
    });
  }

  function updateAccent() {
    const color = getComputedStyle(document.body).getPropertyValue("--accent").trim();
    accentChannels = parseColorChannels(color);
    accentRgb = accentChannels.join(", ");
  }

  function parseColorChannels(color) {
    const hex = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    if (hex) {
      const digits = hex[1].length === 3 ? [...hex[1]].map(value => value + value).join("") : hex[1];
      return [0, 2, 4].map(index => Number.parseInt(digits.slice(index, index + 2), 16));
    }
    const rgb = color.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (!rgb) throw new Error(`Unsupported breathing accent color: ${color}`);
    return rgb.slice(1, 4).map(Number);
  }

  function channelsToHex(channels) {
    return `#${channels.map(channel => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
  }

  function secondaryHueColor(channels) {
    const [red, green, blue] = channels.map(channel => channel / 255);
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const delta = maximum - minimum;
    let hue = 0;
    if (delta) {
      if (maximum === red) hue = ((green - blue) / delta) % 6;
      else if (maximum === green) hue = (blue - red) / delta + 2;
      else hue = (red - green) / delta + 4;
      hue /= 6;
      if (hue < 0) hue += 1;
    }
    const saturation = maximum === 0 ? 0 : delta / maximum;
    const lightness = (maximum + minimum) / 2;
    const shiftedHue = (hue + 0.38) % 1;
    const adjustedSaturation = Math.max(0.38, saturation);
    const adjustedLightness = Math.min(0.62, Math.max(0.42, lightness));
    const chroma = (1 - Math.abs(2 * adjustedLightness - 1)) * adjustedSaturation;
    const segment = shiftedHue * 6;
    const secondary = chroma * (1 - Math.abs(segment % 2 - 1));
    const match = adjustedLightness - chroma / 2;
    const rgb = segment < 1 ? [chroma, secondary, 0]
      : segment < 2 ? [secondary, chroma, 0]
        : segment < 3 ? [0, chroma, secondary]
          : segment < 4 ? [0, secondary, chroma]
            : segment < 5 ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
    return channelsToHex(rgb.map(channel => (channel + match) * 255));
  }

  function updateBreathingFigureColor() {
    const colorKey = breathingColorSelect.value;
    if (!Object.hasOwn(BREATHING_COLORS, colorKey)) {
      console.error(`Neznana barva dihalnega lika: ${colorKey}`);
      breathingColorSelect.value = "theme";
    }
    const selectedColor = BREATHING_COLORS[breathingColorSelect.value]
      ?? getComputedStyle(document.body).getPropertyValue("--accent").trim();
    const channels = parseColorChannels(selectedColor);
    const solidColor = channelsToHex(channels);
    const light = breathingColorSelect.value === "red"
      ? solidColor
      : channelsToHex(channels.map(channel => channel + (255 - channel) * 0.3));
    visual.style.setProperty("--breathing-color", channelsToHex(channels));
    visual.style.setProperty("--breathing-color-light", light);
    visual.style.setProperty(
      "--breathing-color-secondary",
      breathingColorSelect.value === "red" ? solidColor : secondaryHueColor(channels)
    );
    visual.style.setProperty("--breathing-glow", `rgba(${channels.join(", ")}, 0.38)`);
    visual.dataset.glow = String(breathingGlowSelect.value === "on");
  }

  function applyExerciseAppearance() {
    document.body.dataset.breathingTheme = exerciseAppearanceSelect.value;
  }

  function drawAtmosphere(now) {
    if (!backgroundEnabled) return;
    const followsBreath = backgroundMode === "breath" || backgroundMode === "combined";
    const followsOrbit = backgroundMode === "orbit" || backgroundMode === "combined";
    const followsCenter = backgroundMode === "center";
    const context = atmosphereContext;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const rect = visual.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2 + (followsOrbit ? Math.sin(now * 0.000045) * width * 0.008 : 0);
    const centerY = rect.top + rect.height / 2 + (followsOrbit ? Math.cos(now * 0.00004) * height * 0.006 : 0);
    const gradient = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.64);
    gradient.addColorStop(0, `rgba(${accentRgb}, ${isRunning ? 0.095 : 0.055})`);
    gradient.addColorStop(0.4, `rgba(${accentRgb}, 0.025)`);
    gradient.addColorStop(1, `rgba(${accentRgb}, 0)`);
    context.clearRect(0, 0, width, height);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    const idlePulse = followsBreath
      ? isRunning ? particleFlow : 0.9 + Math.sin(now * 0.00035) * 0.035
      : 1;
    const delta = lastAtmosphereFrame ? Math.min(now - lastAtmosphereFrame, 40) : 16;
    lastAtmosphereFrame = now;
    const orbitSpeed = backgroundMode === "combined" ? 0.08 : 0.22;
    for (const particle of particles) {
      if (followsOrbit) particle.angle += particle.speed * delta * orbitSpeed;
      if (followsBreath) {
        particle.flow += (idlePulse - particle.flow) * (1 - Math.exp(-particle.flowSpeed * delta));
      }
      if (followsCenter) {
        particle.radius -= particle.inwardSpeed * delta;
        if (particle.radius <= particle.maxRadius * 0.015) particle.radius = particle.maxRadius;
      }
      const radius = particle.radius * (followsBreath ? particle.flow : 1);
      const x = centerX + Math.cos(particle.angle) * radius;
      const y = centerY + Math.sin(particle.angle) * radius;
      const radialDepth = Math.min(1, radius / atmosphereSpread);
      const gradientProgress = Math.max(0, Math.min(1, (radialDepth - 0.18) / 0.82));
      const softenedProgress = gradientProgress * gradientProgress * (3 - 2 * gradientProgress);
      const accentWeight = 1 - softenedProgress;
      const color = [148, 157, 170].map((farColor, index) => {
        const themeColor = accentChannels[index];
        return Math.round(farColor + (themeColor - farColor) * accentWeight);
      }).join(", ");
      const distanceFade = 1 - radialDepth * 0.38;
      const convergence = followsCenter ? 1 - particle.radius / particle.maxRadius : 0;
      const centerFade = followsCenter ? Math.min(1, convergence * 5, (1 - convergence) * 7) : 1;
      const alpha = particle.alpha * distanceFade * (isRunning ? 1 : 0.85) * centerFade;
      const size = particle.size * (followsCenter ? 1 + convergence * 0.55 : 1);
      context.beginPath();
      context.fillStyle = `rgba(${color}, ${alpha})`;
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();
      if (isRunning && followsOrbit) {
        const trail = 2 + Math.min(particle.speed * 900, 2.5);
        context.beginPath();
        context.strokeStyle = `rgba(${color}, ${alpha * 0.22})`;
        context.lineWidth = 0.7;
        context.moveTo(x, y);
        context.lineTo(x - Math.cos(particle.angle) * trail, y - Math.sin(particle.angle) * trail);
        context.stroke();
      }
    }
    if (!reducedMotion.matches && backgroundMode !== "still") atmosphereFrame = window.requestAnimationFrame(drawAtmosphere);
  }

  function startAtmosphere() {
    if (!backgroundEnabled) return;
    if (reducedMotion.matches || backgroundMode === "still") {
      drawAtmosphere(performance.now());
      return;
    }
    if (atmosphereFrame !== null) return;
    lastAtmosphereFrame = 0;
    atmosphereFrame = window.requestAnimationFrame(drawAtmosphere);
  }

  function formatTime(milliseconds) {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function formatElapsedTime(milliseconds) {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function setScale(scale) {
    targetScale = reducedMotion.matches ? 1 : scale;
    if (reducedMotion.matches) currentScale = targetScale;
  }

  function playPhaseCue(phase) {
    if (["cues", "both"].includes(soundModeSelect.value) && typeof WebNudgeSounds !== "undefined") {
      WebNudgeSounds.playBreathingCue(phase, soundStyleSelect.value, getBreathingSoundVolume());
    }
  }

  function getBreathingSoundVolume() {
    return Number(soundVolumeSlider.value) / 60;
  }

  function syncBreathingAudio(phase = activeStepKey, phaseDuration = getSteps()[stepIndex]?.duration) {
    if (typeof WebNudgeSounds === "undefined") return;
    const wantsAmbience = isRunning && ["ambience", "both"].includes(soundModeSelect.value);
    const volume = getBreathingSoundVolume();
    if (wantsAmbience && ambienceActive && ambienceStyle !== soundStyleSelect.value) {
      WebNudgeSounds.stopBreathingAmbience();
      ambienceActive = false;
    }
    if (!wantsAmbience && ambienceActive) {
      WebNudgeSounds.stopBreathingAmbience();
      ambienceActive = false;
      ambienceStyle = "";
      ambienceVolume = -1;
    } else if (wantsAmbience && !ambienceActive) {
      ambienceActive = WebNudgeSounds.startBreathingAmbience(soundStyleSelect.value, volume);
      if (ambienceActive) {
        ambienceStyle = soundStyleSelect.value;
        ambienceVolume = volume;
      }
    }
    if (wantsAmbience && ambienceActive && ambienceVolume !== volume) {
      WebNudgeSounds.setBreathingAmbienceVolume(volume);
      ambienceVolume = volume;
    }
    if (wantsAmbience && ambienceActive && phase) {
      WebNudgeSounds.setBreathingAmbiencePhase(phase, phaseDuration);
    }
  }

  function enterStep(startTime) {
    const step = getSteps()[stepIndex];
    activeStepKey = step.key;
    fromScale = currentScale;
    particleFlowStart = particleFlow;
    particleFlowEnd = step.scale > currentScale ? 1.38 : step.scale < currentScale ? 0.58 : particleFlow;
    setScale(step.scale);
    phaseStartedAt = startTime;
    instructionEl.textContent = step.name;
    playPhaseCue(step.key);
    if (isRunning) syncBreathingAudio(step.key, step.duration);
  }

  function render(now, scheduleNext = true) {
    if (!isRunning) return;

    const currentElapsed = elapsedMs + now - runStartedAt;
    const remainingSessionMs = Number.isFinite(durationMs) ? Math.max(0, durationMs - currentElapsed) : Infinity;
    updateElapsedTime(currentElapsed);
    updateRemainingTime(remainingSessionMs);

    if (Number.isFinite(durationMs) && currentElapsed >= durationMs) {
      finishSession();
      return;
    }

    const steps = getSteps();
    let phaseElapsed = now - phaseStartedAt;
    while (phaseElapsed >= steps[stepIndex].duration * 1000) {
      const completedPhase = steps[stepIndex];
      phaseStartedAt += steps[stepIndex].duration * 1000;
      currentScale = targetScale;
      if (completedPhase.key === "exhale" && TECHNIQUES[techniqueKey].rounds) {
        breathsInRound += 1;
        if (breathsInRound >= TECHNIQUES[techniqueKey].breathsPerRound) {
          breathsInRound = 0;
          if (roundNumber >= TECHNIQUES[techniqueKey].rounds) {
            finishTechniqueSession(currentElapsed);
            return;
          }
          const completedRound = roundNumber;
          roundNumber += 1;
          stepIndex = 0;
          elapsedMs = currentElapsed;
          phaseElapsedMs = 0;
          awaitingRoundStart = true;
          isRunning = false;
          if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
          animationFrame = null;
          syncBreathingAudio();
          instructionEl.textContent = `Krog ${completedRound} zaključen`;
          statusEl.textContent = `Vzemi si premor. Za ${roundNumber}. krog izberi Nadaljuj, ko si pripravljen.`;
          updateElapsedTime(elapsedMs);
          updateRemainingTime(Number.isFinite(durationMs) ? durationMs - elapsedMs : Infinity);
          updateControls();
          return;
        }
        updateTechniqueProgress();
      }
      stepIndex += 1;
      if (stepIndex >= steps.length) stepIndex = 0;
      enterStep(phaseStartedAt);
      phaseElapsed = now - phaseStartedAt;
    }

    const step = steps[stepIndex];
    const progress = Math.min(1, phaseElapsed / (step.duration * 1000));
    const easedProgress = progress * progress * (3 - 2 * progress);
    currentScale = reducedMotion.matches ? 1 : fromScale + (targetScale - fromScale) * easedProgress;
    particleFlow = particleFlowStart + (particleFlowEnd - particleFlowStart) * easedProgress;
    const waveProgress = step.scale > fromScale
      ? easedProgress
      : step.scale < fromScale
        ? 1 - easedProgress
        : step.scale > 0.9 ? 1 : 0;
    drawShape(currentScale, now * 0.0007 + Math.sin(progress * Math.PI) * 0.18, waveProgress);
    countdownEl.textContent = `${Math.max(0, step.duration - phaseElapsed / 1000).toFixed(1).replace(".", ",")} s`;
    animationFrame = scheduleNext ? window.requestAnimationFrame(render) : null;
  }

  function updateControls() {
    const action = isRunning ? "Začasno ustavi" : isComplete ? "Začni znova" : elapsedMs > 0 ? "Nadaljuj" : "Začni dihalno vajo";
    toggleBtn.setAttribute("aria-label", action);
    toggleBtn.setAttribute("aria-pressed", String(isRunning));
  }

  function finishTechniqueSession(currentElapsed) {
    isRunning = false;
    isComplete = true;
    elapsedMs = currentElapsed;
    phaseElapsedMs = 0;
    if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
    syncBreathingAudio();
    countdownEl.textContent = "";
    instructionEl.textContent = "Trije krogi zaključeni";
    statusEl.textContent = "Vaja je končana. Nadaljuj z običajnim, udobnim dihanjem.";
    updateElapsedTime(elapsedMs);
    updateRemainingTime(Infinity);
    currentScale = reducedMotion.matches ? 1 : 0.78;
    targetScale = currentScale;
    fromScale = currentScale;
    currentWaveProgress = 0.35;
    drawShape(currentScale);
    updateControls();
  }

  function restartAfterSettingsChange() {
    const resume = isRunning;
    resetSession();
    if (resume) startSession();
  }

  function updateRemainingTime(milliseconds) {
    const timed = Number.isFinite(durationMs);
    if (timeRemainingEl.hidden === timed) timeRemainingEl.hidden = !timed;
    const hideProgress = !hasStarted && !timed;
    if (sessionProgressEl.hidden !== hideProgress) sessionProgressEl.hidden = hideProgress;
    const remaining = `Preostalo ${formatTime(milliseconds)}`;
    if (timed && timeRemainingEl.textContent !== remaining) timeRemainingEl.textContent = remaining;
  }

  function updateElapsedTime(milliseconds = elapsedMs) {
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds !== lastElapsedSecond) {
      sessionElapsedEl.textContent = `Pretečeno ${formatElapsedTime(milliseconds)}`;
      lastElapsedSecond = seconds;
    }
    const hideProgress = !hasStarted && !Number.isFinite(durationMs);
    if (sessionProgressEl.hidden !== hideProgress) sessionProgressEl.hidden = hideProgress;
  }

  function updateTempoOutput() {
    breathingTempo = Number(tempoSlider.value);
    tempoOutput.value = `${breathingTempo.toLocaleString("sl-SI", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}×`;
    tempoOutput.textContent = tempoOutput.value;
  }

  function updateSoundVolumeOutput() {
    soundVolumeOutput.value = `${soundVolumeSlider.value} %`;
    soundVolumeOutput.textContent = soundVolumeOutput.value;
  }

  function updateTechniqueProgress() {
    const technique = TECHNIQUES[techniqueKey];
    if (!technique.rounds || !technique.breathsPerRound) {
      statusEl.textContent = isRunning
        ? "Sledite animaciji in dihajte udobno."
        : "Izberite ritem in začnite, ko ste pripravljeni.";
      return;
    }
    statusEl.textContent = `Krog ${roundNumber} od ${technique.rounds} · Dih ${Math.min(breathsInRound + 1, technique.breathsPerRound)} od ${technique.breathsPerRound}.`;
  }

  function applyBreathingPreferences(preferences) {
    if (!preferences || typeof preferences !== "object") return;
    if (techniqueOptions.some(option => option.dataset.techniqueChoice === preferences.technique)) {
      techniqueKey = preferences.technique;
      visual.dataset.technique = techniqueKey;
      updateTechniquePicker();
      customRhythmSection.hidden = techniqueKey !== "custom";
    }
    if (Object.hasOwn(SHAPE_MODES, preferences.shape)) {
      shapeKey = preferences.shape;
      visual.dataset.shape = shapeKey;
      shapeCurrentValue.textContent = document.querySelector(`button[data-shape="${shapeKey}"]`).textContent;
      document.querySelectorAll("button[data-shape]").forEach(button => {
        const selected = button.dataset.shape === shapeKey;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    }
    if ([...visualStyleSelect.options].some(option => option.value === preferences.visualStyle)) {
      visualStyleSelect.value = preferences.visualStyle;
      visualStyle = visualStyleSelect.value;
      visual.dataset.visualStyle = visualStyle;
      shapeChoices.hidden = ["rings", "ripple", "none"].includes(visualStyle);
      updateAccordionSelection(visualStyleSelect);
    }
    if ([...motifSelect.options].some(option => option.value === preferences.motif)) {
      motifSelect.value = preferences.motif;
      updateMotif();
      updateAccordionSelection(motifSelect);
    }
    if ([...backgroundModeSelect.options].some(option => option.value === preferences.backgroundMode)) {
      if (atmosphereFrame !== null) window.cancelAnimationFrame(atmosphereFrame);
      atmosphereFrame = null;
      backgroundModeSelect.value = preferences.backgroundMode;
      backgroundMode = backgroundModeSelect.value;
      backgroundEnabled = backgroundMode !== "off";
      atmosphereCanvas.hidden = !backgroundEnabled;
      updateAccordionSelection(backgroundModeSelect);
      if (backgroundEnabled) startAtmosphere();
      else atmosphereContext.clearRect(0, 0, atmosphereCanvas.width, atmosphereCanvas.height);
    }
    if (Object.hasOwn(BREATHING_COLORS, preferences.figureColor)) {
      breathingColorSelect.value = preferences.figureColor;
      updateAccordionSelection(breathingColorSelect);
      updateBreathingFigureColor();
    }
    if (typeof preferences.glow === "boolean") {
      breathingGlowSelect.value = preferences.glow ? "on" : "off";
      updateAccordionSelection(breathingGlowSelect);
      updateBreathingFigureColor();
    }
    const storedAppearance = LEGACY_BREATHING_THEMES[preferences.appearance] ?? preferences.appearance;
    if (BREATHING_THEMES.has(storedAppearance)) {
      exerciseAppearanceSelect.value = storedAppearance;
      updateAccordionSelection(exerciseAppearanceSelect);
      applyExerciseAppearance();
    }
    if (Number.isFinite(preferences.tempo) && preferences.tempo >= 0.5 && preferences.tempo <= 1.5) {
      tempoSlider.value = String(Math.round(preferences.tempo * 10) / 10);
      updateTempoOutput();
    }
    if (["off", "cues", "ambience", "both"].includes(preferences.soundMode)) {
      soundModeSelect.value = preferences.soundMode;
    } else if (typeof preferences.sound === "boolean") {
      soundModeSelect.value = preferences.sound ? "cues" : "off";
    }
    if (["glass", "warm", "drop", "air"].includes(preferences.soundStyle)) {
      soundStyleSelect.value = preferences.soundStyle;
    }
    if (Number.isFinite(preferences.soundVolume) && preferences.soundVolume >= 0 && preferences.soundVolume <= 60) {
      soundVolumeSlider.value = String(preferences.soundVolume);
    }
    updateAccordionSelection(soundModeSelect);
    updateAccordionSelection(soundStyleSelect);
    updateSoundVolumeOutput();
    if (typeof preferences.words === "boolean") setWordsVisible(preferences.words);
    if (["60000", "180000", "300000", "infinite"].includes(preferences.duration)) {
      durationSelect.value = preferences.duration;
      durationKey = durationSelect.value;
      durationMs = durationKey === "infinite" ? Infinity : Number(durationKey);
      updateAccordionSelection(durationSelect);
      updateRemainingTime(durationMs);
    }
    if (preferences.phases && typeof preferences.phases === "object") {
      phaseSliders.forEach(slider => {
        const value = Number(preferences.phases[slider.dataset.phase]);
        if (Number.isFinite(value) && value >= Number(slider.min) && value <= Number(slider.max)) {
          slider.value = String(value);
        }
      });
      updateSliderOutputs();
    }
    visual.dataset.showWords = String(isWordsVisible());
    updateAccent();
    updateBreathingFigureColor();
    updateTechniqueProgress();
    drawShape(currentScale);
    if (backgroundMode === "still" || reducedMotion.matches) drawAtmosphere(performance.now());
  }

  async function loadBreathingPreferences() {
    try {
      if (typeof browser !== "undefined" && browser.storage?.local) {
        const stored = await browser.storage.local.get(breathingPreferenceKey);
        applyBreathingPreferences(stored[breathingPreferenceKey]);
      } else {
        const stored = localStorage.getItem(breathingPreferenceKey);
        if (stored) applyBreathingPreferences(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Nastavitev dihalne vaje ni bilo mogoče naložiti:", error);
    }
  }

  function collectBreathingPreferences() {
    return {
      figureColor: breathingColorSelect.value,
      glow: breathingGlowSelect.value === "on",
      appearance: exerciseAppearanceSelect.value,
      tempo: breathingTempo,
      technique: techniqueKey,
      shape: shapeKey,
      visualStyle,
      motif: motifSelect.value,
      backgroundMode,
      sound: soundModeSelect.value !== "off",
      soundMode: soundModeSelect.value,
      soundStyle: soundStyleSelect.value,
      soundVolume: Number(soundVolumeSlider.value),
      words: isWordsVisible(),
      duration: durationSelect.value,
      phases: Object.fromEntries(phaseSliders.map(slider => [slider.dataset.phase, Number(slider.value)]))
    };
  }

  function isWordsVisible() {
    return wordsToggle.getAttribute("aria-pressed") === "true";
  }

  function setWordsVisible(visible) {
    wordsToggle.setAttribute("aria-pressed", String(visible));
    visual.dataset.showWords = String(visible);
  }

  async function persistBreathingPreferences(preferences) {
    if (typeof browser !== "undefined" && browser.storage?.local) {
      await browser.storage.local.set({ [breathingPreferenceKey]: preferences });
    } else {
      localStorage.setItem(breathingPreferenceKey, JSON.stringify(preferences));
    }
  }

  async function saveBreathingPreferences() {
    const preferences = collectBreathingPreferences();
    preferences.sound = preferences.soundMode !== "off";
    try {
      await persistBreathingPreferences(preferences);
    } catch (error) {
      console.error("Nastavitev dihalne vaje ni bilo mogoče shraniti:", error);
    }
  }

  function setBreathingPreferencesStatus(message, isError = false) {
    breathingPreferencesStatus.textContent = message;
    breathingPreferencesStatus.setAttribute("role", isError ? "alert" : "status");
  }

  exportBreathingPreferencesButton.addEventListener("click", () => {
    try {
      const backup = breathingPreferencesCodec.createBackup(collectBreathingPreferences());
      const file = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: "application/json" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `vmes-nastavitve-dihanja-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setBreathingPreferencesStatus("Nastavitve so izvožene. Datoteko prenesite v drugo napravo.");
    } catch (error) {
      console.error("Nastavitev dihalne vaje ni bilo mogoče izvoziti:", error);
      setBreathingPreferencesStatus("Nastavitev ni bilo mogoče izvoziti.", true);
    }
  });

  importBreathingPreferencesButton.addEventListener("click", () => {
    breathingPreferencesFile.click();
  });

  breathingPreferencesFile.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error("Datoteka je prevelika (največja velikost je 1 MB).");
      const importedPreferences = breathingPreferencesCodec.parseBackup(JSON.parse(await file.text()));
      if (!window.confirm("Uvoz bo zamenjal trenutne nastavitve in ponastavil trenutno dihalno vajo. Nadaljujem?")) return;
      await persistBreathingPreferences({
        ...importedPreferences,
        sound: importedPreferences.soundMode !== "off"
      });
      resetSession();
      applyBreathingPreferences(importedPreferences);
      setBreathingPreferencesStatus("Nastavitve so uvožene in shranjene v tej napravi.");
    } catch (error) {
      console.error("Nastavitev dihalne vaje ni bilo mogoče uvoziti:", error);
      setBreathingPreferencesStatus(error instanceof SyntaxError
        ? "Datoteka ni veljaven JSON."
        : error?.message || "Datoteke nastavitev ni bilo mogoče uvoziti.", true);
    } finally {
      event.target.value = "";
    }
  });

  function updateTechniquePicker() {
    const selectedOption = techniqueOptions.find(option => option.dataset.techniqueChoice === techniqueKey);
    if (!selectedOption) return;
    techniqueCurrentLabel.textContent = selectedOption.dataset.label;
    techniqueCurrentPattern.textContent = selectedOption.dataset.pattern;
    techniqueGuidance.textContent = TECHNIQUES[techniqueKey].description
      ?? "Prilagodi trajanje posameznih faz po svojem občutku.";
    techniqueButton.setAttribute("aria-label", `Ritem dihanja: ${selectedOption.dataset.label}, ${selectedOption.dataset.pattern}`);
    techniqueOptions.forEach(option => {
      const selected = option === selectedOption;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
  }

  function updateAccordionSelection(select) {
    const selectedOption = select.selectedOptions[0];
    const value = document.querySelector(`[data-setting-value="${select.id}"]`);
    if (value && selectedOption) value.textContent = selectedOption.textContent;
    document.querySelectorAll(`[data-setting-target="${select.id}"]`).forEach(option => {
      const selected = option.dataset.value === select.value;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
  }

  function closeSettingsAccordion(accordion) {
    accordion.open = false;
    if (accordion === techniqueAccordion) {
      techniqueOptionsPanel.hidden = true;
      techniqueButton.setAttribute("aria-expanded", "false");
    }
  }

  function setSettingsExpanded(expanded) {
    settingsContent.hidden = !expanded;
    settingsButton.setAttribute("aria-expanded", String(expanded));
    settingsToggleLabel.textContent = expanded ? "Skrij nastavitve dihanja" : "Prikaži nastavitve dihanja";
    settingsButton.setAttribute("aria-label", settingsToggleLabel.textContent);
    settingsNavButton.setAttribute("aria-expanded", String(expanded));
    settingsNavButton.setAttribute("aria-label", expanded ? "Skrij nastavitve dihanja" : "Prikaži nastavitve dihanja");
    settingsButton.closest(".breathing-settings").dataset.expanded = String(expanded);
    const showBackdrop = expanded && compactSettingsViewport.matches;
    settingsBackdrop.hidden = !showBackdrop;
    document.body.dataset.settingsOpen = String(expanded);
  }

  function closeTechniqueOptions(restoreFocus = false) {
    closeSettingsAccordion(techniqueAccordion);
    if (restoreFocus) techniqueButton.focus();
  }

  function selectTechnique(key) {
    techniqueKey = key;
    visual.dataset.technique = techniqueKey;
    customRhythmSection.hidden = techniqueKey !== "custom";
    updateTechniquePicker();
    syncSlidersToTechnique();
    closeTechniqueOptions(true);
    restartAfterSettingsChange();
    saveBreathingPreferences();
  }

  function startSession() {
    if (isComplete) resetSession();
    const now = performance.now();
    if (!hasStarted) {
      hasStarted = true;
      enterStep(now);
    } else if (awaitingRoundStart) {
      awaitingRoundStart = false;
      enterStep(now);
    } else {
      phaseStartedAt = now - phaseElapsedMs;
      instructionEl.textContent = getSteps()[stepIndex].name;
    }
    isRunning = true;
    isComplete = false;
    runStartedAt = now;
    syncBreathingAudio(activeStepKey, getSteps()[stepIndex]?.duration);
    updateTechniqueProgress();
    updateControls();
    render(now);
  }

  function pauseSession() {
    const now = performance.now();
    const pendingFrame = animationFrame;
    render(now, false);
    if (!isRunning) return;
    elapsedMs += now - runStartedAt;
    phaseElapsedMs = now - phaseStartedAt;
    isRunning = false;
    syncBreathingAudio();
    if (pendingFrame !== null) window.cancelAnimationFrame(pendingFrame);
    animationFrame = null;
    updateElapsedTime(elapsedMs);
    updateRemainingTime(Number.isFinite(durationMs) ? durationMs - elapsedMs : Infinity);
    instructionEl.textContent = "Premor";
    statusEl.textContent = "Vaja je začasno ustavljena.";
    updateControls();
  }

  function finishSession() {
    isRunning = false;
    isComplete = true;
    syncBreathingAudio();
    elapsedMs = durationMs;
    phaseElapsedMs = 0;
    if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
    countdownEl.textContent = "";
    instructionEl.textContent = "Vaja končana";
    statusEl.textContent = "Vzemite si trenutek in nadaljujte z običajnim dihanjem.";
    updateElapsedTime(elapsedMs);
    updateRemainingTime(0);
    currentScale = reducedMotion.matches ? 1 : 0.78;
    targetScale = currentScale;
    fromScale = currentScale;
    currentWaveProgress = 0.35;
    drawShape(currentScale);
    updateControls();
  }

  function resetSession() {
    if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
    animationFrame = null;
    isRunning = false;
    syncBreathingAudio();
    isComplete = false;
    stepIndex = 0;
    awaitingRoundStart = false;
    activeStepKey = null;
    hasStarted = false;
    elapsedMs = 0;
    roundNumber = 1;
    breathsInRound = 0;
    phaseElapsedMs = 0;
    currentScale = reducedMotion.matches ? 1 : 0.78;
    targetScale = currentScale;
    fromScale = currentScale;
    particleFlow = 0.86;
    particleFlowStart = particleFlow;
    particleFlowEnd = particleFlow;
    currentWaveProgress = 0.35;
    drawShape(currentScale);
    instructionEl.textContent = "Začni";
    countdownEl.textContent = "";
    updateElapsedTime(0);
    updateRemainingTime(durationMs);
    updateTechniqueProgress();
    updateControls();
  }

  visual.dataset.technique = techniqueKey;
  visual.dataset.shape = shapeKey;
  visual.dataset.visualStyle = visualStyle;
  visual.dataset.showWords = String(isWordsVisible());
  updateMotif();
  setScale(0.78);
  updateAccent();
  resizeAtmosphere();
  drawShape(0.78);
  if (reducedMotion.matches || backgroundMode === "still") drawAtmosphere(performance.now());
  else startAtmosphere();
  window.addEventListener("resize", resizeAtmosphere);
  new MutationObserver(() => {
    updateAccent();
    if (breathingColorSelect.value === "theme") updateBreathingFigureColor();
    if (backgroundMode === "still" || reducedMotion.matches) drawAtmosphere(performance.now());
  }).observe(document.body, { attributes: true, attributeFilter: ["data-theme", "data-palette", "data-breathing-theme"] });
  const systemColorScheme = window.matchMedia("(prefers-color-scheme: dark)");
  systemColorScheme.addEventListener?.("change", () => {
    if (exerciseAppearanceSelect.value !== "system") return;
    updateAccent();
    if (breathingColorSelect.value === "theme") updateBreathingFigureColor();
    if (backgroundMode === "still" || reducedMotion.matches) drawAtmosphere(performance.now());
  });
  reducedMotion.addEventListener?.("change", () => {
    drawShape(currentScale);
    if (reducedMotion.matches) {
      if (atmosphereFrame !== null) window.cancelAnimationFrame(atmosphereFrame);
      atmosphereFrame = null;
      drawAtmosphere(performance.now());
    } else {
      startAtmosphere();
    }
  });
  updateControls();
  updateRemainingTime(durationMs);
  updateTechniquePicker();
  [
    durationSelect,
    visualStyleSelect,
    backgroundModeSelect,
    motifSelect,
    breathingColorSelect,
    breathingGlowSelect,
    exerciseAppearanceSelect,
    soundModeSelect,
    soundStyleSelect
  ].forEach(updateAccordionSelection);
  updateTempoOutput();
  updateSoundVolumeOutput();
  updateBreathingFigureColor();
  updateTechniqueProgress();
  customRhythmSection.hidden = techniqueKey !== "custom";
  loadBreathingPreferences();

  setSettingsExpanded(!compactSettingsViewport.matches && !desktopSettingsViewport.matches);
  compactSettingsViewport.addEventListener("change", () => {
    setSettingsExpanded(!compactSettingsViewport.matches && !desktopSettingsViewport.matches);
  });
  desktopSettingsViewport.addEventListener("change", () => {
    setSettingsExpanded(!compactSettingsViewport.matches && !desktopSettingsViewport.matches);
  });
  settingsButton.addEventListener("click", () => {
    const expanded = settingsButton.getAttribute("aria-expanded") !== "true";
    setSettingsExpanded(expanded);
    if (!expanded && desktopSettingsViewport.matches) settingsNavButton.focus();
  });
  settingsNavButton.addEventListener("click", () => {
    const expanded = settingsNavButton.getAttribute("aria-expanded") !== "true";
    setSettingsExpanded(expanded);
    if (expanded && desktopSettingsViewport.matches) settingsButton.focus();
  });
  settingsBackdrop.addEventListener("click", () => setSettingsExpanded(false));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !techniqueOptionsPanel.hidden) {
      closeTechniqueOptions(true);
    } else if (event.key === "Escape" && settingsAccordions.some(accordion => accordion.open)) {
      const openAccordion = settingsAccordions.find(accordion => accordion.open);
      closeSettingsAccordion(openAccordion);
      openAccordion.querySelector("summary").focus();
    } else if (event.key === "Escape" && settingsButton.getAttribute("aria-expanded") === "true") {
      setSettingsExpanded(false);
      (desktopSettingsViewport.matches ? settingsNavButton : settingsButton).focus();
    }
  });

  techniqueButton.addEventListener("click", event => {
    event.preventDefault();
    const expanded = !techniqueAccordion.open;
    if (expanded) {
      settingsAccordions.forEach(accordion => {
        if (accordion !== techniqueAccordion) accordion.open = false;
      });
    }
    techniqueAccordion.open = expanded;
    techniqueOptionsPanel.hidden = !expanded;
    techniqueButton.setAttribute("aria-expanded", String(expanded));
  });
  techniqueOptions.forEach(option => {
    option.addEventListener("click", () => selectTechnique(option.dataset.techniqueChoice));
  });
  settingsAccordions.forEach(accordion => {
    accordion.addEventListener("toggle", () => {
      if (!accordion.open) return;
      settingsAccordions.forEach(other => {
        if (other !== accordion) closeSettingsAccordion(other);
      });
    });
  });
  document.addEventListener("click", event => {
    if (!techniqueOptionsPanel.hidden && !event.target.closest(".breathing-rhythm-picker")) {
      closeTechniqueOptions();
    }
    if (!compactSettingsViewport.matches
      && settingsButton.getAttribute("aria-expanded") === "true"
      && !event.target.closest(".breathing-settings")
      && !event.target.closest("#settings-nav-btn")) {
      setSettingsExpanded(false);
    }
  });

  phaseSliders.forEach(slider => {
    slider.addEventListener("input", updateSliderOutputs);
    slider.addEventListener("change", () => {
      restartAfterSettingsChange();
      saveBreathingPreferences();
    });
  });

  document.querySelectorAll("[data-setting-target]").forEach(option => {
    option.addEventListener("click", () => {
      const select = document.getElementById(option.dataset.settingTarget);
      select.value = option.dataset.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
  [
    durationSelect,
    visualStyleSelect,
    backgroundModeSelect,
    motifSelect,
    breathingGlowSelect,
    soundModeSelect,
    soundStyleSelect
  ].forEach(select => {
    select.addEventListener("change", () => {
      updateAccordionSelection(select);
      closeSettingsAccordion(select.closest(".breathing-accordion"));
      if (select === soundModeSelect || select === soundStyleSelect) {
        syncBreathingAudio();
        saveBreathingPreferences();
        return;
      } else if (select === durationSelect) {
        durationKey = durationSelect.value;
        durationMs = durationKey === "infinite" ? Infinity : Number(durationKey);
      } else if (select === visualStyleSelect) {
        visualStyle = visualStyleSelect.value;
        visual.dataset.visualStyle = visualStyle;
        shapeChoices.hidden = ["rings", "ripple", "none"].includes(visualStyle);
        drawShape(currentScale, performance.now() * 0.0007);
      } else if (select === motifSelect) {
        updateMotif();
      } else if (select === breathingGlowSelect) {
        updateBreathingFigureColor();
      } else {
        backgroundMode = backgroundModeSelect.value;
        backgroundEnabled = backgroundMode !== "off";
        atmosphereCanvas.hidden = !backgroundEnabled;
        if (atmosphereFrame !== null) window.cancelAnimationFrame(atmosphereFrame);
        atmosphereFrame = null;
        if (backgroundEnabled) startAtmosphere();
        else atmosphereContext.clearRect(0, 0, atmosphereCanvas.width, atmosphereCanvas.height);
      }
      restartAfterSettingsChange();
      saveBreathingPreferences();
    });
  });

  wordsToggle.addEventListener("click", () => {
    setWordsVisible(!isWordsVisible());
    saveBreathingPreferences();
  });
  soundVolumeSlider.addEventListener("input", () => {
    updateSoundVolumeOutput();
    syncBreathingAudio();
  });
  soundVolumeSlider.addEventListener("change", saveBreathingPreferences);
  soundPreviewButton.addEventListener("click", () => {
    if (typeof WebNudgeSounds !== "undefined") {
      WebNudgeSounds.playBreathingCue("inhale", soundStyleSelect.value, getBreathingSoundVolume());
    }
  });
  tempoSlider.addEventListener("input", updateTempoOutput);
  tempoSlider.addEventListener("change", () => {
    updateTempoOutput();
    restartAfterSettingsChange();
    saveBreathingPreferences();
  });
  breathingColorSelect.addEventListener("change", () => {
    updateAccordionSelection(breathingColorSelect);
    updateBreathingFigureColor();
    drawShape(currentScale);
    if (backgroundMode === "still" || reducedMotion.matches) drawAtmosphere(performance.now());
    closeSettingsAccordion(breathingColorSelect.closest(".breathing-accordion"));
    saveBreathingPreferences();
  });
  exerciseAppearanceSelect.addEventListener("change", () => {
    updateAccordionSelection(exerciseAppearanceSelect);
    applyExerciseAppearance();
    updateAccent();
    updateBreathingFigureColor();
    if (backgroundMode === "still" || reducedMotion.matches) drawAtmosphere(performance.now());
    closeSettingsAccordion(exerciseAppearanceSelect.closest(".breathing-accordion"));
    saveBreathingPreferences();
  });

  document.querySelectorAll("button[data-shape]").forEach(button => {
    button.addEventListener("click", () => {
      shapeKey = button.dataset.shape;
      shapeCurrentValue.textContent = button.textContent;
      visual.dataset.shape = shapeKey;
      document.querySelectorAll("button[data-shape]").forEach(choice => {
        const selected = choice === button;
        choice.classList.toggle("is-selected", selected);
        choice.setAttribute("aria-pressed", String(selected));
      });
      drawShape(currentScale, performance.now() * 0.0007);
      restartAfterSettingsChange();
      saveBreathingPreferences();
    });
  });

  toggleBtn.addEventListener("click", () => {
    if (isRunning) pauseSession();
    else startSession();
  });

  resetBtn.addEventListener("click", () => {
    resetSession();
  });
})();
