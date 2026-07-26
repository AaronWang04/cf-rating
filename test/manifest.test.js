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

test("dark theme defines Codeforces syntax highlighting palettes", () => {
  const darkTheme = fs.readFileSync(
    path.join(__dirname, "../src/dark.css"),
    "utf8"
  );

  for (const selector of [
    ".prettyprint .kwd",
    ".prettyprint .str",
    ".prettyprint .com",
    ".prettyprint ol.linenums li",
    ".ace-chrome .ace_keyword",
    ".ace-chrome .ace_string",
    ".ace-chrome .ace_marker-layer .ace_selection"
  ]) {
    assert.match(darkTheme, new RegExp(selector.replaceAll(".", "\\.")));
  }
});

test("dark theme covers compact ranking tables and legendary handles", () => {
  const darkTheme = fs.readFileSync(
    path.join(__dirname, "../src/dark.css"),
    "utf8"
  );

  assert.match(darkTheme, /table\.rtable td\.dark/);
  assert.match(darkTheme, /\.user-legendary \.legendary-user-first-letter/);
});

test("dark theme replaces Codeforces lava-menu images", () => {
  const darkTheme = fs.readFileSync(
    path.join(__dirname, "../src/dark.css"),
    "utf8"
  );

  assert.match(darkTheme, /li\.backLava/);
  assert.match(darkTheme, /li\.backLava > div/);
  assert.match(darkTheme, /background-image: none !important/);
  assert.match(darkTheme, /li\.selectedLava > a:visited/);
});
