// ==========================================
// 1. INITIALIZATION & DATABASE CONFIG
// ==========================================
const SUPABASE_URL = "https://jctdtavzpcxnvpebpyqx.supabase.co";
const SUPABASE_KEY = "sb_publishable_QUrKq5DUY3pwmHv4HEjKCQ_bGFZi4VQ";
const BASE_URL = "https://links-one-rho.vercel.app";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Global state
let links = [];
let sortMode = "newest";     // newest | oldest | most | least | az
let searchTerm = "";

// DOM Elements — dashboard
const urlInput = document.getElementById("url-input");
const aliasInput = document.getElementById("alias-input");
const urlError = document.getElementById("url-error");
const aliasError = document.getElementById("alias-error");
const createBtn = document.getElementById("create-btn");
const createBtnLabel = document.getElementById("create-btn-label");
const previewPlaceholder = document.getElementById("preview-placeholder");
const previewCreated = document.getElementById("preview-created");
const tableBody = document.getElementById("table-body");
const footerCount = document.getElementById("footer-count");
const toast = document.getElementById("toast");
const statActive = document.getElementById("stat-active");
const statClicks = document.getElementById("stat-clicks");
const headerSearchInput = document.getElementById("header-search-input");
const headerSearchGo = document.getElementById("header-search-go");

// Decorative country flags shown (randomly, but consistently per link) on row icons
const FLAG_CODES = ["us", "gb", "de", "fr", "in", "jp", "br", "ca", "au", "nl", "se", "mx", "kr", "it", "es", "sg"];

function flagForCode(code) {
  let hash = 0;
  const str = String(code || "");
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return FLAG_CODES[hash % FLAG_CODES.length];
}

// DOM Elements — view switching
const dashboardView = document.getElementById("dashboard-view");
const allLinksView = document.getElementById("all-links-view");
const viewAllBtn = document.getElementById("view-all-btn");
const backBtn = document.getElementById("back-btn");

// DOM Elements — all links view
const allTableBody = document.getElementById("all-table-body");
const searchInput = document.getElementById("search-input");
const filterPill = document.getElementById("filter-pill");
const sortBtn = document.getElementById("sort-btn");
const sortLabel = document.getElementById("sort-label");
const sortMenu = document.getElementById("sort-menu");

const SORT_LABELS = {
  newest: "Newest First",
  oldest: "Oldest First",
  most: "Most Clicks",
  least: "Least Clicks",
  az: "A → Z"
};

// ==========================================
// 2. LIFECYCLE ROUTING & APP STARTUP
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  loadLinks();
  createBtn.addEventListener("click", handleCreateLink);
  viewAllBtn.addEventListener("click", () => switchView("all"));
  backBtn.addEventListener("click", () => switchView("dashboard"));

  searchInput.addEventListener("input", (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    renderAllLinks();
  });

  const runHeaderSearch = () => {
    const term = headerSearchInput.value.trim();
    searchTerm = term.toLowerCase();
    searchInput.value = term;
    switchView("all");
  };
  headerSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runHeaderSearch();
  });
  headerSearchGo.addEventListener("click", runHeaderSearch);

  sortBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    sortMenu.hidden = !sortMenu.hidden;
    sortBtn.setAttribute("aria-expanded", String(!sortMenu.hidden));
  });

  sortMenu.querySelectorAll("button[data-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      sortMode = btn.dataset.sort;
      sortLabel.textContent = SORT_LABELS[sortMode];
      sortMenu.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      sortMenu.hidden = true;
      sortBtn.setAttribute("aria-expanded", "false");
      renderAllLinks();
    });
  });

  // Close any open dropdown (sort menu or row kebab menus) on outside click
  document.addEventListener("click", () => {
    sortMenu.hidden = true;
    sortBtn.setAttribute("aria-expanded", "false");
    closeAllKebabMenus();
  });
});

function switchView(view) {
  const goingToAll = view === "all";
  allLinksView.hidden = !goingToAll;
  dashboardView.hidden = goingToAll;
  if (goingToAll) {
    renderAllLinks();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }
}

// ==========================================
// 3. URL NORMALIZATION & CODE GENERATION
// ==========================================
function normalizeUrl(raw) {
  let url = raw.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  try {
    return new URL(url).href;
  } catch {
    return null;
  }
}

