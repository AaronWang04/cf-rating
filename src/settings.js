(function initializeCodeforcesFeatureSettings(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.CodeforcesFeatureSettings = api;
  }
})(typeof globalThis === "undefined" ? this : globalThis, function createSettingsApi() {
  "use strict";

  const STORAGE_KEYS = Object.freeze({
    darkModeEnabled: "codeforcesDarkModeEnabled",
    ratingEnabled: "codeforcesRatingEnabled"
  });
  const DEFAULTS = Object.freeze({
    darkModeEnabled: false,
    ratingEnabled: true
  });

  function normalize(stored = {}) {
    return {
      darkModeEnabled:
        typeof stored[STORAGE_KEYS.darkModeEnabled] === "boolean"
          ? stored[STORAGE_KEYS.darkModeEnabled]
          : DEFAULTS.darkModeEnabled,
      ratingEnabled:
        typeof stored[STORAGE_KEYS.ratingEnabled] === "boolean"
          ? stored[STORAGE_KEYS.ratingEnabled]
          : DEFAULTS.ratingEnabled
    };
  }

  function read() {
    return new Promise((resolve) => {
      const storage = globalThis.chrome?.storage?.local;

      if (!storage) {
        resolve({ ...DEFAULTS });
        return;
      }

      storage.get(Object.values(STORAGE_KEYS), (stored) => {
        if (globalThis.chrome?.runtime?.lastError) {
          resolve({ ...DEFAULTS });
          return;
        }

        resolve(normalize(stored));
      });
    });
  }

  function set(feature, enabled) {
    return new Promise((resolve, reject) => {
      const storageKey = STORAGE_KEYS[feature];
      const storage = globalThis.chrome?.storage?.local;

      if (!storageKey) {
        reject(new Error(`Unknown feature setting: ${feature}`));
        return;
      }

      if (!storage) {
        resolve();
        return;
      }

      storage.set({ [storageKey]: Boolean(enabled) }, () => {
        const error = globalThis.chrome?.runtime?.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve();
      });
    });
  }

  function subscribe(listener) {
    const storageEvents = globalThis.chrome?.storage?.onChanged;

    if (!storageEvents) {
      return function unsubscribe() {};
    }

    const handleChange = (changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      const changedSettings = {};

      for (const [feature, storageKey] of Object.entries(STORAGE_KEYS)) {
        const value = changes[storageKey]?.newValue;
        if (typeof value === "boolean") {
          changedSettings[feature] = value;
        }
      }

      if (Object.keys(changedSettings).length > 0) {
        listener(changedSettings);
      }
    };

    storageEvents.addListener(handleChange);
    return function unsubscribe() {
      storageEvents.removeListener(handleChange);
    };
  }

  return Object.freeze({
    DEFAULTS,
    STORAGE_KEYS,
    normalize,
    read,
    set,
    subscribe
  });
});
