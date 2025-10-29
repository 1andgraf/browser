const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  newTab: (url, options) => ipcRenderer.invoke("tabs:new", url, options),
  switchTab: (index) => ipcRenderer.invoke("tabs:switch", index),
  closeTab: (index) => ipcRenderer.invoke("tabs:close", index),
  reorderTabs: (fromIndex, toIndex) =>
    ipcRenderer.invoke("tabs:reorder", fromIndex, toIndex),
  onTabsUpdate: (callback) =>
    ipcRenderer.on("tabs:update", (_e, payload) => callback(payload)),

  loadURL: (url) => ipcRenderer.invoke("nav:load", url),
  navigate: (direction) => ipcRenderer.invoke("nav:cmd", direction),
  onNavUpdate: (callback) =>
    ipcRenderer.on("nav:update", (_e, payload) => callback(payload)),

  addBookmark: () => ipcRenderer.invoke("bookmarks:add"),
  removeBookmark: (url) => ipcRenderer.invoke("bookmarks:remove", url),
  onBookmarksUpdate: (callback) =>
    ipcRenderer.on("bookmarks:update", (_e, list) => callback(list)),
  listBookmarks: () => ipcRenderer.invoke("bookmarks:list"),
});
