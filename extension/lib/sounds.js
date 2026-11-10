(() => {
  const soundsScriptUrl = document.currentScript?.src;
  const SOUNDS = [
    // Klasični zvoki in akordi.
    {
      id: "chime",
      name: "Kristalni zvonec",
      category: "Klasični",
      desc: "Čist in prijeten ton za splošne opomnike.",
      frequencies: [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6 arpeggio
    },
    {
      id: "gentle-bell",
      name: "Nežen ton",
      category: "Sprostitveni",
      desc: "Topel, pomirjujoč zvok za odmor za oči.",
      frequencies: [440, 554.37, 659.25] // A4 dur
    },
    {
      id: "marimba",
      name: "Marimba akord",
      category: "Melodični",
      desc: "Topel melodičen ton za pomembnejša opravila.",
      frequencies: [329.63, 440, 523.25, 659.25] // E4, A4, C5, E5
    },
    {
      id: "celesta",
      name: "Svetleče zvončki (Celesta)",
      category: "Melodični",
      desc: "Nežno lebdeči zvončki visoke jasnosti.",
      frequencies: [659.25, 830.61, 987.77, 1318.51]
    },
    {
      id: "rising-chime",
      name: "Naraščajoči zvončki",
      category: "Melodični",
      desc: "Mehka naraščajoča melodija za prijeten opomnik.",
      frequencies: [523.25, 659.25, 783.99, 1046.5]
    },
    {
      id: "soft-pulse",
      name: "Mehak trojni ton",
      category: "Sprostitveni",
      desc: "Trije topli toni z nežnim začetkom in izzvenom.",
      frequencies: [440, 523.25, 659.25]
    },
    {
      id: "wood-tap",
      name: "Nežen lesen ton",
      category: "Sprostitveni",
      desc: "Kratek, topel dvojni ton za diskreten opomnik.",
      frequencies: [392, 493.88]
    },
    {
      id: "soft-click",
      name: "Mehak zvočni poudarek",
      category: "Posneti zvoki · CC0",
      desc: "Kratek, nežen posnet zvočni signal iz zbirke zvočnih učinkov Kenney.",
      asset: "sounds/soft-click.ogg",
      frequencies: []
    },
    {
      id: "clear-click",
      name: "Jasen zvočni poudarek",
      category: "Posneti zvoki · CC0",
      desc: "Kratek, razločen posnet zvočni signal iz zbirke zvočnih učinkov Kenney.",
      asset: "sounds/clear-click.ogg",
      frequencies: []
    },
    {
      id: "gentle-switch",
      name: "Mehak dvojni signal",
      category: "Posneti zvoki · CC0",
      desc: "Mehak preklopni signal iz zbirke zvočnih učinkov Kenney.",
      asset: "sounds/gentle-switch.ogg",
      frequencies: []
    },

    // Voda in narava.
    {
      id: "water-drop",
      name: "Ena kapljica vode",
      category: "Narava in voda",
      desc: "Kratek, nežen zvok kapljice za opomnik na hidracijo.",
      frequencies: [600, 1400, 400]
    },
    {
      id: "water-stream",
      name: "Žuborenje potočka / tekoča voda",
      category: "Narava in voda",
      desc: "Prijetno večstopenjsko žuborenje vode.",
      frequencies: [450, 750, 1100, 1350, 950]
    },
    {
      id: "water-ripple",
      name: "Vodno valovanje (Kozarec)",
      category: "Narava in voda",
      desc: "Mehak naliv vode z dvojnim odmevom.",
      frequencies: [500, 900, 720, 1200]
    },
    {
      id: "rain-tap",
      name: "Dežne kaplje",
      category: "Narava in voda",
      desc: "Pomirjujoč ritem dežnih kapelj ob okno.",
      frequencies: [800, 1100, 650, 950]
    },

    // Sprostitveni zvoki in zbranost.
    {
      id: "relax",
      name: "Zen gong",
      category: "Sprostitveni",
      desc: "Globok resonančen zvok za kratek dih ali premor.",
      frequencies: [220, 440, 880]
    },
    {
      id: "tibetan-bowl",
      name: "Tibetanska posoda",
      category: "Sprostitveni",
      desc: "Meditativna resonanca z nežnim nihanjem.",
      frequencies: [280, 560, 840]
    },
    {
      id: "digital",
      name: "Digitalni ping",
      category: "Digitalni",
      desc: "Sodoben, hiter opomnik za delovni fokus.",
      frequencies: [987.77, 1318.51] // B5, E6
    },
    {
      id: "soft-synth",
      name: "Sodoben sintetični ton",
      category: "Digitalni",
      desc: "Čist, minimalističen digitalni akord.",
      frequencies: [587.33, 880.00, 1174.66] // D5, A5, D6
    }
  ];

  let audioCtx = null;
  const activeAudio = new Set();
  const LEGACY_SOUND_MAP = Object.freeze({
    "water-drop": "soft-click",
    "water-stream": "gentle-switch",
    "water-ripple": "soft-click",
    "rain-tap": "gentle-switch"
  });

  function getAudioContext() {
    if (!audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) audioCtx = new AudioCtx();
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSynthesizedSound(soundId, volume = 0.55) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const sound = SOUNDS.find(s => s.id === soundId) || SOUNDS[0];
      const vol = Math.max(0.01, Math.min(1, Number(volume) || 0.55));
      const now = ctx.currentTime;

      if (soundId === "rising-chime" || soundId === "soft-pulse" || soundId === "wood-tap") {
        const settings = {
          "rising-chime": { offsets: [0, 0.11, 0.22, 0.33], duration: 0.72, peak: 0.35, waveform: "sine" },
          "soft-pulse": { offsets: [0, 0.2, 0.4], duration: 0.58, peak: 0.3, waveform: "sine" },
          "wood-tap": { offsets: [0, 0.17], duration: 0.19, peak: 0.36, waveform: "triangle" }
        }[soundId];
        sound.frequencies.forEach((frequency, index) => {
          const start = now + settings.offsets[index];
          const end = start + settings.duration;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = settings.waveform;
          osc.frequency.setValueAtTime(frequency, start);
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.linearRampToValueAtTime(vol * settings.peak, start + 0.025);
          gain.gain.exponentialRampToValueAtTime(0.001, end);
          osc.connect(gain).connect(ctx.destination);
          osc.start(start);
          osc.stop(end + 0.02);
        });
        return;
      }

      // 1. Ena kapljica vode
      if (soundId === "water-drop") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.16);

        gain.gain.setValueAtTime(vol * 0.85, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
        return;
      }

      // 2. Žuborenje / tekoča voda (več frekvenčnih kapljic v zaporedju)
      if (soundId === "water-stream") {
        const drops = [
          { f: 550, t: 0.00, dur: 0.14 },
          { f: 880, t: 0.06, dur: 0.16 },
          { f: 1250, t: 0.12, dur: 0.15 },
          { f: 720, t: 0.18, dur: 0.18 },
          { f: 1050, t: 0.24, dur: 0.20 },
          { f: 600, t: 0.30, dur: 0.22 }
        ];
        drops.forEach(d => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const startT = now + d.t;
          osc.type = "sine";
          osc.frequency.setValueAtTime(d.f, startT);
          osc.frequency.exponentialRampToValueAtTime(d.f * 1.5, startT + d.dur * 0.4);
          osc.frequency.exponentialRampToValueAtTime(d.f * 0.8, startT + d.dur);

          gain.gain.setValueAtTime(vol * 0.45, startT);
          gain.gain.exponentialRampToValueAtTime(0.001, startT + d.dur);

          osc.connect(gain).connect(ctx.destination);
          osc.start(startT);
          osc.stop(startT + d.dur + 0.02);
        });
        return;
      }

      // 3. Vodno valovanje / prelivanje v kozarec
      if (soundId === "water-ripple") {
        [680, 950, 1300].forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = now + (idx * 0.09);
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, t);
          osc.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.07);
          osc.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.22);

          gain.gain.setValueAtTime(vol * 0.55, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.26);
        });
        return;
      }

      // 4. Dežne kaplje
      if (soundId === "rain-tap") {
        [750, 1150, 850, 1350].forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = now + (idx * 0.08);
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, t);
          osc.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.04);
          osc.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.14);

          gain.gain.setValueAtTime(vol * 0.4, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.17);
        });
        return;
      }

      // 5. Digitalni ping
      if (soundId === "digital") {
        [987.77, 1318.51].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = now + (idx * 0.07);
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(vol * 0.7, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.16);
        });
        return;
      }

      // Sodoben sintetični ton.
      if (soundId === "soft-synth") {
        [587.33, 880.00, 1174.66].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = now + (idx * 0.06);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(vol * 0.6, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.24);
        });
        return;
      }

      // 7. Tibetanska posoda
      if (soundId === "tibetan-bowl") {
        [280, 560, 840].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);
          const factor = 1 / (idx + 1.2);
          gain.gain.setValueAtTime(vol * 0.5 * factor, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 1.45);
        });
        return;
      }

      // 8. Zen gong
      if (soundId === "relax") {
        const freqs = [220, 440, 660, 880];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);
          const factor = 1 / (idx + 1);
          gain.gain.setValueAtTime(vol * 0.45 * factor, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 1.05);
        });
        return;
      }

      // 9. Celesta (svetleči zvončki)
      if (soundId === "celesta") {
        const freqs = [659.25, 830.61, 987.77, 1318.51];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const t = now + (idx * 0.07);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(vol * 0.55, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.48);
        });
        return;
      }

      // 10. Default melodije (chime, gentle-bell, marimba)
      const freqs = sound.frequencies;
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = now + (idx * 0.08);
        osc.type = soundId === "marimba" ? "sine" : "triangle";
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(vol * 0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.38);
      });
    } catch {}
  }

  const BREATHING_TONES = {
    inhale: 493.88,
    inhaleAgain: 523.25,
    exhale: 392,
    holdIn: 440,
    holdOut: 415.3
  };
  const BREATHING_SOUND_STYLES = {
    glass: {
      partials: [{ ratio: 1, level: 0.3 }, { ratio: 2.01, level: 0.08 }, { ratio: 3.92, level: 0.025 }],
      duration: 0.86,
      waveform: "sine",
      glide: false,
      ambience: [1, 1.5, 2],
      ambienceWaveform: "sine"
    },
    warm: {
      partials: [{ ratio: 1, level: 0.3 }, { ratio: 1.5, level: 0.1 }, { ratio: 2, level: 0.035 }],
      duration: 0.92,
      waveform: "triangle",
      glide: false,
      ambience: [0.5, 1, 1.5],
      ambienceWaveform: "sine"
    },
    drop: {
      partials: [{ ratio: 1, level: 0.27 }, { ratio: 2.4, level: 0.06 }],
      duration: 0.62,
      waveform: "sine",
      glide: true,
      ambience: [0.5, 1, 2],
      ambienceWaveform: "triangle"
    },
    air: {
      partials: [{ ratio: 1, level: 0.28 }, { ratio: 1.01, level: 0.1 }, { ratio: 2, level: 0.025 }],
      duration: 1.15,
      waveform: "sine",
      glide: false,
      ambience: [1, 1.005, 1.5],
      ambienceWaveform: "sine"
    }
  };
  let activeBreathingAmbience = null;

  function getBreathingStyle(style) {
    return BREATHING_SOUND_STYLES[style] ?? BREATHING_SOUND_STYLES.glass;
  }

  function getBreathingTone(phase) {
    return BREATHING_TONES[phase] ?? BREATHING_TONES.holdIn;
  }

  function playBreathingCue(phase, style = "glass", volume = 0.2) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const soundStyle = getBreathingStyle(style);
      const fundamental = getBreathingTone(phase);
      const vol = Math.max(0, Math.min(1, Number(volume) || 0));
      const now = ctx.currentTime;

      soundStyle.partials.forEach(({ ratio, level }) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const end = now + soundStyle.duration;
        oscillator.type = soundStyle.waveform;
        oscillator.frequency.setValueAtTime(
          fundamental * ratio * (soundStyle.glide ? 1.25 : 1),
          now
        );
        if (soundStyle.glide) {
          oscillator.frequency.exponentialRampToValueAtTime(fundamental * ratio, now + soundStyle.duration);
        }
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(vol * level, now + 0.07);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.connect(gain).connect(ctx.destination);
        oscillator.start(now);
        oscillator.stop(end + 0.02);
      });
    } catch (error) {
      console.error("Could not play breathing phase cue.", error);
    }
  }

  function setBreathingAmbiencePhase(phase, duration = 4) {
    if (!activeBreathingAmbience) return;
    try {
      const { ctx, oscillators, style, masterGain } = activeBreathingAmbience;
      const now = ctx.currentTime;
      const soundStyle = getBreathingStyle(style);
      const base = getBreathingTone(phase);
      const phaseLevel = phase === "inhale" || phase === "inhaleAgain" ? 1 : phase.startsWith("hold") ? 0.58 : 0.72;
      activeBreathingAmbience.phaseLevel = phaseLevel;
      const ramp = Math.max(0.18, Math.min(1.2, duration / 3));
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setTargetAtTime(activeBreathingAmbience.volume * 0.11 * phaseLevel, now, ramp);
      oscillators.forEach((oscillator, index) => {
        oscillator.frequency.setTargetAtTime(base * soundStyle.ambience[index], now, ramp);
      });
    } catch (error) {
      console.error("Could not update breathing ambience.", error);
    }
  }

  function setBreathingAmbienceVolume(volume) {
    if (!activeBreathingAmbience) return false;
    try {
      const ambience = activeBreathingAmbience;
      ambience.volume = Math.max(0, Math.min(1, Number(volume) || 0));
      ambience.masterGain.gain.cancelScheduledValues(ambience.ctx.currentTime);
      ambience.masterGain.gain.setTargetAtTime(
        ambience.volume * 0.11 * ambience.phaseLevel,
        ambience.ctx.currentTime,
        0.12
      );
      return true;
    } catch (error) {
      console.error("Could not change breathing ambience volume.", error);
      return false;
    }
  }

  function stopBreathingAmbience() {
    const ambience = activeBreathingAmbience;
    if (!ambience) return;
    activeBreathingAmbience = null;
    try {
      const now = ambience.ctx.currentTime;
      ambience.masterGain.gain.cancelScheduledValues(now);
      ambience.masterGain.gain.setTargetAtTime(0.0001, now, 0.18);
      ambience.oscillators.forEach(oscillator => oscillator.stop(now + 1));
    } catch (error) {
      console.error("Could not stop breathing ambience cleanly.", error);
    }
  }

  function startBreathingAmbience(style = "glass", volume = 0.25) {
    stopBreathingAmbience();
    try {
      const ctx = getAudioContext();
      if (!ctx) return false;
      const soundStyle = getBreathingStyle(style);
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.connect(ctx.destination);
      const oscillators = soundStyle.ambience.map((ratio, index) => {
        const oscillator = ctx.createOscillator();
        const partialGain = ctx.createGain();
        oscillator.type = soundStyle.ambienceWaveform;
        oscillator.frequency.setValueAtTime(getBreathingTone("inhale") * ratio, now);
        partialGain.gain.setValueAtTime([0.55, 0.24, 0.1][index], now);
        oscillator.connect(partialGain).connect(masterGain);
        oscillator.start(now);
        return oscillator;
      });
      activeBreathingAmbience = {
        ctx,
        oscillators,
        style,
        masterGain,
        volume: Math.max(0, Math.min(1, Number(volume) || 0)),
        phaseLevel: 1
      };
      setBreathingAmbiencePhase("inhale", 1.2);
      return true;
    } catch (error) {
      console.error("Could not start breathing ambience.", error);
      return false;
    }
  }

  function play(soundId = "chime", volume = 0.55) {
    if (soundId === "none" || soundId === "off") return;
    const resolvedId = LEGACY_SOUND_MAP[soundId] || soundId;
    const sound = SOUNDS.find(item => item.id === resolvedId) || SOUNDS[0];
    if (sound.asset) {
      if (typeof globalThis.Audio !== "function") {
        console.error(`Cannot play sound asset: ${sound.asset}`);
        return;
      }
      const assetUrl = typeof browser !== "undefined" && browser.runtime?.getURL
        ? browser.runtime.getURL(sound.asset)
        : new URL(`../${sound.asset}`, soundsScriptUrl).href;
      const audio = new globalThis.Audio(assetUrl);
      audio.preload = "auto";
      audio.volume = Math.max(0, Math.min(1, Number(volume) || 0.55));
      activeAudio.add(audio);
      audio.addEventListener("ended", () => activeAudio.delete(audio), { once: true });
      audio.play().catch(error => {
        activeAudio.delete(audio);
        console.error(`Could not play sound asset: ${sound.asset}`, error);
      });
      return;
    }
    playSynthesizedSound(resolvedId, volume);
  }

  function getAllSounds() {
    return [...SOUNDS];
  }

  function getSoundInfo(soundId) {
    return SOUNDS.find(s => s.id === soundId) || SOUNDS[0];
  }

  const WebNudgeSounds = Object.freeze({
    SOUNDS,
    play,
    playBreathingCue,
    startBreathingAmbience,
    setBreathingAmbiencePhase,
    setBreathingAmbienceVolume,
    stopBreathingAmbience,
    getAllSounds,
    getSoundInfo
  });

  if (typeof globalThis !== "undefined") {
    globalThis.WebNudgeSounds = WebNudgeSounds;
  }
})();
