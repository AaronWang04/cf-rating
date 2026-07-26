"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../src/core.js");

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.className = "";
    this.id = "";
    this.title = "";
    this._text = "";
  }

  append(...items) {
    for (const item of items) {
      if (typeof item === "string") {
        this._text += item;
      } else {
        item.parentElement = this;
        this.children.push(item);
      }
    }
  }

  appendChild(element) {
    this.append(element);
    return element;
  }

  replaceChildren(...items) {
    this.children = [];
    this._text = "";
    this.append(...items);
  }

  remove() {
    if (!this.parentElement) {
      return;
    }

    const siblings = this.parentElement.children;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentElement = null;
  }

  insertAdjacentElement(position, element) {
    assert.equal(position, "afterend");
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    element.parentElement = this.parentElement;
    siblings.splice(index + 1, 0, element);
    return element;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const matches = [];

    for (const child of this.children) {
      if (child.matches(selector)) {
        matches.push(child);
      }
      matches.push(...child.querySelectorAll(selector));
    }

    return matches;
  }

  matches(selector) {
    if (selector.startsWith(".")) {
      return this.className.split(/\s+/).includes(selector.slice(1));
    }
    if (selector.startsWith("#")) {
      return this.id === selector.slice(1);
    }
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }

  set textContent(value) {
    this.children = [];
    this._text = String(value);
  }

  get textContent() {
    return this._text + this.children.map((child) => child.textContent).join("");
  }

  set innerHTML(value) {
    this._text = String(value);
  }
}

test("independently toggles rating and tags in a native-style box", async () => {
  const sidebar = new FakeElement("div");
  sidebar.id = "sidebar";

  const tagsBox = new FakeElement("div");
  tagsBox.className = "roundbox sidebox";
  const tagsCaption = new FakeElement("div");
  tagsCaption.className = "caption titled";
  tagsCaption.textContent = "→ Problem tags";
  tagsBox.append(tagsCaption);
  sidebar.append(tagsBox);

  const document = {
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: (id) =>
      sidebar.id === id ? sidebar : sidebar.querySelector(`#${id}`),
    querySelector: (selector) => (selector === "#sidebar" ? sidebar : null)
  };

  const cache = {
    version: core.CACHE_VERSION,
    storedAt: Date.now(),
    problems: {
      "4:A": {
        rating: 800,
        tags: ["brute force", "math"]
      }
    }
  };
  const stored = {
    codeforcesDarkModeEnabled: false,
    codeforcesProblemMetadata: cache,
    codeforcesProblemTagsEnabled: true,
    codeforcesRatingEnabled: true
  };
  const changeListeners = new Set();
  const chrome = {
    runtime: {},
    storage: {
      local: {
        get(keys, callback) {
          const requested = Array.isArray(keys) ? keys : [keys];
          callback(
            Object.fromEntries(
              requested
                .filter((key) => Object.hasOwn(stored, key))
                .map((key) => [key, stored[key]])
            )
          );
        },
        set(values, callback) {
          Object.assign(stored, values);
          callback?.();
        }
      },
      onChanged: {
        addListener(listener) {
          changeListeners.add(listener);
        },
        removeListener(listener) {
          changeListeners.delete(listener);
        }
      }
    }
  };
  const settingsSource = fs.readFileSync(
    path.join(__dirname, "../src/settings.js"),
    "utf8"
  );
  const contentSource = fs.readFileSync(
    path.join(__dirname, "../src/content.js"),
    "utf8"
  );
  const context = vm.createContext({
    CodeforcesRating: core,
    URL,
    chrome,
    console,
    document,
    window: {
      location: {
        href: "https://codeforces.com/problemset/problem/4/A",
        origin: "https://codeforces.com"
      }
    }
  });
  vm.runInContext(settingsSource, context);
  vm.runInContext(contentSource, context);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(sidebar.children.length, 2);
  assert.equal(sidebar.children[0], tagsBox);

  const ratingBox = sidebar.children[1];
  assert.equal(ratingBox.id, "cf-problem-rating");
  assert.equal(ratingBox.className, "roundbox sidebox");
  assert.match(ratingBox.querySelector(".caption").textContent, /Problem info/);
  assert.deepEqual(
    ratingBox.querySelectorAll(".tag-box").map((element) => element.textContent),
    ["*800", "brute force", "math"]
  );

  for (const listener of changeListeners) {
    listener(
      {
        codeforcesRatingEnabled: {
          oldValue: true,
          newValue: false
        }
      },
      "local"
    );
  }
  await new Promise((resolve) => setImmediate(resolve));
  const tagsOnlyBox = sidebar.querySelector("#cf-problem-rating");
  assert.match(tagsOnlyBox.querySelector(".caption").textContent, /Problem tags/);
  assert.deepEqual(
    tagsOnlyBox.querySelectorAll(".tag-box").map((element) => element.textContent),
    ["brute force", "math"]
  );

  for (const listener of changeListeners) {
    listener(
      {
        codeforcesProblemTagsEnabled: {
          oldValue: true,
          newValue: false
        }
      },
      "local"
    );
  }
  assert.equal(sidebar.querySelector("#cf-problem-rating"), null);

  for (const listener of changeListeners) {
    listener(
      {
        codeforcesRatingEnabled: {
          oldValue: false,
          newValue: true
        }
      },
      "local"
    );
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    sidebar.querySelector("#cf-problem-rating .tag-box")?.textContent ??
      sidebar.querySelector("#cf-problem-rating")?.querySelector(".tag-box")
        ?.textContent,
    "*800"
  );
});
