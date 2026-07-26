(function showCodeforcesProblemMetadata() {
  "use strict";

  const core = globalThis.CodeforcesRating;
  const settings = globalThis.CodeforcesFeatureSettings;
  const CACHE_KEY = "codeforcesProblemMetadata";
  const BOX_ID = "cf-problem-rating";

  if (!core || !settings) {
    return;
  }

  const problem = core.parseProblemUrl(window.location.href);
  let renderGeneration = 0;
  let featureState = {
    ratingEnabled: null,
    tagsEnabled: null
  };

  if (!problem) {
    return;
  }

  void settings.read().then(applyFeatureSettings);

  settings.subscribe((changed) => {
    if (
      typeof changed.ratingEnabled === "boolean" ||
      typeof changed.tagsEnabled === "boolean"
    ) {
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

  async function loadProblemMetadata(targetProblem) {
    const cached = await readCache();

    if (core.isFreshCache(cached)) {
      return core.findProblemMetadata(cached.problems, targetProblem);
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
      return core.findProblemMetadata(problems, targetProblem);
    } catch (error) {
      if (core.isUsableCache(cached)) {
        return core.findProblemMetadata(cached.problems, targetProblem);
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
