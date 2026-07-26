(function initializePopup() {
  "use strict";

  const settings = globalThis.CodeforcesFeatureSettings;
  const ratingToggle = document.querySelector("#rating-toggle");
  const darkModeToggle = document.querySelector("#dark-mode-toggle");
  const oledModeToggle = document.querySelector("#oled-mode-toggle");
  const status = document.querySelector("#status");

  if (!settings || !ratingToggle || !darkModeToggle || !oledModeToggle || !status) {
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
    },
    {
      element: oledModeToggle,
      feature: "oledModeEnabled"
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
    const updates = {
      [control.feature]: control.element.checked
    };

    if (control.feature === "oledModeEnabled" && control.element.checked) {
      darkModeToggle.checked = true;
      updates.darkModeEnabled = true;
    } else if (
      control.feature === "darkModeEnabled" &&
      !control.element.checked
    ) {
      oledModeToggle.checked = false;
      updates.oledModeEnabled = false;
    }

    try {
      await settings.setMany(updates);
    } catch (error) {
      const saved = await settings.read();
      for (const item of controls) {
        item.element.checked = saved[item.feature];
      }
      showError(error);
    }
  }

  function showError(error) {
    status.textContent =
      error instanceof Error ? error.message : "Could not save this setting.";
  }
})();
