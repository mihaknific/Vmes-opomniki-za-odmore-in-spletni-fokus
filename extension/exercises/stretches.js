(() => {
  "use strict";

  function applyTheme(settings) {
    if (settings && typeof WebNudgeAppearance !== "undefined") {
      WebNudgeAppearance.apply(settings);
    }
  }

  if (typeof browser !== "undefined" && browser.storage?.local) {
    browser.storage.local.get("settings").then(data => {
      applyTheme(data?.settings);
    }).catch(() => {});

    browser.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.settings?.newValue) {
        applyTheme(changes.settings.newValue);
      }
    });
  }

  const ALL_STRETCHES = [
    {
      id: "stretch-01", group: "neck",
      title: "Obrnite glavo levo in desno",
      desc: "Sedite vzravnano, ramena naj ostanejo sproščena. Počasi obrnite glavo v levo in nato v desno.",
      image: "images/vaje_telo/01.png"
    },
    {
      id: "stretch-02", group: "neck",
      title: "Pokimajte z glavo gor in dol",
      desc: "Počasi spustite brado proti prsnemu košu, nato glavo nežno dvignite v nevtralen položaj. Ne nagibajte je sunkovito nazaj.",
      image: "images/vaje_telo/02.png"
    },
    {
      id: "stretch-03", group: "neck",
      title: "Nagnite glavo levo in desno",
      desc: "Uho nežno približajte rami, ne da bi ramo dvignili. Vrnite glavo na sredino in ponovite na drugi strani.",
      image: "images/vaje_telo/03.png"
    },
    {
      id: "stretch-04", group: "neck",
      title: "Zakrožite z rameni",
      desc: "Z rameni počasi krožite naprej in nato še nazaj. Gib naj bo sproščen in brez sunkov.",
      image: "images/vaje_telo/04.png"
    },
    {
      id: "stretch-05", group: "neck",
      title: "Približajte in razmaknite lopatici",
      desc: "Nežno povlecite ramena nazaj in približajte lopatici, nato ju sprostite in razmaknite. Ponovite počasi.",
      image: "images/vaje_telo/05.png"
    },
    {
      id: "stretch-06", group: "upper",
      title: "Raztegnite roko vstran",
      desc: "Iztegnite eno roko vstran in se nežno nagnite v nasprotno smer. Vrnite se na sredino in zamenjajte stran.",
      image: "images/vaje_telo/06.png"
    },
    {
      id: "stretch-07", group: "upper",
      title: "Raztegnite trup vstran",
      desc: "Dvignite eno roko nad glavo in se nežno nagnite v nasprotno smer. Vrnite se na sredino in ponovite na drugi strani.",
      image: "images/vaje_telo/07.png"
    },
    {
      id: "stretch-08", group: "upper",
      title: "Stegnite se navzgor",
      desc: "Prepletite prste in iztegnite roke nad glavo. Nežno se podaljšajte navzgor, brez bolečine.",
      image: "images/vaje_telo/08.png"
    },
    {
      id: "stretch-09", group: "upper",
      title: "Zakrožite z zapestji",
      desc: "Komolce sprostite in z zapestji počasi krožite v eno smer, nato še v drugo.",
      image: "images/vaje_telo/09.png"
    },
    {
      id: "stretch-10", group: "legs",
      title: "Raztegnite zadnjico čez koleno",
      desc: "Sede položite gleženj ene noge čez nasprotno koleno. Z ravnim hrbtom se rahlo nagnite naprej, nato zamenjajte nogo.",
      image: "images/vaje_telo/10.png"
    },
    {
      id: "stretch-11", group: "legs",
      title: "Dvignite nogo in zakrožite z gležnjem",
      desc: "Sede dvignite eno stopalo od tal in z gležnjem počasi zakrožite v obe smeri. Spustite nogo in ponovite z drugo.",
      image: "images/vaje_telo/11.png"
    }
  ];

  const GROUP_LABELS = {
    neck: "Vrat in ramena",
    upper: "Zgornji del telesa",
    legs: "Noge",
  };

  const urlParams = new URLSearchParams(window.location.search);
  const activeGroup = urlParams.get("group");
  const VALID_GROUPS = new Set(Object.keys(GROUP_LABELS));
  const STRETCHES = VALID_GROUPS.has(activeGroup)
    ? ALL_STRETCHES.filter(stretch => stretch.group === activeGroup)
    : ALL_STRETCHES;

  STRETCHES.forEach((stretch, index) => {
    stretch.badge = `Vaja ${index + 1} od ${STRETCHES.length}`;
  });

  if (activeGroup && GROUP_LABELS[activeGroup]) {
    const brandSpan = document.querySelector(".brand span");
    if (brandSpan) brandSpan.textContent = `SPLETNI OPOMNIK · ${GROUP_LABELS[activeGroup].toUpperCase()}`;
    document.title = `${GROUP_LABELS[activeGroup]} — Vmes`;
  }

  let currentIndex = 0;
  const exerciseImg = document.getElementById("exercise-image");
  const stepBadge = document.getElementById("step-badge");
  const exerciseTitle = document.getElementById("exercise-title");
  const exerciseDesc = document.getElementById("exercise-desc");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");

  function selectStretch(index) {
    currentIndex = Math.max(0, Math.min(index, STRETCHES.length - 1));
    const stretch = STRETCHES[currentIndex];

    exerciseImg.src = stretch.image;
    exerciseImg.classList.toggle("is-mirrored", stretch.mirror === true);
    exerciseImg.alt = stretch.title;
    stepBadge.textContent = stretch.badge;
    exerciseTitle.textContent = stretch.title;
    exerciseDesc.textContent = stretch.desc;

    if (currentIndex === STRETCHES.length - 1) {
      btnNext.classList.add("btn-finish");
      btnNext.innerHTML = `<span>Ponovi vaje</span> <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 1-2-5l3 5"/></svg>`;
    } else {
      btnNext.classList.remove("btn-finish");
      btnNext.innerHTML = `<span>Naslednja</span> <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>`;
    }

    btnPrev.disabled = currentIndex === 0;
  }

  btnPrev.addEventListener("click", () => {
    if (currentIndex > 0) selectStretch(currentIndex - 1);
  });

  btnNext.addEventListener("click", () => {
    if (currentIndex < STRETCHES.length - 1) {
      selectStretch(currentIndex + 1);
    } else {
      selectStretch(0);
    }
  });

  window.addEventListener("keydown", event => {
    if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") return;
    if (event.code === "ArrowRight") {
      event.preventDefault();
      btnNext.click();
    } else if (event.code === "ArrowLeft") {
      event.preventDefault();
      btnPrev.click();
    }
  });

  selectStretch(0);
})();
