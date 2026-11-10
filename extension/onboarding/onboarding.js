const slides = [...document.querySelectorAll(".slide")];
const dots = [...document.querySelectorAll(".dots i")];
let index = 0;
let selectedPath = "reminders";

if (typeof browser !== "undefined" && browser.storage?.local) {
  browser.storage.local.get("settings").then(data => {
    if (data?.settings && typeof WebNudgeAppearance !== "undefined") {
      WebNudgeAppearance.apply(data.settings);
    }
  });
}

function render() {
  slides.forEach((slide, i) => slide.classList.toggle("active", i === index));
  dots.forEach((dot, i) => dot.classList.toggle("on", i === index));
  const counter = document.getElementById("step-counter") || document.querySelector("header span");
  if (counter) counter.textContent = `Korak ${index + 1} od ${slides.length}`;
  document.getElementById("next").textContent = index === slides.length - 1 ? "Odpri izbrano" : "Naprej";
}

async function finish(path = "reminders") {
  const route = path === "focus" ? "#focus" : "#reminders";
  if (typeof browser === "undefined" || !browser.runtime?.sendMessage) {
    window.location.href = `../options/options.html${route}`;
    return;
  }

  const errorElement = document.getElementById("onboarding-error");
  errorElement.hidden = true;
  try {
    const result = await browser.runtime.sendMessage({ type: "SET_ONBOARDING_COMPLETE" });
    if (result?.ok === false) throw new Error(result.error || "Nastavitve začetka ni bilo mogoče shraniti.");
    window.location.replace(browser.runtime.getURL(`options/options.html${route}`));
  } catch (error) {
    console.error("Začetnega zaslona ni bilo mogoče dokončati.", error);
    errorElement.textContent = error?.message || "Nastavitve ni bilo mogoče shraniti. Poskusite znova.";
    errorElement.hidden = false;
  }
}

document.getElementById("next").onclick = () => {
  if (index === slides.length - 1) return finish(selectedPath);
  else { index += 1; render(); }
};
document.getElementById("skip").onclick = () => finish();
document.querySelectorAll("[data-start-path]").forEach(button => {
  button.addEventListener("click", () => {
    selectedPath = button.dataset.startPath === "focus" ? "focus" : "reminders";
    document.querySelectorAll("[data-start-path]").forEach(option => {
      const selected = option === button;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    });
  });
});
document.addEventListener("keydown", event => {
  if (event.target.closest?.("button, a, input, select, textarea, [contenteditable='true']")) return;
  if (event.key === "ArrowRight") document.getElementById("next").click();
  if (event.key === "ArrowLeft" && index > 0) { index -= 1; render(); }
});
render();
