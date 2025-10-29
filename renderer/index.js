const tabsDiv = document.getElementById("tabs");
const tabStrip = document.getElementById("tab-strip");
const addTabBtn = document.getElementById("add-tab");
const bookmarkBtn = document.getElementById("bookmark");
const urlInput = document.getElementById("url");
const backBtn = document.getElementById("back");
const forwardBtn = document.getElementById("forward");
const reloadBtn = document.getElementById("reload");

let current = -1;
let prevTabIndices = new Set();

tabsDiv.style.marginTop = "0px";

(() => {
  const isMac = navigator.userAgent.includes("Mac OS X");
  if (isMac && tabStrip && !document.getElementById("traffic-light-spacer")) {
    const spacer = document.createElement("div");
    spacer.id = "traffic-light-spacer";
    spacer.style.width = "60px";
    spacer.style.height = "100%";
    spacer.style.pointerEvents = "none";
    spacer.style.webkitAppRegion = "drag";
    tabStrip.insertBefore(spacer, tabStrip.firstChild);
  }
})();

function computeTabWidth() {
  const containerWidth = tabsDiv.clientWidth || 0;
  const addButtonWidth = 34;
  const gap = 6;
  const maxWidth = 140;
  const minWidth = 80;
  const count = Math.max(1, tabsDiv.childElementCount || 1);
  const totalGaps = Math.max(0, count - 1) * gap;
  const available = Math.max(0, containerWidth - addButtonWidth - totalGaps);
  const ideal = Math.floor(available / count);
  return Math.max(minWidth, Math.min(maxWidth, ideal || maxWidth));
}

function renderTabs(state, newlyAddedIndices) {
  tabsDiv.innerHTML = "";
  const tabWidth = computeTabWidth();
  state.tabs.forEach((t) => {
    const btn = document.createElement("button");
    btn.style.display = "flex";
    btn.style.alignItems = "center";
    btn.style.gap = "6px";
    btn.style.padding = "2px 8px";
    btn.style.marginTop = "4px";
    btn.style.fontSize = "12px";
    btn.style.borderRadius = "10px";
    btn.style.border = "1px solid rgb(23, 32, 49)";
    btn.style.background = t.isActive ? "rgb(28, 42, 59)" : "rgb(23, 32, 49)";
    btn.style.color = "#e5e7eb";
    btn.style.cursor = "pointer";
    btn.style.transition = "transform 200ms ease, opacity 200ms ease";
    btn.style.width = tabWidth + "px";
    btn.style.minWidth = tabWidth + "px";
    btn.style.maxWidth = tabWidth + "px";
    btn.onclick = () => window.api.switchTab(t.index);

    const label = document.createElement("span");
    label.textContent = t.title || "New Tab";
    label.style.flex = "1";
    label.style.overflow = "hidden";
    label.style.whiteSpace = "nowrap";
    label.style.textOverflow = "ellipsis";
    btn.appendChild(label);

    const close = document.createElement("span");
    close.textContent = "✕";
    close.style.opacity = "0.85";
    close.style.cursor = "pointer";
    close.onclick = (e) => {
      e.stopPropagation();
      window.api.closeTab(t.index);
    };
    btn.appendChild(close);

    if (t.isActive) {
      btn.style.marginBottom = "-2px";
      btn.style.borderBottomLeftRadius = "0";
      btn.style.borderBottomRightRadius = "0";
      btn.style.paddingBottom = "6px";
      btn.style.borderBottomColor = "rgb(28, 42, 59)";
      label.style.marginTop = "4px";
    }

    tabsDiv.appendChild(btn);
    makeDraggable(btn, t.index);

    if (newlyAddedIndices && newlyAddedIndices.has(t.index)) {
      btn.style.transform = "translateX(-24px)";
      btn.style.opacity = "0";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          btn.style.transform = "translateX(0)";
          btn.style.opacity = "1";
        });
      });
    }
  });
}

window.api.onTabsUpdate((payload) => {
  current = payload.current;
  const currentIndices = new Set(payload.tabs.map((t) => t.index));
  const newlyAdded = new Set();
  payload.tabs.forEach((t) => {
    if (!prevTabIndices.has(t.index)) newlyAdded.add(t.index);
  });
  renderTabs(payload, newlyAdded.size ? newlyAdded : null);
  prevTabIndices = currentIndices;
});

window.addEventListener("resize", () => {
  const width = computeTabWidth();
  Array.from(tabsDiv.children).forEach((btn) => {
    btn.style.width = width + "px";
    btn.style.minWidth = width + "px";
    btn.style.maxWidth = width + "px";
  });
});

let dragIndex = null;
function makeDraggable(btn, index) {
  btn.draggable = true;
  btn.addEventListener("dragstart", (e) => {
    dragIndex = index;
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", String(index));
    } catch (_) {}
    btn.classList.add("dragging");
  });
  btn.addEventListener("dragend", () => {
    dragIndex = null;
    btn.classList.remove("dragging");
  });
  btn.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  });
  btn.addEventListener("drop", (e) => {
    e.preventDefault();
    const from = dragIndex;
    const to = index;
    if (from === null || from === undefined) return;
    if (from === to) return;
    window.api.reorderTabs(from, to);
  });
}

let currentUrl = "";
let bookmarksList = [];

function isBookmarked(url) {
  return bookmarksList.some((b) => b.url === url);
}

function updateBookmarkButton() {
  const bookmarked = currentUrl && isBookmarked(currentUrl);
  bookmarkBtn.style.color = bookmarked ? "#facc15" : "#e5e7eb";
}

window.api.onBookmarksUpdate((list) => {
  bookmarksList = Array.isArray(list) ? list : [];
  updateBookmarkButton();
});

window.api.onNavUpdate(({ url, canGoBack, canGoForward }) => {
  if (document.activeElement !== urlInput) {
    urlInput.value = url || "";
  }
  currentUrl = url || "";
  updateBookmarkButton();
  backBtn.disabled = !canGoBack;
  forwardBtn.disabled = !canGoForward;
});

addTabBtn.onclick = () => window.api.newTab(undefined, { activate: true });

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const query = urlInput.value.trim();
    if (query) window.api.loadURL(query);
  }
});

backBtn.onclick = () => window.api.navigate("back");
forwardBtn.onclick = () => window.api.navigate("forward");
reloadBtn.onclick = () => window.api.navigate("reload");

bookmarkBtn.onclick = async () => {
  const url = (currentUrl || "").trim();
  if (!url) return;
  if (isBookmarked(url)) {
    await window.api.removeBookmark(url);
  } else {
    await window.api.addBookmark();
  }
};
