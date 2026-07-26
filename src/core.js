(function initializeCodeforcesRating(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.CodeforcesRating = api;
  }
})(typeof globalThis === "undefined" ? this : globalThis, function createApi() {
  "use strict";

  const CACHE_VERSION = 1;
  const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

  function parseProblemUrl(input) {
    let url;

    try {
      url = new URL(input);
    } catch {
      return null;
    }

    const patterns = [
      /^\/problemset\/problem\/(\d+)\/([^/]+)\/?$/,
      /^\/contest\/(\d+)\/problem\/([^/]+)\/?$/
    ];

    for (const pattern of patterns) {
      const match = url.pathname.match(pattern);

      if (match) {
        return {
          contestId: Number(match[1]),
          index: decodeURIComponent(match[2]).toUpperCase()
        };
      }
    }

    return null;
  }

  function problemKey(contestId, index) {
    return `${contestId}:${String(index).toUpperCase()}`;
  }

  function buildRatingIndex(payload) {
    if (
      !payload ||
      payload.status !== "OK" ||
      !payload.result ||
      !Array.isArray(payload.result.problems)
    ) {
      const message =
        payload && typeof payload.comment === "string"
          ? payload.comment
          : "Unexpected response from the Codeforces API.";
      throw new Error(message);
    }

    const ratings = Object.create(null);

    for (const problem of payload.result.problems) {
      if (
        Number.isInteger(problem.contestId) &&
        typeof problem.index === "string" &&
        Number.isInteger(problem.rating)
      ) {
        ratings[problemKey(problem.contestId, problem.index)] = problem.rating;
      }
    }

    return ratings;
  }

  function findRating(ratings, problem) {
    if (!ratings || !problem) {
      return null;
    }

    const rating = ratings[problemKey(problem.contestId, problem.index)];
    return Number.isInteger(rating) ? rating : null;
  }

  function isUsableCache(cache) {
    return Boolean(
      cache &&
        cache.version === CACHE_VERSION &&
        Number.isFinite(cache.storedAt) &&
        cache.ratings &&
        typeof cache.ratings === "object"
    );
  }

  function isFreshCache(cache, now = Date.now()) {
    return (
      isUsableCache(cache) &&
      now >= cache.storedAt &&
      now - cache.storedAt < CACHE_TTL_MS
    );
  }

  return Object.freeze({
    CACHE_TTL_MS,
    CACHE_VERSION,
    buildRatingIndex,
    findRating,
    isFreshCache,
    isUsableCache,
    parseProblemUrl,
    problemKey
  });
});
