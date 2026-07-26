(function showCodeforcesProblemRating() {
  "use strict";

  const core = globalThis.CodeforcesRating;
  const CACHE_KEY = "codeforcesProblemRatings";
  const BOX_ID = "cf-problem-rating";

  if (!core) {
    return;
  }

  const problem = core.parseProblemUrl(window.location.href);
  const sidebar = document.querySelector("#sidebar");

  if (!problem || !sidebar || document.getElementById(BOX_ID)) {
    return;
  }

  const view = createRatingBox(sidebar);
  void loadRating(problem)
    .then((rating) => {
      if (rating === null) {
        view.showMessage("Not rated", "No rating is available for this problem.");
      } else {
        view.showRating(rating);
      }
    })
    .catch((error) => {
      console.warn("Codeforces Problem Rating:", error);
      view.showMessage(
        "Rating unavailable",
        "The Codeforces API could not be reached. Reload the page to try again."
      );
    });

  async function loadRating(targetProblem) {
    const cached = await readCache();

    if (core.isFreshCache(cached)) {
      return core.findRating(cached.ratings, targetProblem);
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
      const ratings = core.buildRatingIndex(payload);
      const nextCache = {
        version: core.CACHE_VERSION,
        storedAt: Date.now(),
        ratings
      };

      await writeCache(nextCache);
      return core.findRating(ratings, targetProblem);
    } catch (error) {
      if (core.isUsableCache(cached)) {
        return core.findRating(cached.ratings, targetProblem);
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
        // A storage failure should not prevent displaying the rating we fetched.
        void globalThis.chrome?.runtime?.lastError;
        resolve();
      });
    });
  }

  function createRatingBox(sidebarElement) {
    const box = document.createElement("div");
    box.id = BOX_ID;
    box.className = "roundbox sidebox";
    box.append(createCorner("roundbox-lt"), createCorner("roundbox-rt"));

    const caption = document.createElement("div");
    caption.className = "caption titled";
    caption.append("→ Problem rating");

    const topLinks = document.createElement("div");
    topLinks.className = "top-links";
    caption.append(topLinks);

    const content = document.createElement("div");
    content.className = "cf-rating-content";

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
        const messageElement = document.createElement("span");
        messageElement.className = "cf-rating-status";
        messageElement.textContent = message;
        messageElement.title = title;
        content.append(messageElement);
      },

      showRating(rating) {
        content.replaceChildren();

        const pill = document.createElement("div");
        pill.className = "roundbox cf-rating-pill";
        pill.append(
          createCorner("roundbox-lt"),
          createCorner("roundbox-rt"),
          createCorner("roundbox-lb"),
          createCorner("roundbox-rb")
        );

        const value = document.createElement("span");
        value.className = "tag-box";
        value.title = "Problem rating";
        value.textContent = `*${rating}`;
        pill.append(value);
        content.append(pill);
      }
    };
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
