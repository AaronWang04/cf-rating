"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const settings = require("../src/settings.js");

test("uses backward-compatible feature defaults", () => {
  assert.deepEqual(settings.normalize(), {
    darkModeEnabled: false,
    oledModeEnabled: false,
    ratingEnabled: true
  });
  assert.deepEqual(
    settings.normalize({
      codeforcesDarkModeEnabled: true,
      codeforcesOledModeEnabled: true,
      codeforcesRatingEnabled: false
    }),
    {
      darkModeEnabled: true,
      oledModeEnabled: true,
      ratingEnabled: false
    }
  );
});

test("reads, writes, and publishes feature setting changes", async (context) => {
  const originalChrome = globalThis.chrome;
  const stored = {
    codeforcesDarkModeEnabled: true,
    codeforcesOledModeEnabled: false,
    codeforcesRatingEnabled: true
  };
  const listeners = new Set();

  globalThis.chrome = {
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
  context.after(() => {
    globalThis.chrome = originalChrome;
  });

  assert.deepEqual(await settings.read(), {
    darkModeEnabled: true,
    oledModeEnabled: false,
    ratingEnabled: true
  });

  await settings.setMany({
    darkModeEnabled: true,
    oledModeEnabled: true,
    ratingEnabled: false
  });
  assert.equal(stored.codeforcesRatingEnabled, false);
  assert.equal(stored.codeforcesOledModeEnabled, true);

  let received = null;
  const unsubscribe = settings.subscribe((changed) => {
    received = changed;
  });
  for (const listener of listeners) {
    listener(
      {
        codeforcesOledModeEnabled: {
          oldValue: false,
          newValue: true
        }
      },
      "local"
    );
  }

  assert.deepEqual(received, { oledModeEnabled: true });
  unsubscribe();
  assert.equal(listeners.size, 0);
});

test("rejects unknown feature names", async () => {
  await assert.rejects(() => settings.set("unknownFeature", true), /Unknown feature/);
});
