const { app, BrowserWindow, BrowserView, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;
let tabs = [];
let currentTabIndex = -1;
let bookmarks = [];

function getBookmarksPath() {
  return path.join(app.getPath("userData"), "bookmarks.json");
}

function loadBookmarks() {
  try {
    const p = getBookmarksPath();
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf-8");
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) bookmarks = arr;
    }
  } catch (_) {}
}

function persistBookmarks() {
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(getBookmarksPath(), JSON.stringify(bookmarks, null, 2));
  } catch (_) {}
}

function broadcastBookmarksUpdate() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("bookmarks:update", bookmarks);
  }
  tabs.forEach((t) => {
    if (t && t.view && t.view.webContents) {
      try {
        t.view.webContents.send("bookmarks:update", bookmarks);
      } catch (_) {}
    }
  });
}

function getChromeBounds() {
  const tabStripHeight = 26;
  const toolbarHeight = 34;
  const contentTopPadding = 12;
  const offsetTop = tabStripHeight + toolbarHeight + contentTopPadding;
  const [width, height] = mainWindow.getContentSize();
  return { x: 0, y: offsetTop, width, height: Math.max(0, height - offsetTop) };
}

function sendTabsUpdate() {
  const meta = tabs.map((t, i) => ({
    index: i,
    title: t.title || (t.isNewTab ? "New Tab" : ""),
    url: t.url || "",
    isActive: i === currentTabIndex,
  }));
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("tabs:update", {
      tabs: meta,
      current: currentTabIndex,
    });
  }
}

function sendNavUpdate() {
  const active = tabs[currentTabIndex];
  if (!active) return;
  const wc = active.view.webContents;
  const currentUrl = wc.getURL() || "";
  const displayUrl =
    active.isNewTab && currentUrl.startsWith("file://") ? "" : currentUrl;
  const payload = {
    url: displayUrl,
    canGoBack: wc.canGoBack(),
    canGoForward: wc.canGoForward(),
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("nav:update", payload);
  }
}

function attachView(view) {
  if (!mainWindow) return;
  mainWindow.setBrowserView(view);
  const b = getChromeBounds();
  view.setBounds(b);
  view.setAutoResize({ width: true, height: true });
}

