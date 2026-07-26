# Codeforces Problem Rating

A small Chrome and Firefox extension that shows a problem's rating in its own
Codeforces sidebar box, without revealing the problem tags.

It uses the official
[`problemset.problems`](https://codeforces.com/apiHelp/methods#problemset.problems)
API and looks up each problem by its `contestId` and `index`. The rating index is
cached locally for six hours, which avoids repeatedly downloading the complete
problemset and stays comfortably within Codeforces' API rate limit.

## Install in Chrome or Chromium

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository.

## Install temporarily in Firefox

1. Open `about:debugging`.
2. Select **This Firefox**.
3. Click **Load Temporary Add-on**.
4. Select this repository's `manifest.json`.

Firefox removes temporarily loaded extensions when the browser restarts.
Permanent installation requires packaging and signing the extension through
Mozilla Add-ons.

Open a URL such as
`https://codeforces.com/problemset/problem/4/A`. The new **Problem rating** box
will appear immediately after Codeforces' **Problem tags** box. If the API does
not provide a rating for that problem, the box says **Not rated**.

## Development

No build step or third-party dependencies are required.

```sh
npm test
npm run check
```

The extension targets these Codeforces problem URL formats:

- `/problemset/problem/<contestId>/<index>`
- `/contest/<contestId>/problem/<index>`