function randomCode(length = 6) {
  const chars = "abcdefghijkmnpqrstuvwxy23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ==========================================
// 4. CORE ACTION HANDLERS
// ==========================================
async function handleCreateLink() {
  urlError.hidden = true;
  aliasError.hidden = true;

  const originalUrl = normalizeUrl(urlInput.value);
  let alias = aliasInput.value.trim().toLowerCase();

  if (!originalUrl) {
    urlError.hidden = false;
    return;
  }

  createBtn.disabled = true;
  createBtnLabel.textContent = "Checking codes...";

  if (!alias) {
    do {
      alias = randomCode();
    } while (await checkCodeExists(alias));
  } else {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-_]*[a-zA-Z0-9]$/.test(alias) && !/^[a-zA-Z0-9]$/.test(alias)) {
      aliasError.textContent = "Invalid format. Must begin/end with a letter or number.";
      aliasError.hidden = false;
      resetCreateBtn();
      return;
    }

    const standsAlone = await checkCodeExists(alias);
    if (standsAlone) {
      aliasError.textContent = "Conflict: Custom short code already in use.";
      aliasError.hidden = false;
      resetCreateBtn();
      return;
    }
  }

  const payload = {
    original: originalUrl,
    code: alias,
    clicks: 0
  };

  try {
    const newRecord = await saveLink(payload);

    if (newRecord) {
      links.unshift(newRecord);
      renderAll();
      displayReceipt(newRecord);

      urlInput.value = "";
      aliasInput.value = "";
    } else {
      showToast("Database synchronization error.");
    }
  } catch (err) {
    console.error("Link persistence failed:", err);
    showToast("Connection failed.");
  } finally {
    resetCreateBtn();
  }
}

function resetCreateBtn() {
  createBtn.disabled = false;
  createBtnLabel.textContent = "Create Link";
}

// ==========================================
// 5. DATA MUTATIONS & SUPABASE HANDLERS
// ==========================================
async function checkCodeExists(code) {
  const { error, count } = await supabaseClient
    .from("links")
    .select("code", { count: "exact", head: true })
    .eq("code", code.toLowerCase());

  if (error) {
    console.error("Duplicate checking error:", error);
    return true;
  }
  return count > 0;
}

async function loadLinks() {
  const { data, error } = await supabaseClient
    .from("links")
    .select("*")
    .order("created", { ascending: false });

  if (error) {
    console.error("Failed to recover log archive:", error);
    return;
  }

  links = data || [];
  renderAll();
}

async function saveLink(link) {
  const { data, error } = await supabaseClient
    .from("links")
    .insert([link])
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function openLink(code) {
  const link = links.find(l => l.code === code);
  if (!link) return;

  const newClicks = link.clicks + 1;

  try {
    const { error } = await supabaseClient
      .from("links")
      .update({ clicks: newClicks })
      .eq("code", code);

    if (error) throw error;

    link.clicks = newClicks;
    renderAll();

    let destination = link.original.trim();
    if (!/^https?:\/\//i.test(destination)) {
      destination = "https://" + destination;
    }
    window.open(destination, "_blank");
  } catch (err) {
    console.error("Analytics logging failed:", err);
    showToast("Analytics synchronization error.");
  }
}

async function deleteLink(code) {
  if (!confirm("Completely remove this tracking link?")) return;

  const { error } = await supabaseClient
    .from("links")
    .delete()
    .eq("code", code);

  if (error) {
    console.error("Purging action error:", error);
    showToast("Failed to delete tracking link.");
    return;
  }

  links = links.filter(l => l.code !== code);
  renderAll();
  showToast("Tracking link deleted successfully.");
}

function copyLinkToClipboard(code, silent = false) {
  const fullShortUrl = `${BASE_URL}/api/redirect?id=${code}`;
  const finish = (ok) => {
    if (!silent) showToast(ok ? "Tracking link copied to clipboard." : "Copying blocked by browser security settings.");
  };

  navigator.clipboard.writeText(fullShortUrl).then(() => finish(true)).catch(() => {
    const fallbackInput = document.createElement("input");
    fallbackInput.value = fullShortUrl;
    fallbackInput.style.position = "absolute";
    fallbackInput.style.left = "-9999px";
    document.body.appendChild(fallbackInput);
    fallbackInput.select();
    try {
      document.execCommand("copy");
      finish(true);
    } catch (err) {
      console.error("Copy context blocked:", err);
      finish(false);
    }
    document.body.removeChild(fallbackInput);
  });

  return fullShortUrl;
}

// ==========================================
// 6. RENDER ENGINE
// ==========================================
function renderAll() {
  updateStats();
  renderTable();
  if (!allLinksView.hidden) renderAllLinks();
}

function updateStats() {
  const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);
  animateStatValue(statActive, links.length);
  animateStatValue(statClicks, totalClicks);
}

// Smoothly counts a stat pill's displayed number up (or down) to a new target,
// like an odometer, instead of snapping straight to the new value.
function animateStatValue(el, target) {
  const from = parseInt(el.dataset.rawValue || el.textContent.replace(/[^0-9-]/g, ""), 10) || 0;
  if (from === target) {
    el.dataset.rawValue = String(target);
    el.textContent = target.toLocaleString();
    return;
  }

  cancelAnimationFrame(el._statRaf);
  const duration = 650;
  const start = performance.now();

  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
    const value = Math.round(from + (target - from) * eased);
    el.textContent = value.toLocaleString();
    if (progress < 1) {
      el._statRaf = requestAnimationFrame(step);
    } else {
      el.dataset.rawValue = String(target);
      el.textContent = target.toLocaleString();
    }
  };
  el._statRaf = requestAnimationFrame(step);
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  const datePart = d.toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" });
  const timePart = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