function detachView(view) {
  if (!mainWindow) return;
  const existing = mainWindow.getBrowserView();
  if (existing === view) {
    try {
      if (typeof mainWindow.removeBrowserView === "function") {
        mainWindow.removeBrowserView(view);
      } else {
        mainWindow.setBrowserView(null);
      }
    } catch (_) {}
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 8, y: 10 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow.loadFile("renderer/index.html");

  mainWindow.on("resize", () => {
    const active = tabs[currentTabIndex];
    if (active) {
      const b = getChromeBounds();
      active.view.setBounds(b);
    }
  });

  return mainWindow;
}

function wireWebContentsEvents(tab) {
  const wc = tab.view.webContents;
  wc.on("page-title-updated", (_e, title) => {
    tab.title = title;
    sendTabsUpdate();
  });
  const updateUrl = () => {
    const url = wc.getURL();
    tab.url = url;
    tab.isNewTab = url.startsWith("file://");
    sendNavUpdate();
  };
  wc.on("did-start-navigation", updateUrl);
  wc.on("did-navigate", updateUrl);
  wc.on("did-navigate-in-page", updateUrl);
  wc.on("did-finish-load", () => {
    const url = wc.getURL();
    tab.url = url;
    tab.isNewTab = url.startsWith("file://");
    sendTabsUpdate();
    sendNavUpdate();
  });

  wc.setWindowOpenHandler(({ url, disposition }) => {
    const activate = disposition !== "background-tab";
    addTab(url, { activate });
    return { action: "deny" };
  });
}

function addTab(url, options = {}) {
  const { activate = true } = options;
  const view = new BrowserView({
    webPreferences: {
      sandbox: false,
      preload: path.join(__dirname, "viewPreload.js"),
    },
  });
  const tab = { view, title: "New Tab", url: "", isNewTab: false };
  tabs.push(tab);
  wireWebContentsEvents(tab);

  if (!url) {
    tab.isNewTab = true;
    view.webContents.loadFile(path.join(__dirname, "assets", "newtab.html"));
  } else {
    if (!/^https?:\/\//i.test(url)) {
      url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }
    view.webContents.loadURL(url);
  }

  if (activate) {
    switchTab(tabs.length - 1);
  } else {
    // keep current tab active, just reflect tabs list change
    sendTabsUpdate();
  }
}

function switchTab(index) {
  index = parseInt(index);
  if (!tabs[index]) return;
  const current = tabs[currentTabIndex];
  if (current) detachView(current.view);
  currentTabIndex = index;
  attachView(tabs[currentTabIndex].view);
  sendTabsUpdate();
  sendNavUpdate();
}

function closeTab(index) {
  index = parseInt(index);
  const tab = tabs[index];
  if (!tab) return;
  detachView(tab.view);
  try {
    if (typeof tab.view.destroy === "function") {
      tab.view.destroy();
    }
  } catch (_) {}
  tabs.splice(index, 1);

  if (tabs.length === 0) {
    currentTabIndex = -1;
    sendTabsUpdate();
    return;
  }
  const nextIndex = Math.min(index, tabs.length - 1);
  switchTab(nextIndex);
}

function loadURL(url) {
  const tab = tabs[currentTabIndex];
  if (!tab) return;
  if (!/^https?:\/\//i.test(url)) {
    const looksLikeHost = /\./.test(url) || url.startsWith("localhost");
    url = looksLikeHost
      ? `https://${url}`
      : `https://www.google.com/search?q=${encodeURIComponent(url)}`;
  }
  tab.isNewTab = false;
  tab.view.webContents.loadURL(url);
}

function navigate(direction) {
  const tab = tabs[currentTabIndex];
  if (!tab) return;
  const wc = tab.view.webContents;
  if (direction === "back" && wc.canGoBack()) wc.goBack();
  if (direction === "forward" && wc.canGoForward()) wc.goForward();
  if (direction === "reload") wc.reload();
}

app.whenReady().then(() => {
  loadBookmarks();
  createMainWindow();

  ipcMain.handle("tabs:new", (_e, url, options) => {
    addTab(url, options || {});
  });
  ipcMain.handle("tabs:switch", (_e, index) => {
    switchTab(index);
  });
  ipcMain.handle("tabs:close", (_e, index) => {
    closeTab(index);
  });
  ipcMain.handle("tabs:reorder", (_e, fromIndex, toIndex) => {
    fromIndex = parseInt(fromIndex);
    toIndex = parseInt(toIndex);
    if (
      Number.isNaN(fromIndex) ||
      Number.isNaN(toIndex) ||
      fromIndex === toIndex ||
      !tabs[fromIndex] ||
      toIndex < 0 ||
      toIndex >= tabs.length
    )
      return;
    const [moved] = tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, moved);
    if (currentTabIndex === fromIndex) {
      currentTabIndex = toIndex;
    } else if (currentTabIndex > fromIndex && currentTabIndex <= toIndex) {
      currentTabIndex -= 1;
    } else if (currentTabIndex < fromIndex && currentTabIndex >= toIndex) {
      currentTabIndex += 1;
    }
    sendTabsUpdate();
  });

  ipcMain.handle("nav:load", (_e, url) => {
    loadURL(url);
  });
  ipcMain.handle("nav:cmd", (_e, direction) => {
    navigate(direction);
  });

  ipcMain.handle("bookmarks:list", () => bookmarks);
  ipcMain.handle("bookmarks:add", () => {
    const tab = tabs[currentTabIndex];
    if (!tab) return bookmarks;
    const url = tab.url || "";
    const title = tab.title || url;
    if (!/^https?:\/\//i.test(url)) return bookmarks;
    if (!bookmarks.find((b) => b.url === url)) {
      bookmarks.push({ url, title });
      persistBookmarks();
      broadcastBookmarksUpdate();
    }
    return bookmarks;
  });
  ipcMain.handle("bookmarks:remove", (_e, url) => {
    if (!url) return bookmarks;
    const next = bookmarks.filter((b) => b.url !== url);
    if (next.length !== bookmarks.length) {
      bookmarks = next;
      persistBookmarks();
      broadcastBookmarksUpdate();
    }
    return bookmarks;
  });

  addTab(null);
  broadcastBookmarksUpdate();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
