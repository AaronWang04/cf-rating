"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const manifest = require("../manifest.json");

test("registers a feature popup and all-page dark theme", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.action.default_popup, "popup/popup.html");
  assert.equal(manifest.permissions.includes("storage"), true);

  const allPageScript = manifest.content_scripts.find((entry) =>
    entry.matches.includes("https://codeforces.com/*")
  );
  assert.ok(allPageScript);
  assert.equal(allPageScript.js.includes("src/theme.js"), true);
  assert.equal(allPageScript.css.includes("src/dark.css"), true);
});

test("popup only loads packaged scripts", () => {
  const popup = fs.readFileSync(
    path.join(__dirname, "../popup/popup.html"),
    "utf8"
  );

  assert.match(popup, /id="rating-toggle"/);
  assert.match(popup, /id="dark-mode-toggle"/);
  assert.match(popup, /id="oled-mode-toggle"/);
  assert.doesNotMatch(popup, /<script[^>]+src=["']https?:/i);
});
