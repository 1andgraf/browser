# FL Browser (Electron)

A minimal, fast, Chrome‑like browser UI built with Electron. It features a dark theme, a compact tab strip with drag‑to‑reorder, an omnibox, a custom New Tab page, and a simple bookmark system.

## Features

- Tabs powered by Electron BrowserView (single window manages multiple tabs)
- Chrome‑like UI
  - Dark grey‑blue theme
  - Compact tab strip with active tab merge effect
  - Draggable tabs with smooth reordering animation
  - Responsive tab widths (auto‑shrink to keep + button visible)
- Navigation controls: Back / Forward / Reload and an omnibox
- New Tab page
  - Centered “FL BROWSER” title
  - Search bar (URL or Google search)
  - Bookmarks grid under the search bar
- Bookmarks
  - Star button in the toolbar toggles bookmark for the current page
  - Bookmarks persist to disk and sync live to the New Tab page
  - Remove bookmark via ✕ on the New Tab page
- Middle‑click or Cmd/Ctrl‑click on links opens in a background tab
- target=\_blank / window.open are routed to new tabs (not new windows)

## Getting Started

### Prerequisites

- Node.js 18+ (recommended)

### Install

```bash
npm install
```

### Run

```bash
npm start
```

This starts Electron and opens the main window.

## Project Structure

```
browser/
  main.js                 # Main process: BrowserWindow, BrowserViews, tabs, IPC, bookmarks
  preload.js              # Preload for the chrome/renderer UI (omnibox, tabs bar)
  viewPreload.js          # Preload for BrowserView pages (e.g., middle-click; bookmarks feed to New Tab)
  renderer/
    index.html            # Chrome UI (tab strip, toolbar/omnibox)
    index.js              # Renderer logic: tabs UI, drag-reorder, omnibox, star toggle
  assets/
    newtab.html           # Custom New Tab page with search + bookmarks grid
  package.json
```

## How It Works

- A single `BrowserWindow` hosts a chrome UI (tab strip + toolbar) and manages multiple `BrowserView` tabs.
- The main process (`main.js`) owns the tab list, attaches/detaches the active `BrowserView`, and handles:
  - Navigation (load/back/forward/reload)
  - New/switch/close tab
  - Window‑open routing to tabs
  - Bookmarks: load/save, add/remove, and pushing updates to renderers
- The chrome UI (`renderer/index.html` + `renderer/index.js`) communicates with the main process via IPC exposed by `preload.js`.
- The New Tab page (`assets/newtab.html`) runs inside a `BrowserView` and receives bookmark updates via `viewPreload.js`.

## Bookmarks

- Star button (to the right of the omnibox) toggles bookmark for the current page:
  - Gray star = not bookmarked, Yellow star = bookmarked
  - Click to add/remove; updates persist to `bookmarks.json` under Electron’s `userData` folder
- New Tab page shows bookmarks in a fixed‑size grid; click to open, ✕ to remove

## Shortcuts & Tips

- Middle‑click a link to open in a background tab
- Cmd/Ctrl‑click a link to open in a background tab

## Development Notes

- Electron version is declared in `package.json` devDependencies
- IPC channels (selected):
  - Tabs: `tabs:new`, `tabs:switch`, `tabs:close`, `tabs:reorder`
  - Nav: `nav:load`, `nav:cmd`, renderer receives `nav:update`
  - Bookmarks: `bookmarks:list`, `bookmarks:add`, `bookmarks:remove`, renderers receive `bookmarks:update`
- Preloads expose safe surface areas:
  - `window.api` (chrome UI)
  - `window.apiView` (BrowserView content like New Tab)

## Packaging

This repo currently focuses on development (`npm start`). To create distributables, integrate a packager such as:

- electron-builder
- electron-packager

Example (electron-packager):

```bash
npm install -D electron-packager
npx electron-packager . FLBrowser --overwrite
```

## License

ISC (see `package.json`).
