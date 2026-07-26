(function initializeCodeforcesDarkMode() {
  "use strict";

  const settings = globalThis.CodeforcesFeatureSettings;
  const root = document.documentElement;
  const DARK_MODE_CLASS = "cf-dark-mode";

  if (!settings || !root) {
    return;
  }

  function applyDarkMode(enabled) {
    root.classList.toggle(DARK_MODE_CLASS, enabled);
  }

  void settings.read().then(({ darkModeEnabled }) => {
    applyDarkMode(darkModeEnabled);
  });

  settings.subscribe(({ darkModeEnabled }) => {
    if (typeof darkModeEnabled === "boolean") {
      applyDarkMode(darkModeEnabled);
    }
  });
})();
