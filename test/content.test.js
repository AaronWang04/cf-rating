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
    this.href = "";
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

  insertBefore(element, reference) {
    const index = this.children.indexOf(reference);
    assert.notEqual(index, -1);
    element.parentElement = this;
    this.children.splice(index, 0, element);
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
    const tagAndClass = selector.match(/^([a-z]+)\.([a-z0-9_-]+)$/i);
    if (tagAndClass) {
      return (
        this.tagName === tagAndClass[1].toUpperCase() &&
        this.className.split(/\s+/).includes(tagAndClass[2])
      );
    }
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

  get cells() {
    return this.children.filter((child) =>
      ["TD", "TH"].includes(child.tagName)
    );
  }

  set innerHTML(value) {
    this._text = String(value);
  }

  get innerHTML() {
    return this.textContent;
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

test("shows ratings in a contest problem table and follows the rating toggle", async () => {
  const root = new FakeElement("div");
  const table = new FakeElement("table");
  table.className = "problems";

  const headerRow = new FakeElement("tr");
  for (const [text, className] of [
    ["#", "top left"],
    ["Name", "top"],
    ["", "top"],
    ["", "top right"]
  ]) {
    const cell = new FakeElement("th");
    cell.textContent = text;
    cell.className = className;
    headerRow.append(cell);
  }
  table.append(headerRow);

  function appendProblemRow(index, isDark, ratingExpected) {
    const row = new FakeElement("tr");
    const idCell = new FakeElement("td");
    idCell.className = `id ${isDark ? "dark " : ""}left`;
    const link = new FakeElement("a");
    link.href = `https://codeforces.com/contest/2227/problem/${index}`;
    link.textContent = index;
    idCell.append(link);

    const nameCell = new FakeElement("td");
    nameCell.className = isDark ? "dark" : "";
    nameCell.textContent = `Problem ${index}`;
    const actionCell = new FakeElement("td");
    actionCell.className = isDark ? "act dark" : "act";
    const solvedCell = new FakeElement("td");
    solvedCell.className = `${isDark ? "dark " : ""}right`;
    row.append(idCell, nameCell, actionCell, solvedCell);
    table.append(row);
    return { ratingExpected, row };
  }

  const problemA = appendProblemRow("A", true, "*800");
  const problemB = appendProblemRow("B", false, "—");
  root.append(table);

  const cache = {
    version: core.CACHE_VERSION,
    storedAt: Date.now(),
    problems: {
      "2227:A": { rating: 800, tags: [] },
      "2227:B": { rating: null, tags: [] }
    }
  };
  const stored = {
    codeforcesProblemMetadata: cache,
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
  const document = {
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: () => null,
    querySelector: (selector) =>
      selector === "table.problems" ? table : root.querySelector(selector),
    querySelectorAll: (selector) => root.querySelectorAll(selector)
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
        href: "https://codeforces.com/contest/2227",
        origin: "https://codeforces.com"
      }
    }
  });

  vm.runInContext(settingsSource, context);
  vm.runInContext(contentSource, context);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(headerRow.cells[2].textContent, "Rating");
  for (const { ratingExpected, row } of [problemA, problemB]) {
    assert.equal(row.cells[2].textContent, ratingExpected);
  }
  assert.match(problemA.row.cells[2].className, /\bdark\b/);
  assert.match(problemB.row.cells[2].className, /unavailable/);

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

  assert.equal(headerRow.cells.length, 4);
  assert.equal(problemA.row.cells.length, 4);
  assert.equal(problemB.row.cells.length, 4);
});

test("fills the native problemset rating column and restores it when disabled", async () => {
  const root = new FakeElement("div");
  const table = new FakeElement("table");
  table.className = "problems";

  const headerRow = new FakeElement("tr");
  for (let index = 0; index < 5; index += 1) {
    const cell = new FakeElement("th");
    cell.className = "top";
    if (index === 3) {
      const sortLink = new FakeElement("a");
      sortLink.href =
        "https://codeforces.com/problemset?order=BY_RATING_DESC";
      cell.append(sortLink);
    }
    headerRow.append(cell);
  }
  table.append(headerRow);

  function appendProblemRow(contestId, index, isDark, nativeRating = "") {
    const row = new FakeElement("tr");
    const idCell = new FakeElement("td");
    idCell.className = `id ${isDark ? "dark " : ""}left`;
    const link = new FakeElement("a");
    link.href =
      `https://codeforces.com/problemset/problem/${contestId}/${index}`;
    idCell.append(link);

    const nameCell = new FakeElement("td");
    nameCell.className = isDark ? "dark" : "";
    const actionCell = new FakeElement("td");
    actionCell.className = isDark ? "act dark" : "act";
    const ratingCell = new FakeElement("td");
    ratingCell.className = isDark ? "dark" : "";
    ratingCell.textContent = nativeRating;
    const solvedCell = new FakeElement("td");
    solvedCell.className = `${isDark ? "dark " : ""}right`;
    row.append(idCell, nameCell, actionCell, ratingCell, solvedCell);
    table.append(row);
    return { ratingCell, row };
  }

  const problemA = appendProblemRow(2250, "A", true);
  const problemB = appendProblemRow(2250, "B", false, "1200");
  const problemC = appendProblemRow(2250, "C", true);
  root.append(table);

  const stored = {
    codeforcesProblemMetadata: {
      version: core.CACHE_VERSION,
      storedAt: Date.now(),
      problems: {
        "2250:A": { rating: 800, tags: [] },
        "2250:B": { rating: null, tags: [] },
        "2250:C": { rating: null, tags: [] }
      }
    },
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
  const document = {
    createElement: (tagName) => new FakeElement(tagName),
    getElementById: () => null,
    querySelector: (selector) =>
      selector === "table.problems" ? table : root.querySelector(selector),
    querySelectorAll: (selector) => root.querySelectorAll(selector)
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
        href: "https://codeforces.com/problemset",
        origin: "https://codeforces.com"
      }
    }
  });

  vm.runInContext(settingsSource, context);
  vm.runInContext(contentSource, context);
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(headerRow.cells.length, 5);
  assert.equal(problemA.row.cells.length, 5);
  assert.equal(problemA.ratingCell.textContent, "800");
  assert.match(problemA.ratingCell.className, /cf-problemset-rating-cell/);
  assert.equal(problemB.ratingCell.textContent, "1200");
  assert.equal(problemC.ratingCell.textContent, "—");

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

  assert.equal(problemA.ratingCell.textContent, "");
  assert.equal(problemB.ratingCell.textContent, "1200");
  assert.equal(problemC.ratingCell.textContent, "");
  assert.doesNotMatch(
    problemA.ratingCell.className,
    /cf-problemset-rating-cell/
  );
});
