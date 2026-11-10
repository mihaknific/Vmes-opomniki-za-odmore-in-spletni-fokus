const previewExamples = {
  eyes: {
    name: "Odmor za oči",
    countdown: "Čez 10 min",
    icon: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
  },
  water: {
    name: "Kozarec vode",
    countdown: "Čez 5 min",
    icon: '<path d="M7 3h10l-1 18H8L7 3z"/><path d="M8 14h8"/>'
  },
  movement: {
    name: "Kratek razteg",
    countdown: "Čez 20 min",
    icon: '<circle cx="12" cy="4" r="2"/><path d="M5 9l7 2 7-2"/><path d="M12 11v5l-4 5"/><path d="M12 16l4 5"/>'
  }
};

const preview = document.querySelector(".addon-reminder-preview");
const previewName = document.querySelector("[data-preview-name]");
const previewCountdown = document.querySelector("[data-preview-countdown]");
const previewProgress = document.querySelector("[data-preview-progress]");
const previewIcon = document.querySelector(".preview-reminder-icon svg");
const previewIndicators = document.querySelectorAll(".preview-carousel-indicator span");
const previewSequence = Object.keys(previewExamples);
const previewInterval = 5000;
const reducedMotionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

if (preview && previewName && previewCountdown && previewProgress && previewIcon) {
  let currentPreview = 0;
  let timer;

  const stopRotation = () => {
    window.clearInterval(timer);
    if (timer !== undefined) {
      const progressWidth = getComputedStyle(previewProgress).width;
      previewProgress.style.transition = "none";
      previewProgress.style.width = progressWidth;
    }
    timer = undefined;
  };

  const resetProgress = (animate = false) => {
    previewProgress.style.transition = "none";
    previewProgress.style.width = "0";
    void previewProgress.offsetWidth;

    if (animate) {
      previewProgress.style.transition = "";
      previewProgress.style.width = "100%";
    }
  };

  const showNextPreview = () => {
    currentPreview = (currentPreview + 1) % previewSequence.length;
    const example = previewExamples[previewSequence[currentPreview]];

    preview.classList.remove("is-changing");

    previewName.textContent = example.name;
    previewCountdown.textContent = example.countdown;
    previewIcon.innerHTML = example.icon;
    previewIndicators.forEach((indicator, index) => {
      indicator.classList.toggle("is-active", index === currentPreview);
    });

    preview.classList.add("is-changing");
    resetProgress(true);
  };

  const startRotation = () => {
    stopRotation();
    if (!reducedMotionPreference.matches && !document.hidden && !preview.matches(":hover") && !preview.contains(document.activeElement)) {
      resetProgress(true);
      timer = window.setInterval(showNextPreview, previewInterval);
    } else {
      resetProgress();
    }
  };

  preview.addEventListener("mouseenter", stopRotation);
  preview.addEventListener("mouseleave", startRotation);
  preview.addEventListener("focusin", stopRotation);
  preview.addEventListener("focusout", startRotation);
  document.addEventListener("visibilitychange", startRotation);
  reducedMotionPreference.addEventListener("change", startRotation);
  startRotation();
}
