const { ipcRenderer, contextBridge } = require("electron");

window.addEventListener(
  "click",
  (e) => {
    if (e.button !== 1) return;
    let el = e.target;
    while (el && el.tagName && el.tagName.toLowerCase() !== "a") {
      el = el.parentElement;
    }
    if (!el || !el.href) return;
    e.preventDefault();
    e.stopPropagation();
    ipcRenderer.invoke("tabs:new", el.href, { activate: false });
  },
  true
);

window.addEventListener(
  "click",
  (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    let el = e.target;
    while (el && el.tagName && el.tagName.toLowerCase() !== "a") {
      el = el.parentElement;
    }
    if (!el || !el.href) return;
    e.preventDefault();
    e.stopPropagation();
    ipcRenderer.invoke("tabs:new", el.href, { activate: false });
  },
  true
);
contextBridge.exposeInMainWorld("apiView", {
  listBookmarks: () => ipcRenderer.invoke("bookmarks:list"),
  onBookmarksUpdate: (cb) =>
    ipcRenderer.on("bookmarks:update", (_e, list) => cb(list)),
  removeBookmark: (url) => ipcRenderer.invoke("bookmarks:remove", url),
});
