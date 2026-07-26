"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class FakeControl {
  constructor() {
    this.checked = false;
    this.disabled = true;
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  dispatch(type) {
    this.listeners.get(type)?.();
  }
}

test("popup initializes and persists both feature toggles", async () => {
  const ratingToggle = new FakeControl();
  const darkModeToggle = new FakeControl();
  const status = { textContent: "" };
  const stored = {
    codeforcesDarkModeEnabled: false,
    codeforcesRatingEnabled: true
  };
  const chrome = {
    runtime: {},
    storage: {
      local: {
        get(keys, callback) {
          callback(
            Object.fromEntries(
              keys
                .filter((key) => Object.hasOwn(stored, key))
                .map((key) => [key, stored[key]])
            )
          );
        },
        set(values, callback) {
          Object.assign(stored, values);
          callback();
        }
      }
    }
  };
  const elements = {
    "#dark-mode-toggle": darkModeToggle,
    "#rating-toggle": ratingToggle,
    "#status": status
  };
  const context = vm.createContext({
    Error,
    chrome,
    document: {
      querySelector: (selector) => elements[selector] ?? null
    }
  });
  const settingsSource = fs.readFileSync(
    path.join(__dirname, "../src/settings.js"),
    "utf8"
  );
  const popupSource = fs.readFileSync(
    path.join(__dirname, "../popup/popup.js"),
    "utf8"
  );

  vm.runInContext(settingsSource, context);
  vm.runInContext(popupSource, context);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(ratingToggle.checked, true);
  assert.equal(ratingToggle.disabled, false);
  assert.equal(darkModeToggle.checked, false);
  assert.equal(darkModeToggle.disabled, false);

  darkModeToggle.checked = true;
  darkModeToggle.dispatch("change");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stored.codeforcesDarkModeEnabled, true);

  ratingToggle.checked = false;
  ratingToggle.dispatch("change");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(stored.codeforcesRatingEnabled, false);
  assert.equal(status.textContent, "");
});
