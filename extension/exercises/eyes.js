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

  const EXERCISES = [
    {
      title: "Pogled levo in desno",
      desc: "Poglejte izmenično levo in desno. Ponovite 10-krat.",
      image: "images/vaje_oci/01_levo-desno_levo.png",
      pairedImage: "images/vaje_oci/01_levo-desno_desno.png"
    },
    {
      title: "Pogled gor in dol",
      desc: "Poglejte izmenično gor in dol. Ponovite 10-krat.",
      image: "images/vaje_oci/02_gor-dol_gor.png",
      pairedImage: "images/vaje_oci/02_gor-dol_dol.png"
    },
    {
      title: "Diagonalno: levo zgoraj – desno spodaj",
      desc: "Poglejte izmenično v zgornji levi in spodnji desni kot. Ponovite 10-krat.",
      image: "images/vaje_oci/03_diagonala_levo-zgoraj.png",
      pairedImage: "images/vaje_oci/03_diagonala_desno-spodaj.png",
      pairedAlt: "Pogled diagonalno desno spodaj"
    },
    {
      title: "Diagonalno: desno zgoraj – levo spodaj",
      desc: "Poglejte izmenično v zgornji desni in spodnji levi kot. Ponovite 10-krat.",
      image: "images/vaje_oci/04_diagonala_desno-zgoraj.png",
      pairedImage: "images/vaje_oci/04_diagonala_levo-spodaj.png",
      pairedAlt: "Pogled diagonalno levo spodaj"
    },
    {
      title: "Sledenje kvadratu",
      desc: "Sledite kvadratu z očmi 2-krat v smeri urinega kazalca, nato 5-krat v nasprotni smeri.",
      image: "images/vaje_oci/01_levo-desno_desno.png",
      diagram: "square"
    },
    {
      title: "Kroženje po krogu",
      desc: "S kroženjem po krogu 2-krat sledite smeri urinega kazalca, nato 5-krat nasprotni smeri.",
      image: "images/vaje_oci/01_levo-desno_desno.png",
      diagram: "circle"
    },
    {
      title: "Sledenje trikotniku",
      desc: "Sledite obrisu trikotnika 2-krat v smeri urinega kazalca, nato 5-krat v nasprotni smeri.",
      image: "images/vaje_oci/01_levo-desno_desno.png",
      diagram: "triangle"
    },
    {
      title: "Sledenje obrnjenemu trikotniku",
      desc: "Sledite obrisu obrnjenega trikotnika 2-krat v smeri urinega kazalca, nato 5-krat v nasprotni smeri.",
      image: "images/vaje_oci/01_levo-desno_desno.png",
      diagram: "inverted-triangle"
    },
    {
      title: "Pogled blizu in daleč",
      desc: "Izmenično izostrite pogled na bližnji in oddaljeni predmet.",
      image: "images/vaje_oci/05_blizu-dalec.png"
    },
    {
      title: "Počitek",
      desc: "Zaprite oči in jih za trenutek sprostite.",
      image: "images/vaje_oci/06_pocitek_zaprte-oci.png"
    }
  ];

  let currentIndex = 0;

  const exerciseImg = document.getElementById("exercise-image");
  const pairedImg = document.getElementById("exercise-image-paired");
  const exerciseDiagram = document.getElementById("exercise-diagram");
  const imageFrame = exerciseImg.parentElement;
  const stepBadge = document.getElementById("step-badge");
  const exerciseTitle = document.getElementById("exercise-title");
  const exerciseDesc = document.getElementById("exercise-desc");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");

  function selectExercise(index) {
    currentIndex = Math.max(0, Math.min(index, EXERCISES.length - 1));
    const exercise = EXERCISES[currentIndex];

    exerciseImg.src = exercise.image;
    exerciseImg.alt = exercise.title;
    exerciseImg.classList.toggle("is-mirrored", exercise.mirror === true);
    pairedImg.hidden = !exercise.pairedImage;
    if (exercise.pairedImage) pairedImg.src = exercise.pairedImage;
    pairedImg.alt = exercise.pairedAlt ?? "";
    exerciseDiagram.hidden = !exercise.diagram;
    exerciseDiagram.dataset.shape = exercise.diagram ?? "";
    imageFrame.classList.toggle("has-pair", Boolean(exercise.pairedImage || exercise.diagram));
    imageFrame.classList.toggle("has-diagram", Boolean(exercise.diagram));
    stepBadge.textContent = `${currentIndex + 1} / ${EXERCISES.length}`;
    exerciseTitle.textContent = exercise.title;
    exerciseDesc.textContent = exercise.desc;
    btnPrev.disabled = currentIndex === 0;
    btnNext.disabled = currentIndex === EXERCISES.length - 1;
  }

  btnPrev.addEventListener("click", () => selectExercise(currentIndex - 1));
  btnNext.addEventListener("click", () => selectExercise(currentIndex + 1));

  window.addEventListener("keydown", event => {
    if (event.target instanceof HTMLElement && event.target.closest("button, input, textarea, select")) return;
    if (event.code === "ArrowRight" && currentIndex < EXERCISES.length - 1) {
      event.preventDefault();
      selectExercise(currentIndex + 1);
    } else if (event.code === "ArrowLeft" && currentIndex > 0) {
      event.preventDefault();
      selectExercise(currentIndex - 1);
    }
  });

  selectExercise(0);
})();
