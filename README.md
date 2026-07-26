# Codeforces Rating & Dark Mode

A small Chrome and Firefox extension with two independently configurable
Codeforces features:

- **Problem rating** shows a problem's rating in its own sidebar box without
  revealing the problem tags.
- **Dark mode** applies a low-glare theme across Codeforces, including problem
  statements, tables, forms, dialogs, samples, and code blocks.

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

Click the extension's toolbar button to turn **Problem rating** and **Dark
mode** on or off independently. Changes are saved locally and apply immediately
to open Codeforces tabs.

Problem rating is on by default to preserve the extension's existing behavior;
dark mode is off by default. On a URL such as
`https://codeforces.com/problemset/problem/4/A`, the rating box appears
immediately after Codeforces' **Problem tags** box. If the API does not provide
a rating for that problem, the box says **Not rated**.

Dark-theme selector coverage was informed by the MIT-licensed
[Codeforces Dark Theme](https://github.com/GaurangTandon/codeforces-darktheme)
project.

## Development

No build step or third-party dependencies are required.

```sh
npm test
npm run check
```

The extension targets these Codeforces problem URL formats:

- `/problemset/problem/<contestId>/<index>`
- `/contest/<contestId>/problem/<index>`
