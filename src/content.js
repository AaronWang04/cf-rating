(function showCodeforcesProblemMetadata() {
  "use strict";

  const core = globalThis.CodeforcesRating;
  const settings = globalThis.CodeforcesFeatureSettings;
  const CACHE_KEY = "codeforcesProblemMetadata";
  const BOX_ID = "cf-problem-rating";
  const CONTEST_HEADER_CLASS = "cf-contest-rating-header";
  const CONTEST_CELL_CLASS = "cf-contest-rating-cell";
  const PROBLEMSET_CELL_CLASS = "cf-problemset-rating-cell";
  const originalProblemsetCells = new Map();

  if (!core || !settings) {
    return;
  }

  const problem = core.parseProblemUrl(window.location.href);
  const contestId = core.parseContestUrl(window.location.href);
  const isProblemset = core.isProblemsetUrl(window.location.href);
  let renderGeneration = 0;
  let featureState = {
    ratingEnabled: null,
    tagsEnabled: null
  };

  if (!problem && contestId === null && !isProblemset) {
    return;
  }

  void settings.read().then(applyFeatureSettings);

  settings.subscribe((changed) => {
    if (typeof changed.ratingEnabled === "boolean") {
      applyFeatureSettings(changed);
    } else if (problem && typeof changed.tagsEnabled === "boolean") {
      applyFeatureSettings(changed);
    }
  });

  function applyFeatureSettings(changed) {
    const nextState = {
      ratingEnabled:
        typeof changed.ratingEnabled === "boolean"
          ? changed.ratingEnabled
          : featureState.ratingEnabled,
      tagsEnabled:
        typeof changed.tagsEnabled === "boolean"
          ? changed.tagsEnabled
          : featureState.tagsEnabled
    };

    if (
      nextState.ratingEnabled === featureState.ratingEnabled &&
      nextState.tagsEnabled === featureState.tagsEnabled
    ) {
      return;
    }

    featureState = nextState;
    renderGeneration += 1;
    const generation = renderGeneration;

    if (contestId !== null || isProblemset) {
      renderTableRatings(generation);
      return;
    }

    document.getElementById(BOX_ID)?.remove();

    if (!featureState.ratingEnabled && !featureState.tagsEnabled) {
      return;
    }

    const sidebar = document.querySelector("#sidebar");
    if (!sidebar) {
      return;
    }

    const view = createMetadataBox(sidebar, featureState);
    void loadProblemMetadata(problem)
      .then((metadata) => {
        if (generation !== renderGeneration || !document.getElementById(BOX_ID)) {
          return;
        }

        view.showMetadata(metadata);
      })
      .catch((error) => {
        if (generation !== renderGeneration || !document.getElementById(BOX_ID)) {
          return;
        }

        console.warn("Codeforces Problem Metadata:", error);
        view.showMessage(
          "Problem metadata unavailable",
          "The Codeforces API could not be reached. Reload the page to try again."
        );
      });
  }

  function renderTableRatings(generation) {
    restoreRatingTable();

    if (!featureState.ratingEnabled) {
      return;
    }

    const rows =
      contestId !== null
        ? createContestRatingColumn()
        : createProblemsetRatingCells();
    if (rows.length === 0) {
      return;
    }

    void loadProblemIndex()
      .then((problems) => {
        if (generation !== renderGeneration) {
          return;
        }

        for (const {
          cell,
          nativeRating,
          problem: rowProblem,
          prefix
        } of rows) {
          if (!cell.parentElement) {
            continue;
          }

          const metadata = core.findProblemMetadata(problems, rowProblem);
          const rating =
            metadata.rating !== null
              ? metadata.rating
              : Number.isInteger(nativeRating)
                ? nativeRating
                : null;
          if (rating === null) {
            showRatingUnavailable(
              cell,
              "No rating has been assigned to this problem."
            );
          } else {
            cell.textContent = `${prefix}${rating}`;
            cell.title = `Problem rating: ${rating}`;
          }
        }
      })
      .catch((error) => {
        if (generation !== renderGeneration) {
          return;
        }

        console.warn("Codeforces Table Ratings:", error);

        if (isProblemset) {
          restoreProblemsetRatingCells();
          return;
        }

        for (const { cell } of rows) {
          if (cell.parentElement) {
            showRatingUnavailable(
              cell,
              "Problem ratings could not be loaded."
            );
          }
        }
      });
  }

  function createContestRatingColumn() {
    const table = document.querySelector("table.problems");
    if (!table) {
      return [];
    }

    const headerRow = table.querySelector("tr");
    if (!headerRow || headerRow.cells.length < 3) {
      return [];
    }

    const header = document.createElement("th");
    header.className = `top ${CONTEST_HEADER_CLASS}`;
    header.textContent = "Rating";
    headerRow.insertBefore(header, headerRow.cells[2]);

    const renderedRows = [];
    const tableRows = Array.from(table.querySelectorAll("tr"));

    for (const row of tableRows.slice(1)) {
      if (row.cells.length < 3) {
        continue;
      }

      const idCell = row.querySelector("td.id");
      const problemLink = idCell?.querySelector("a");
      const rowProblem = problemLink
        ? core.parseProblemUrl(problemLink.href)
        : null;

      if (!rowProblem || rowProblem.contestId !== contestId) {
        continue;
      }

      const nameCellClass = row.cells[1].className;
      const inheritedClasses = ["dark", "bottom"].filter((className) =>
        nameCellClass.split(/\s+/).includes(className)
      );
      const cell = document.createElement("td");
      cell.className = [...inheritedClasses, CONTEST_CELL_CLASS].join(" ");
      cell.textContent = "…";
      cell.title = "Loading problem rating";
      row.insertBefore(cell, row.cells[2]);
      renderedRows.push({ cell, prefix: "*", problem: rowProblem });
    }

    return renderedRows;
  }

  function createProblemsetRatingCells() {
    const table = document.querySelector("table.problems");
    const headerRow = table?.querySelector("tr");
    if (!headerRow) {
      return [];
    }

    const ratingColumnIndex = Array.from(headerRow.cells).findIndex((cell) => {
      const link = cell.querySelector("a");
      return link?.href.includes("order=BY_RATING_");
    });
    if (ratingColumnIndex === -1) {
      return [];
    }

    const renderedRows = [];
    const tableRows = Array.from(table.querySelectorAll("tr"));

    for (const row of tableRows.slice(1)) {
      const cell = row.cells[ratingColumnIndex];
      const idCell = row.querySelector("td.id");
      const problemLink = idCell?.querySelector("a");
      const rowProblem = problemLink
        ? core.parseProblemUrl(problemLink.href)
        : null;

      if (!cell || !rowProblem) {
        continue;
      }

      originalProblemsetCells.set(cell, {
        className: cell.className,
        html: cell.innerHTML,
        title: cell.title
      });
      const nativeRatingText = cell.textContent.trim();
      const nativeRating = /^\d+$/.test(nativeRatingText)
        ? Number(nativeRatingText)
        : null;
      cell.className = `${cell.className} ${PROBLEMSET_CELL_CLASS}`.trim();
      cell.textContent = "…";
      cell.title = "Loading problem rating";
      renderedRows.push({
        cell,
        nativeRating,
        prefix: "",
        problem: rowProblem
      });
    }

    return renderedRows;
  }

  function restoreRatingTable() {
    for (const className of [CONTEST_HEADER_CLASS, CONTEST_CELL_CLASS]) {
      for (const element of document.querySelectorAll(`.${className}`)) {
        element.remove();
      }
    }

    restoreProblemsetRatingCells();
  }

  function restoreProblemsetRatingCells() {
    for (const [cell, original] of originalProblemsetCells) {
      if (cell.parentElement) {
        cell.className = original.className;
        cell.innerHTML = original.html;
        cell.title = original.title;
      }
    }
    originalProblemsetCells.clear();
  }

  function showRatingUnavailable(cell, title) {
    cell.className = `${cell.className} cf-rating-unavailable`;
    cell.textContent = "—";
    cell.title = title;
  }

  async function loadProblemMetadata(targetProblem) {
    const problems = await loadProblemIndex();
    return core.findProblemMetadata(problems, targetProblem);
  }

  async function loadProblemIndex() {
    const cached = await readCache();
    if (core.isFreshCache(cached)) {
      return cached.problems;
    }

    try {
      const response = await fetch(
        new URL("/api/problemset.problems", window.location.origin),
        {
          cache: "no-store",
          credentials: "omit"
        }
      );

      if (!response.ok) {
        throw new Error(`Codeforces API returned HTTP ${response.status}.`);
      }

      const payload = await response.json();
      const problems = core.buildProblemIndex(payload);
      const nextCache = {
        version: core.CACHE_VERSION,
        storedAt: Date.now(),
        problems
      };

      await writeCache(nextCache);
      return problems;
    } catch (error) {
      if (core.isUsableCache(cached)) {
        return cached.problems;
      }

      throw error;
    }
  }

  function readCache() {
    return new Promise((resolve) => {
      const storage = globalThis.chrome?.storage?.local;

      if (!storage) {
        resolve(null);
        return;
      }

      storage.get(CACHE_KEY, (result) => {
        if (globalThis.chrome?.runtime?.lastError) {
          resolve(null);
          return;
        }

        resolve(result?.[CACHE_KEY] ?? null);
      });
    });
  }

  function writeCache(cache) {
    return new Promise((resolve) => {
      const storage = globalThis.chrome?.storage?.local;

      if (!storage) {
        resolve();
        return;
      }

      storage.set({ [CACHE_KEY]: cache }, () => {
        // A storage failure should not prevent displaying fetched metadata.
        void globalThis.chrome?.runtime?.lastError;
        resolve();
      });
    });
  }

  function createMetadataBox(sidebarElement, enabledFeatures) {
    const box = document.createElement("div");
    box.id = BOX_ID;
    box.className = "roundbox sidebox";
    box.append(createCorner("roundbox-lt"), createCorner("roundbox-rt"));

    const caption = document.createElement("div");
    caption.className = "caption titled";
    caption.append(`→ ${getCaption(enabledFeatures)}`);

    const topLinks = document.createElement("div");
    topLinks.className = "top-links";
    caption.append(topLinks);

    const content = document.createElement("div");
    content.className = "cf-metadata-content";

    const status = document.createElement("span");
    status.className = "cf-rating-status";
    status.textContent = "Loading…";
    content.append(status);
    box.append(caption, content);

    const tagsBox = findProblemTagsBox(sidebarElement);
    if (tagsBox) {
      tagsBox.insertAdjacentElement("afterend", box);
    } else {
      sidebarElement.append(box);
    }

    return {
      showMessage(message, title) {
        content.replaceChildren();
        content.append(createMessage(message, title));
      },

      showMetadata(metadata) {
        content.replaceChildren();

        if (enabledFeatures.ratingEnabled) {
          if (metadata.rating === null) {
            content.append(
              createMessage("Not rated", "No rating is available for this problem.")
            );
          } else {
            content.append(createPill(`*${metadata.rating}`, "Problem rating"));
          }
        }

        if (enabledFeatures.tagsEnabled) {
          if (metadata.tags.length === 0) {
            content.append(
              createMessage(
                "No tags available",
                "No tags are available for this problem."
              )
            );
          } else {
            for (const tag of metadata.tags) {
              content.append(createPill(tag, "Problem tag"));
            }
          }
        }
      }
    };
  }

  function getCaption(enabledFeatures) {
    if (enabledFeatures.ratingEnabled && enabledFeatures.tagsEnabled) {
      return "Problem info";
    }
    return enabledFeatures.tagsEnabled ? "Problem tags" : "Problem rating";
  }

  function createPill(text, title) {
    const pill = document.createElement("div");
    pill.className = "roundbox cf-metadata-pill";
    pill.append(
      createCorner("roundbox-lt"),
      createCorner("roundbox-rt"),
      createCorner("roundbox-lb"),
      createCorner("roundbox-rb")
    );

    const value = document.createElement("span");
    value.className = "tag-box";
    value.title = title;
    value.textContent = text;
    pill.append(value);
    return pill;
  }

  function createMessage(message, title) {
    const messageElement = document.createElement("span");
    messageElement.className = "cf-rating-status";
    messageElement.textContent = message;
    messageElement.title = title;
    return messageElement;
  }

  function createCorner(className) {
    const corner = document.createElement("div");
    corner.className = className;
    corner.innerHTML = "&nbsp;";
    return corner;
  }

  function findProblemTagsBox(sidebarElement) {
    return Array.from(sidebarElement.querySelectorAll(".sidebox")).find((box) => {
      const caption = box.querySelector(".caption");
      return caption && /problem tags/i.test(caption.textContent);
    });
  }
})();
