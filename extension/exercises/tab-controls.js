(() => {
  const brandLink = document.querySelector(".vmes-brand");
  if (brandLink && typeof browser !== "undefined" && browser.runtime?.getURL) {
    brandLink.href = browser.runtime.getURL("options/options.html");
    brandLink.title = "Nazaj na nastavitve opomnikov";
  }

  async function closeExerciseTab(button) {
    if (!button || button.disabled) return;
    button.disabled = true;

    try {
      const response = await browser.runtime.sendMessage({ type: "CLOSE_EXERCISE_TAB" });
      if (!response?.ok) throw new Error(response?.error || "Zavihka ni bilo mogoče zapreti.");
    } catch (error) {
      console.error("Zapiranje zavihka ni uspelo:", error);
      const originalContent = button.innerHTML;
      const originalTitle = button.title;
      const originalLabel = button.getAttribute("aria-label");
      button.disabled = false;
      button.textContent = "Zapiranje ni uspelo";
      button.title = "Zavihka ni bilo mogoče zapreti. Poskusite znova.";
      button.setAttribute("aria-label", button.title);
      window.setTimeout(() => {
        button.innerHTML = originalContent;
        button.title = originalTitle;
        if (originalLabel) button.setAttribute("aria-label", originalLabel);
        else button.removeAttribute("aria-label");
      }, 5000);
    }
  }

  document.querySelectorAll("#close-tab-btn, #close-btn").forEach(button => {
    button.addEventListener("click", () => closeExerciseTab(button));
  });

  window.closeExerciseTab = () => closeExerciseTab(document.getElementById("close-btn") || document.getElementById("close-tab-btn"));
})();
