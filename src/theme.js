(function initializeCodeforcesDarkMode() {
  "use strict";

  const settings = globalThis.CodeforcesFeatureSettings;
  const root = document.documentElement;
  const DARK_MODE_CLASS = "cf-dark-mode";
  const OLED_MODE_CLASS = "cf-oled-mode";
  let currentSettings = { ...settings?.DEFAULTS };

  if (!settings || !root) {
    return;
  }

  function applyTheme() {
    root.classList.toggle(
      DARK_MODE_CLASS,
      currentSettings.darkModeEnabled || currentSettings.oledModeEnabled
    );
    root.classList.toggle(OLED_MODE_CLASS, currentSettings.oledModeEnabled);
  }

  void settings.read().then((saved) => {
    currentSettings = saved;
    applyTheme();
  });

  settings.subscribe((changed) => {
    currentSettings = { ...currentSettings, ...changed };
    applyTheme();
  });
})();
