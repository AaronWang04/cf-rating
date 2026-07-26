(function initializePopup() {
  "use strict";

  const settings = globalThis.CodeforcesFeatureSettings;
  const ratingToggle = document.querySelector("#rating-toggle");
  const darkModeToggle = document.querySelector("#dark-mode-toggle");
  const status = document.querySelector("#status");

  if (!settings || !ratingToggle || !darkModeToggle || !status) {
    return;
  }

  const controls = [
    {
      element: ratingToggle,
      feature: "ratingEnabled"
    },
    {
      element: darkModeToggle,
      feature: "darkModeEnabled"
    }
  ];

  void settings
    .read()
    .then((saved) => {
      for (const control of controls) {
        control.element.checked = saved[control.feature];
        control.element.disabled = false;
        control.element.addEventListener("change", () => {
          void saveControl(control);
        });
      }
    })
    .catch(showError);

  async function saveControl(control) {
    status.textContent = "";

    try {
      await settings.set(control.feature, control.element.checked);
    } catch (error) {
      control.element.checked = !control.element.checked;
      showError(error);
    }
  }

  function showError(error) {
    status.textContent =
      error instanceof Error ? error.message : "Could not save this setting.";
  }
})();
