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

test("inserts a native-style rating box immediately after Problem tags", async () => {
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
    ratings: { "4:A": 800 }
  };
  const chrome = {
    runtime: {},
    storage: {
      local: {
        get(key, callback) {
          callback({ [key]: cache });
        }
      }
    }
  };
  const source = fs.readFileSync(
    path.join(__dirname, "../src/content.js"),
    "utf8"
  );

  vm.runInNewContext(source, {
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
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(sidebar.children.length, 2);
  assert.equal(sidebar.children[0], tagsBox);

  const ratingBox = sidebar.children[1];
  assert.equal(ratingBox.id, "cf-problem-rating");
  assert.equal(ratingBox.className, "roundbox sidebox");
  assert.match(ratingBox.querySelector(".caption").textContent, /Problem rating/);
  assert.equal(ratingBox.querySelector(".tag-box").textContent, "*800");
});