function closeAllKebabMenus() {
  document.querySelectorAll(".kebab-menu").forEach(m => m.hidden = true);
}

// Recent (top 5) list on the dashboard
function renderTable() {
  footerCount.textContent = `${links.length} link${links.length === 1 ? '' : 's'} created`;
  buildLinkList(tableBody, links.slice(0, 5));
}

// Full searchable / sortable list
function renderAllLinks() {
  let list = links.slice();

  if (searchTerm) {
    list = list.filter(l =>
      l.code.toLowerCase().includes(searchTerm) ||
      l.original.toLowerCase().includes(searchTerm)
    );
  }

  switch (sortMode) {
    case "oldest":
      list.sort((a, b) => new Date(a.created) - new Date(b.created));
      break;
    case "most":
      list.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
      break;
    case "least":
      list.sort((a, b) => (a.clicks || 0) - (b.clicks || 0));
      break;
    case "az":
      list.sort((a, b) => a.code.localeCompare(b.code));
      break;
    case "newest":
    default:
      list.sort((a, b) => new Date(b.created) - new Date(a.created));
      break;
  }

  filterPill.textContent = `All Links · ${links.length}`;
  buildLinkList(allTableBody, list, { emptyLabel: searchTerm ? "No links match your search." : "No links created yet." });
}

// Shared row builder used by both the dashboard preview list and the full list
function buildLinkList(container, list, opts = {}) {
  container.innerHTML = "";

  if (list.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML = `<span class="icon">&#128230;</span><span>${opts.emptyLabel || "No links created yet. Get started above."}</span>`;
    container.appendChild(emptyState);
    return;
  }

  list.forEach(link => {
    container.appendChild(buildLinkRow(link));
  });
}

function buildLinkRow(link) {
  const row = document.createElement("div");
  row.className = "link-row";

  const clickCount = link.clicks || 0;
  const clicksAlignClass = String(clickCount).length <= 2 ? " clicks-center" : "";
  const flag = flagForCode(link.code);

  row.innerHTML = `
    <div class="row-icon row-icon--flag" style="background-image:url('https://flagcdn.com/w80/${flag}.png')" title="${flag.toUpperCase()}"></div>
    <div class="row-main">
      <div class="row-code">${escapeHtml(link.code)}</div>
      <div class="row-url">${escapeHtml(link.original)}</div>
      <div class="row-meta">
        <span class="badge-active"><i></i>Active</span>
        <span class="row-date">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ${formatDate(link.created)}
        </span>
      </div>
    </div>
    <div class="row-clicks${clicksAlignClass}">
      <span class="clicks-num">${clickCount.toLocaleString()}</span>
      <span class="clicks-label">CLICKS</span>
    </div>
    <div class="row-menu">
      <button class="kebab-btn" aria-label="More actions" title="More actions">&#8942;</button>
      <div class="kebab-menu" hidden>
        <button data-action="copy">Copy Link</button>
        <button data-action="visit">Visit Link</button>
        <button data-action="delete">Delete</button>
      </div>
    </div>
  `;

  const codeEl = row.querySelector(".row-code");
  codeEl.addEventListener("click", () => openLink(link.code));

  const kebabBtn = row.querySelector(".kebab-btn");
  const kebabMenu = row.querySelector(".kebab-menu");
  kebabBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasHidden = kebabMenu.hidden;
    closeAllKebabMenus();
    sortMenu.hidden = true;
    kebabMenu.hidden = !wasHidden;
  });
  kebabMenu.addEventListener("click", (e) => e.stopPropagation());

  kebabMenu.querySelector('[data-action="copy"]').addEventListener("click", () => {
    copyLinkToClipboard(link.code);
    kebabMenu.hidden = true;
  });
  kebabMenu.querySelector('[data-action="visit"]').addEventListener("click", () => {
    openLink(link.code);
    kebabMenu.hidden = true;
  });
  kebabMenu.querySelector('[data-action="delete"]').addEventListener("click", () => {
    kebabMenu.hidden = true;
    deleteLink(link.code);
  });

  return row;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

// ==========================================
// 7. RECEIPT / PREVIEW PANEL
// ==========================================
function displayReceipt(link) {
  const fullShortUrl = `${BASE_URL}/api/redirect?id=${link.code}`;

  document.getElementById("gen-short").textContent = fullShortUrl;
  document.getElementById("gen-orig").textContent = link.original;
  document.getElementById("gen-code").textContent = link.code;
  document.getElementById("gen-time").textContent = formatDate(link.created || new Date().toISOString());

  document.getElementById("copy-inline-btn").onclick = () => copyLinkToClipboard(link.code);
  document.getElementById("copy-btn").onclick = () => copyLinkToClipboard(link.code);
  document.getElementById("open-btn").onclick = () => openLink(link.code);

  previewPlaceholder.hidden = true;
  previewCreated.hidden = false;
}

// ==========================================
// 8. GLOBAL NOTIFICATION TOAST
// ==========================================
function showToast(message) {
  clearTimeout(showToast.timer);
  toast.textContent = message;
  toast.classList.add("show");

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}
