"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("applies regular and OLED dark mode as settings change", async () => {
  const classes = new Set();
  const listeners = new Set();
  const chrome = {
    runtime: {},
    storage: {
      local: {
        get(keys, callback) {
          callback({
            codeforcesDarkModeEnabled: false,
            codeforcesOledModeEnabled: true,
            codeforcesRatingEnabled: true
          });
        },
        set(values, callback) {
          callback?.();
        }
      },
      onChanged: {
        addListener(listener) {
          listeners.add(listener);
        },
        removeListener(listener) {
          listeners.delete(listener);
        }
      }
    }
  };
  const context = vm.createContext({
    chrome,
    document: {
      documentElement: {
        classList: {
          contains: (name) => classes.has(name),
          toggle(name, force) {
            if (force) {
              classes.add(name);
            } else {
              classes.delete(name);
            }
          }
        }
      }
    }
  });
  const settingsSource = fs.readFileSync(
    path.join(__dirname, "../src/settings.js"),
    "utf8"
  );
  const themeSource = fs.readFileSync(
    path.join(__dirname, "../src/theme.js"),
    "utf8"
  );

  vm.runInContext(settingsSource, context);
  vm.runInContext(themeSource, context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(classes.has("cf-dark-mode"), true);
  assert.equal(classes.has("cf-oled-mode"), true);

  for (const listener of listeners) {
    listener(
      {
        codeforcesOledModeEnabled: {
          oldValue: true,
          newValue: false
        }
      },
      "local"
    );
  }
  assert.equal(classes.has("cf-dark-mode"), false);
  assert.equal(classes.has("cf-oled-mode"), false);
});
