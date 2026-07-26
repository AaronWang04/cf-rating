"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/core.js");

test("parses problemset problem URLs", () => {
  assert.deepEqual(
    core.parseProblemUrl("https://codeforces.com/problemset/problem/1900/c?locale=en"),
    { contestId: 1900, index: "C" }
  );
});

test("parses contest problem URLs without relying on string offsets", () => {
  assert.deepEqual(
    core.parseProblemUrl("https://codeforces.com/contest/4/problem/A#sample-tests"),
    { contestId: 4, index: "A" }
  );
  assert.deepEqual(
    core.parseProblemUrl("https://codeforces.com/contest/123/problem/A1/"),
    { contestId: 123, index: "A1" }
  );
});

test("rejects unrelated and malformed URLs", () => {
  assert.equal(core.parseProblemUrl("https://codeforces.com/problemset"), null);
  assert.equal(core.parseProblemUrl("not a URL"), null);
});

test("indexes ratings by contest id and problem index", () => {
  const ratings = core.buildRatingIndex({
    status: "OK",
    result: {
      problems: [
        { contestId: 4, index: "A", rating: 800, tags: ["math"] },
        { contestId: 4, index: "B", tags: ["implementation"] },
        { contestId: 1900, index: "c", rating: 1700 }
      ],
      problemStatistics: []
    }
  });

  assert.equal(core.findRating(ratings, { contestId: 4, index: "A" }), 800);
  assert.equal(core.findRating(ratings, { contestId: 1900, index: "C" }), 1700);
  assert.equal(core.findRating(ratings, { contestId: 4, index: "B" }), null);
});

test("indexes rating and tags together as problem metadata", () => {
  const problems = core.buildProblemIndex({
    status: "OK",
    result: {
      problems: [
        {
          contestId: 4,
          index: "A",
          rating: 800,
          tags: ["brute force", "math"]
        },
        { contestId: 4, index: "B", tags: ["implementation"] }
      ]
    }
  });

  assert.deepEqual(
    core.findProblemMetadata(problems, { contestId: 4, index: "A" }),
    {
      rating: 800,
      tags: ["brute force", "math"]
    }
  );
  assert.deepEqual(
    core.findProblemMetadata(problems, { contestId: 4, index: "B" }),
    {
      rating: null,
      tags: ["implementation"]
    }
  );
});

test("rejects failed or malformed API responses", () => {
  assert.throws(
    () => core.buildRatingIndex({ status: "FAILED", comment: "Call limit exceeded" }),
    /Call limit exceeded/
  );
  assert.throws(
    () => core.buildRatingIndex({ status: "OK", result: {} }),
    /Unexpected response/
  );
});

test("validates cache version and expiration", () => {
  const now = 1_000_000_000;
  const fresh = {
    version: core.CACHE_VERSION,
    storedAt: now - core.CACHE_TTL_MS + 1,
    problems: {
      "4:A": {
        rating: 800,
        tags: ["math"]
      }
    }
  };

  assert.equal(core.isUsableCache(fresh), true);
  assert.equal(core.isFreshCache(fresh, now), true);
  assert.equal(
    core.isFreshCache({ ...fresh, storedAt: now - core.CACHE_TTL_MS }, now),
    false
  );
  assert.equal(core.isFreshCache({ ...fresh, version: 999 }, now), false);
});
