// ==========================================
// 1. INITIALIZATION & DATABASE CONFIG
// ==========================================
const SUPABASE_URL = "https://jctdtavzpcxnvpebpyqx.supabase.co";
const SUPABASE_KEY = "sb_publishable_QUrKq5DUY3pwmHv4HEjKCQ_bGFZi4VQ";
const BASE_URL = "https://links-one-rho.vercel.app";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Delays calling `fn` until `wait` ms have passed since the last call —
// used to stop rapid-fire input events (e.g. typing in a search box) from
// each triggering a full listing rebuild.
function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

// Global state
let links = [];
let clicksLog = [];          // flat list of every visitor click, newest first
let sortMode = "newest";     // newest | oldest | most | least | az
let searchTerm = "";
let userSortMode = "newest"; // newest | oldest | country
let userSearchTerm = "";
const expandedRows = new Set(); // link codes currently expanded on-page

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
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const brandSubtitle = document.getElementById("brand-subtitle");

// DOM Elements — campaign setup
const campaignInput = document.getElementById("campaign-input");
const campaignError = document.getElementById("campaign-error");
const campaignSetupArrow = document.getElementById("campaign-setup-arrow");
const campaignSetupPanel = document.getElementById("campaign-setup-panel");
const campaignPreviewIcons = document.getElementById("campaign-preview-icons");
const campaignTagsDisplay = document.getElementById("campaign-tags-display");
const platformGrid = document.getElementById("platform-grid");
const tagInput = document.getElementById("tag-input");
const tagSuggestions = document.getElementById("tag-suggestions");
const tagChipList = document.getElementById("tag-chip-list");
const campaignCancelBtn = document.getElementById("campaign-cancel-btn");
const campaignConfirmBtn = document.getElementById("campaign-confirm-btn");
const createPanel = document.querySelector(".create-panel");

// Fixed platform catalog (mirrors `social_platforms` seed rows — matched by slug)
const SOCIAL_PLATFORMS = [
  { slug: "facebook",  name: "Facebook",     color: "#3b82f6", initials: "Fb" },
  { slug: "instagram", name: "Instagram",    color: "#ec4899", initials: "Ig" },
  { slug: "twitter",   name: "X / Twitter",  color: "#38bdf8", initials: "X" },
  { slug: "linkedin",  name: "LinkedIn",     color: "#0ea5e9", initials: "In" },
  { slug: "youtube",   name: "YouTube",      color: "#f87171", initials: "Yt" },
  { slug: "whatsapp",  name: "WhatsApp",     color: "#34d399", initials: "Wa" },
  { slug: "telegram",  name: "Telegram",     color: "#5eead4", initials: "Tg" },
  { slug: "snapchat",  name: "Snapchat",     color: "#fbbf24", initials: "Sc" }
];
const PLATFORM_BY_SLUG = Object.fromEntries(SOCIAL_PLATFORMS.map(p => [p.slug, p]));
let PLATFORM_ID_BY_SLUG = {}; // filled once social_platforms table is loaded

const DEFAULT_TAG_SUGGESTIONS = ["Sale", "New", "Black Friday", "Offer", "Festival", "Promotion"];
let knownTagNames = DEFAULT_TAG_SUGGESTIONS.slice(); // grows with tags loaded from DB

let campaignSetupOpen = false;
let tempPlatforms = [];   // slugs being edited live inside the setup panel
let tempTags = [];        // tag names being edited live inside the setup panel
let committedPlatforms = []; // slugs applied to the link currently being created
let committedTags = [];      // tag names applied to the link currently being created

let linkPlatformsByCode = {}; // code -> [{slug?, name}]
let linkTagsByCode = {};      // code -> [tagName, ...]

// Decorative country flags shown (randomly, but consistently per link) on row icons
// when no real visitor geo-data exists yet for that link.
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
const allUsersView = document.getElementById("all-users-view");
const viewAllBtn = document.getElementById("view-all-btn");
const dashRefreshBtn = document.getElementById("dash-refresh-btn");
const dashRefreshLabel = document.getElementById("dash-refresh-label");
const backBtn = document.getElementById("back-btn");
const linksUsersBtn = document.getElementById("links-users-btn");
const usersHomeBtn = document.getElementById("users-home-btn");
const usersLinksBtn = document.getElementById("users-links-btn");

let currentView = "dashboard"; // dashboard | all | users

// DOM Elements — all links view
const allTableBody = document.getElementById("all-table-body");
const searchInput = document.getElementById("search-input");
const filterPill = document.getElementById("filter-pill");
const sortBtn = document.getElementById("sort-btn");
const sortLabel = document.getElementById("sort-label");
const sortMenu = document.getElementById("sort-menu");
const linksExportBtn = document.getElementById("links-export-btn");
const linksExportMenu = document.getElementById("links-export-menu");

// DOM Elements — all user listings
const allUsersBody = document.getElementById("all-users-body");
const usersSearchInput = document.getElementById("users-search-input");
const usersFilterPill = document.getElementById("users-filter-pill");
const usersSortBtn = document.getElementById("users-sort-btn");
const usersSortLabel = document.getElementById("users-sort-label");
const usersSortMenu = document.getElementById("users-sort-menu");
const usersLinkFilterBtn = document.getElementById("users-link-filter-btn");
const usersLinkFilterLabel = document.getElementById("users-link-filter-label");
const usersLinkFilterMenu = document.getElementById("users-link-filter-menu");
const usersExportBtn = document.getElementById("users-export-btn");
const usersExportMenu = document.getElementById("users-export-menu");
const usersMergeBtn = document.getElementById("users-merge-btn");
const usersMergeLabel = document.getElementById("users-merge-label");

// DOM Elements — new filter system (Choose Type / Link Name / Tag Filter)
const linksTypeBtn = document.getElementById("links-type-btn");
const linksTypeLabel = document.getElementById("links-type-label");
const linksTypeMenu = document.getElementById("links-type-menu");
const linksNameBtn = document.getElementById("links-name-btn");
const linksNameLabel = document.getElementById("links-name-label");
const linksNameMenu = document.getElementById("links-name-menu");
const linksTagBtn = document.getElementById("links-tag-btn");
const linksTagLabel = document.getElementById("links-tag-label");
const linksTagMenu = document.getElementById("links-tag-menu");
const linksTagTabs = document.getElementById("links-tag-tabs");
const linksTagOptions = document.getElementById("links-tag-options");
const linksTagClear = document.getElementById("links-tag-clear");
const linksTagChips = document.getElementById("links-tag-chips");

const usersTypeBtn = document.getElementById("users-type-btn");
const usersTypeLabel = document.getElementById("users-type-label");
const usersTypeMenu = document.getElementById("users-type-menu");
const usersTagBtn = document.getElementById("users-tag-btn");
const usersTagLabel = document.getElementById("users-tag-label");
const usersTagMenu = document.getElementById("users-tag-menu");
const usersTagTabs = document.getElementById("users-tag-tabs");
const usersTagOptions = document.getElementById("users-tag-options");
const usersTagClear = document.getElementById("users-tag-clear");
const usersTagChips = document.getElementById("users-tag-chips");

let linksTagFilterCtrl = null;
let usersTagFilterCtrl = null;

let usersLinkFilterMode = "all"; // "all" or a specific link code
let pendingVisitorHighlight = null;

// ---- New filter system state (Choose Type / Link Name / Tag Filter) ----
// "all" | "no-campaign" | "campaign"
let linksTypeFilter = "all";
let usersTypeFilter = "all";
// "all" | a specific link code — mirrors usersLinkFilterMode's shape for the
// new Link Name filter on the All Tracking Links page.
let linksNameFilter = "all";
// Which tag category tab is active inside each Tag Filter panel:
// "all" | "new" | "predefined". Kept as an object so it can be passed by
// reference into the shared tag-filter controller.
const linksTagCategory = { value: "all" };
const usersTagCategory = { value: "all" };
// Actively-selected tag names filtering each page (multi-select).
let linksSelectedTags = new Set();
let usersSelectedTags = new Set(); // { linkCode, visitorId, createdAt } — set right before navigating to the Users page so we can scroll to + expand that exact visit once rendered

// Pagination state — All Tracking Links & All User Listings both render in
// fixed-size pages instead of dumping the whole (potentially large) list
// into the DOM at once. This is what fixes the "list goes blank while
// scrolling fast" issue on mobile: the browser was choking on hundreds of
// heavy, blurred rows in one scrollable column.
let linksPage = 1;
let linksPageSize = 6;
let usersPage = 1;
let usersPageSize = 6;
const PAGE_SIZE_OPTIONS = [6, 10, 25, 50, 100];
let linksLoaded = false;
let clicksLoaded = false;

// Snapshots of exactly what's currently on screen (after filters/search/sort
// + the active page of pagination) for each list page — Export reads these
// so it always matches what the user is looking at, rather than re-deriving
// the filtered set separately and risking drift.
let linksExportSnapshot = { rows: [], filterLabel: "All Links" };
let usersExportSnapshot = { rows: [], filterLabel: "All Users" };

const SORT_LABELS = {
  newest: "Newest First",
  oldest: "Oldest First",
  most: "Most Clicks",
  least: "Least Clicks",
  az: "A → Z"
};

const USER_SORT_LABELS = {
  newest: "Newest First",
  oldest: "Oldest First",
  country: "Country A → Z"
};

const TYPE_LABELS = {
  all: "All Links",
  "no-campaign": "No Campaign",
  campaign: "All Campaign"
};

// ==========================================
// 2a. FILTER SYSTEM HELPERS (Choose Type / Link Name / Tag Filter)
// Shared by both "All Tracking Links" and "All User Listings" — pure
// helpers only, no DOM/data mutation, so they're safe to call from either
// page's render/populate functions without side effects.
// ==========================================
function linkMatchesType(link, type) {
  if (type === "no-campaign") return !link.campaign_name;
  if (type === "campaign") return !!link.campaign_name;
  return true; // "all"
}

function isPredefinedTagName(name) {
  return DEFAULT_TAG_SUGGESTIONS.some(t => t.toLowerCase() === String(name || "").toLowerCase());
}

function tagPoolForCategory(category) {
  if (category === "predefined") return DEFAULT_TAG_SUGGESTIONS.slice();
  if (category === "new") return knownTagNames.filter(t => !isPredefinedTagName(t));
  return knownTagNames.slice();
}

// Closes every open filter dropdown across both pages (Type / Link Name /
// Tag Filter / Sort / pagination page-size). Delegated by class rather than
// tracking each menu individually, so it also cleanly closes pagination's
// page-size dropdown even though that markup is rebuilt on every render.
function closeAllFilterMenus() {
  document.querySelectorAll(".sort-menu, .lt-dd-menu").forEach((menu) => {
    if (!menu.hidden) {
      menu.hidden = true;
      const trigger = menu.previousElementSibling;
      if (trigger && trigger.tagName === "BUTTON") trigger.setAttribute("aria-expanded", "false");
    }
  });
}

// Wires the standard open/close/toggle behavior shared by every dropdown
// trigger in the app: clicking the button closes any other open dropdown
// first, then toggles this one; clicks inside the menu don't bubble up and
// close it (so multi-select panels like Tag Filter stay open).
function wireDropdownToggle(btn, menu) {
  if (!btn || !menu) return;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasOpen = !menu.hidden;
    closeAllFilterMenus();
    menu.hidden = wasOpen;
    btn.setAttribute("aria-expanded", String(!menu.hidden));
  });
  menu.addEventListener("click", (e) => e.stopPropagation());
}

// Builds/refreshes a single-select "Link Name" style dropdown (used for
// both the new Tracking Links filter and the existing Users Link filter),
// scoped to whichever link codes currently match `type`.
function populateNameFilterMenu({ menu, label, type, currentValue, onChange, allLabel = "All Links" }) {
  const codes = links
    .filter(l => linkMatchesType(l, type))
    .map(l => l.code)
    .sort((a, b) => a.localeCompare(b));

  const safeValue = currentValue === "all" || codes.includes(currentValue) ? currentValue : "all";
  if (label && safeValue !== currentValue) label.textContent = allLabel;

  const optionsHtml = [`<button type="button" data-name="all" class="${safeValue === "all" ? "active" : ""}">${allLabel}</button>`]
    .concat(codes.length
      ? codes.map(c => `<button type="button" data-name="${escapeHtml(c)}" class="${safeValue === c ? "active" : ""}">${escapeHtml(c)}</button>`)
      : [`<div class="lt-dd-empty">No links in this type yet.</div>`]
    );
  menu.innerHTML = optionsHtml.join("");

  menu.querySelectorAll("button[data-name]").forEach((btn) => {
    btn.addEventListener("click", () => {
      menu.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      menu.hidden = true;
      const trigger = menu.previousElementSibling;
      if (trigger) trigger.setAttribute("aria-expanded", "false");
      onChange(btn.dataset.name, btn.textContent);
    });
  });

  return safeValue;
}

// Wires a "Choose Type" dropdown (fixed 3 options, no scrolling needed).
function setupTypeFilter({ btn, label, menu, onChange }) {
  wireDropdownToggle(btn, menu);
  menu.querySelectorAll("button[data-type]").forEach((btn2) => {
    btn2.addEventListener("click", () => {
      menu.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn2.classList.add("active");
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      label.textContent = TYPE_LABELS[btn2.dataset.type] || "Choose Type";
      onChange(btn2.dataset.type);
    });
  });
}

// Renders the checkbox list inside a Tag Filter panel for the active tab.
function renderTagOptions(optionsEl, category, selectedSet, onToggle) {
  const pool = tagPoolForCategory(category);
  if (!pool.length) {
    const emptyLabel = category === "new" ? "No newly created tags yet." : category === "predefined" ? "No predefined tags." : "No tags yet.";
    optionsEl.innerHTML = `<div class="lt-dd-empty">${emptyLabel}</div>`;
    return;
  }
  optionsEl.innerHTML = pool.map(name => `
    <label class="lt-tag-option">
      <input type="checkbox" value="${escapeHtml(name)}" ${selectedSet.has(name) ? "checked" : ""}>
      <span>${escapeHtml(name)}</span>
    </label>
  `).join("");
  optionsEl.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener("change", () => onToggle(cb.value, cb.checked));
  });
}

// Renders the removable-chip row underneath the controls, plus a
// "Clear All" chip once at least one tag is selected.
function renderTagChipsRow(chipsEl, selectedSet, onRemove) {
  if (!selectedSet.size) {
    chipsEl.hidden = true;
    chipsEl.innerHTML = "";
    return;
  }
  chipsEl.hidden = false;
  const clearId = `${chipsEl.id}-clearall`;
  chipsEl.innerHTML = Array.from(selectedSet).map(name => `
    <span class="lt-chip">${ICONS.tag}${escapeHtml(name)}<button type="button" class="lt-chip-remove" data-tag="${escapeHtml(name)}" aria-label="Remove ${escapeHtml(name)} filter">&times;</button></span>
  `).join("") + `<button type="button" class="lt-chip-clearall" id="${clearId}">Clear All</button>`;

  chipsEl.querySelectorAll(".lt-chip-remove").forEach((b) => {
    b.addEventListener("click", () => onRemove(b.dataset.tag));
  });
  const clearAllBtn = document.getElementById(clearId);
  if (clearAllBtn) clearAllBtn.addEventListener("click", () => onRemove(null));
}

// Wires a complete Tag Filter controller (tabs + scrollable checkbox list +
// clear button + chip row) for one page. Returns { refreshOptions } so the
// caller can re-render just the option pool (e.g. once tags finish loading
// from Supabase) without disturbing the current selection.
function setupTagFilter({ btn, label, menu, tabsEl, optionsEl, clearBtn, chipsEl, selectedSet, categoryRef, onApply }) {
  wireDropdownToggle(btn, menu);

  function refreshLabel() {
    label.textContent = selectedSet.size ? `Tags · ${selectedSet.size}` : "Tags";
  }

  function refreshOptions() {
    renderTagOptions(optionsEl, categoryRef.value, selectedSet, (name, checked) => {
      if (checked) selectedSet.add(name); else selectedSet.delete(name);
      refreshAll();
    });
  }

  function refreshChips() {
    renderTagChipsRow(chipsEl, selectedSet, (tag) => {
      if (tag === null) selectedSet.clear(); else selectedSet.delete(tag);
      refreshAll();
    });
  }

  function refreshAll() {
    refreshOptions();
    refreshChips();
    refreshLabel();
    onApply();
  }

  tabsEl.querySelectorAll("button[data-cat]").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      categoryRef.value = tabBtn.dataset.cat;
      tabsEl.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      tabBtn.classList.add("active");
      refreshOptions();
    });
  });

  clearBtn.addEventListener("click", () => {
    selectedSet.clear();
    refreshAll();
  });

  refreshOptions();
  refreshChips();
  refreshLabel();

  return { refreshOptions };
}

// ==========================================
// 2. LIFECYCLE ROUTING & APP STARTUP
// ==========================================
// ==========================================
// View mode (Grid View only)
// ==========================================
// The List View toggle button has been removed — Grid View is now the only
// (and default) layout for both the All Tracking Links and All User
// Listings pages. `getViewMode` is kept as a small shim (rather than
// inlining "grid" everywhere) so buildLinkList's mode switch and any other
// caller keep working unchanged.
function getViewMode() {
  return "grid";
}

// Makes sure the container always carries the "grid-view" class, regardless
// of any older "lt-view-modes" preference a returning visitor's browser may
// still have saved from before List View was removed.
function forceGridView(toggleId, containerEl) {
  const toggle = document.getElementById(toggleId);
  if (toggle) toggle.dataset.active = "grid";
  if (containerEl) containerEl.classList.add("grid-view");
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initHoverTips();
  forceGridView("links-view-toggle", allTableBody);
  forceGridView("users-view-toggle", allUsersBody);
  try { localStorage.removeItem("lt-view-modes"); } catch {}
  renderSkeletonRows(tableBody, 3);
  renderSkeletonRows(allTableBody, 6);
  renderSkeletonRows(allUsersBody, 6);
  loadLinks();
  loadClicks();
  loadSocialPlatforms().then(loadCampaignJoins);
  loadKnownTags();

  // Deep-link support: opening this page as index.html#all or #users jumps
  // straight to that view. Added so external entry points (e.g. the
  // OceanGlass overview dashboard's sidebar) can link directly into a
  // specific view instead of always landing on the dashboard. No hash (or
  // any other value) falls through to the existing default "dashboard" view.
  const deepLinkView = (location.hash || "").replace("#", "");
  if (deepLinkView === "all" || deepLinkView === "users") {
    switchView(deepLinkView);
  }

  createBtn.addEventListener("click", handleCreateLink);

  // Campaign Setup — opening/closing the right-panel workflow
  campaignSetupArrow.addEventListener("click", () => {
    if (campaignSetupOpen) { closeCampaignSetup(false); return; }
    openCampaignSetup();
  });
  campaignCancelBtn.addEventListener("click", () => closeCampaignSetup(false));
  campaignConfirmBtn.addEventListener("click", () => closeCampaignSetup(true));

  tagInput.addEventListener("input", renderTagSuggestions);
  tagInput.addEventListener("focus", renderTagSuggestions);
  tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTempTag(tagInput.value);
    }
  });
  document.addEventListener("click", (e) => {
    if (!tagInput.contains(e.target) && !tagSuggestions.contains(e.target)) {
      tagSuggestions.hidden = true;
    }
  });

  // Lock the rest of the Create Link form while Campaign Setup is open —
  // clicking/focusing another field cancels the attempt and explains why.
  [urlInput, aliasInput].forEach(el => {
    el.addEventListener("focus", () => guardLockedField(el));
  });
  viewAllBtn.addEventListener("click", () => { linksPage = 1; switchView("all"); });
  backBtn.addEventListener("click", () => switchView("dashboard"));
  linksUsersBtn.addEventListener("click", () => openUsersView());
  usersHomeBtn.addEventListener("click", () => switchView("dashboard"));
  usersLinksBtn.addEventListener("click", () => { linksPage = 1; switchView("all"); });
  themeToggleBtn.addEventListener("click", toggleTheme);

  // Each render fully rebuilds the listing (container.innerHTML = ""
  // then re-appends every card), which replays each card's entrance
  // animation. Re-rendering on every single keystroke made the whole
  // list/grid visibly flash on each character typed — debouncing so the
  // rebuild only fires once typing pauses removes that flicker while
  // still filtering live as the user types.
  searchInput.addEventListener("input", debounce((e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    linksPage = 1;
    renderAllLinks();
  }, 220));

  usersSearchInput.addEventListener("input", debounce((e) => {
    userSearchTerm = e.target.value.trim().toLowerCase();
    usersPage = 1;
    renderAllUsers();
  }, 220));

  const runHeaderSearch = () => {
    const term = headerSearchInput.value.trim();
    searchTerm = term.toLowerCase();
    searchInput.value = term;
    linksPage = 1;
    switchView("all");
  };
  headerSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runHeaderSearch();
  });
  headerSearchGo.addEventListener("click", runHeaderSearch);

  wireDropdownToggle(sortBtn, sortMenu);
  sortMenu.querySelectorAll("button[data-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      sortMode = btn.dataset.sort;
      sortLabel.textContent = SORT_LABELS[sortMode];
      sortMenu.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      sortMenu.hidden = true;
      sortBtn.setAttribute("aria-expanded", "false");
      linksPage = 1;
      renderAllLinks();
    });
  });

  wireDropdownToggle(usersSortBtn, usersSortMenu);
  usersSortMenu.querySelectorAll("button[data-usersort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      userSortMode = btn.dataset.usersort;
      usersSortLabel.textContent = USER_SORT_LABELS[userSortMode];
      usersSortMenu.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      usersSortMenu.hidden = true;
      usersSortBtn.setAttribute("aria-expanded", "false");
      usersPage = 1;
      renderAllUsers();
    });
  });

  wireDropdownToggle(linksExportBtn, linksExportMenu);
  linksExportMenu.querySelectorAll("button[data-export]").forEach((btn) => {
    btn.addEventListener("click", () => {
      linksExportMenu.hidden = true;
      linksExportBtn.setAttribute("aria-expanded", "false");
      exportLinks(btn.dataset.export);
    });
  });

  wireDropdownToggle(usersExportBtn, usersExportMenu);
  usersExportMenu.querySelectorAll("button[data-export]").forEach((btn) => {
    btn.addEventListener("click", () => {
      usersExportMenu.hidden = true;
      usersExportBtn.setAttribute("aria-expanded", "false");
      exportUsers(btn.dataset.export);
    });
  });

  usersMergeBtn.addEventListener("click", handleMergeDuplicates);
  dashRefreshBtn.addEventListener("click", handleDashboardRefresh);

  // ---- All Tracking Links: Choose Type + Link Name + Tag Filter ----
  setupTypeFilter({
    btn: linksTypeBtn, label: linksTypeLabel, menu: linksTypeMenu,
    onChange: (type) => {
      linksTypeFilter = type;
      linksNameFilter = populateNameFilterMenu({
        menu: linksNameMenu, label: linksNameLabel, type: linksTypeFilter, currentValue: "all",
        onChange: (val, text) => {
          linksNameFilter = val;
          linksNameLabel.textContent = text;
          linksPage = 1;
          renderAllLinks();
        }
      });
      linksNameLabel.textContent = "All Links";
      linksPage = 1;
      renderAllLinks();
    }
  });

  wireDropdownToggle(linksNameBtn, linksNameMenu);
  populateNameFilterMenu({
    menu: linksNameMenu, label: linksNameLabel, type: linksTypeFilter, currentValue: linksNameFilter,
    onChange: (val, text) => {
      linksNameFilter = val;
      linksNameLabel.textContent = text;
      linksPage = 1;
      renderAllLinks();
    }
  });

  linksTagFilterCtrl = setupTagFilter({
    btn: linksTagBtn, label: linksTagLabel, menu: linksTagMenu, tabsEl: linksTagTabs,
    optionsEl: linksTagOptions, clearBtn: linksTagClear, chipsEl: linksTagChips,
    selectedSet: linksSelectedTags, categoryRef: linksTagCategory,
    onApply: () => { linksPage = 1; renderAllLinks(); }
  });

  // ---- All User Listings: Choose Type + Link Name + Tag Filter ----
  setupTypeFilter({
    btn: usersTypeBtn, label: usersTypeLabel, menu: usersTypeMenu,
    onChange: (type) => {
      usersTypeFilter = type;
      usersLinkFilterMode = "all";
      usersLinkFilterLabel.textContent = "All Links";
      populateUsersLinkFilter();
      usersPage = 1;
      renderAllUsers();
    }
  });

  wireDropdownToggle(usersLinkFilterBtn, usersLinkFilterMenu);

  usersTagFilterCtrl = setupTagFilter({
    btn: usersTagBtn, label: usersTagLabel, menu: usersTagMenu, tabsEl: usersTagTabs,
    optionsEl: usersTagOptions, clearBtn: usersTagClear, chipsEl: usersTagChips,
    selectedSet: usersSelectedTags, categoryRef: usersTagCategory,
    onApply: () => { usersPage = 1; renderAllUsers(); }
  });

  // Close any open dropdown (filter menus or row kebab menus) on outside click
  document.addEventListener("click", () => {
    closeAllFilterMenus();
    closeAllKebabMenus();
  });
});

// Rebuilds the "Link Name" dropdown options from the current set of links,
// scoped to whichever Choose Type is active. Called every time the Users
// page is opened (and whenever links/type change), so it always reflects
// links created since the last visit.
function populateUsersLinkFilter() {
  usersLinkFilterMode = populateNameFilterMenu({
    menu: usersLinkFilterMenu, label: usersLinkFilterLabel, type: usersTypeFilter, currentValue: usersLinkFilterMode,
    onChange: (val, text) => {
      usersLinkFilterMode = val;
      usersLinkFilterLabel.textContent = text;
      usersPage = 1;
      renderAllUsers();
    }
  });
  usersLinkFilterLabel.textContent = usersLinkFilterMode === "all" ? "All Links" : usersLinkFilterMode;
}

// Central entry point for jumping to the Users page, optionally pre-filtered
// to a single link's traffic. Used by: the dashboard's per-link "Details"
// buttons, the dashboard's "View all N visitors" link, and the All Tracking
// Links page's per-row eye button.
function openUsersView(linkCode, highlight) {
  usersTypeFilter = "all";
  if (usersTypeLabel) usersTypeLabel.textContent = "Choose Type";
  usersTypeMenu.querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.type === "all"));
  usersLinkFilterMode = linkCode || "all";
  usersLinkFilterLabel.textContent = linkCode || "All Links";
  pendingVisitorHighlight = highlight || null;
  usersPage = 1;
  switchView("users");
}

function switchView(view) {
  currentView = view;
  dashboardView.hidden = view !== "dashboard";
  allLinksView.hidden = view !== "all";
  allUsersView.hidden = view !== "users";

  if (view === "all") {
    if (linksLoaded) { renderAllLinks(); } else { renderSkeletonRows(allTableBody, 6); document.getElementById("links-pagination").innerHTML = ""; }
  } else if (view === "users") {
    populateUsersLinkFilter();
    if (clicksLoaded) { renderAllUsers(); } else { renderSkeletonRows(allUsersBody, 6); document.getElementById("users-pagination").innerHTML = ""; }
  }

  if (view !== "dashboard") {
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }
}

// ==========================================
// 2b. THEME SWITCHER (Winter Peaks ⇄ Aurora Glass)
// ==========================================
const THEME_ORDER = ["winter", "aurora", "lumina"];

function initTheme() {
  const saved = localStorage.getItem("lt-theme");
  if (THEME_ORDER.includes(saved) && saved !== "winter") applyTheme(saved, false);
}

// ==========================================
// HOVER TOOLTIP (IP / Visitor ID full values)
// ==========================================
// One shared, `position: fixed` bubble reused for every .lt-tooltip field
// instead of a per-field CSS pseudo-element. Fixed positioning means it's
// never clipped by an ancestor's overflow, and measuring it with
// getBoundingClientRect on every show lets it clamp to the viewport —
// so a long IP hash can no longer push the bubble off-screen the way the
// old centered-by-percentage pseudo-element could.
let hoverTipEl = null;

function initHoverTips() {
  if (!window.matchMedia("(hover: hover)").matches) return; // touch devices keep native title only

  hoverTipEl = document.createElement("div");
  hoverTipEl.id = "lt-hover-tip";
  document.body.appendChild(hoverTipEl);

  document.addEventListener("mouseover", (e) => {
    const field = e.target.closest(".lt-tooltip");
    if (field) showHoverTip(field);
  });

  document.addEventListener("mouseout", (e) => {
    const field = e.target.closest(".lt-tooltip");
    if (field && !field.contains(e.relatedTarget)) hideHoverTip();
  });

  // A scroll or resize can leave the bubble pointing at empty space —
  // simplest correct fix is to just hide it rather than re-track the
  // now-possibly-moved field.
  window.addEventListener("scroll", hideHoverTip, { passive: true, capture: true });
  window.addEventListener("resize", hideHoverTip);
}

// Buttons whose hover tip is a short bullet list instead of a single line
// of plain text (see showHoverTip below) — keyed by element id.
const TOOLTIP_LISTS = {
  "dash-refresh-btn": [
    "Scans all visitors for likely duplicates (same device fingerprint, same IP + OS, or same IP across a mobile + desktop device)",
    "Merges matches into one card",
    "Reloads the dashboard",
  ],
  "users-merge-btn": [
    "Scans all visitors for likely duplicates (same device fingerprint, same IP + OS, or same IP across a mobile + desktop device)",
    "Merges matches into one card",
  ],
};

function showHoverTip(field) {
  const list = TOOLTIP_LISTS[field.id];
  const text = field.dataset.tooltip;
  if (!list && !text) return;
  if (!hoverTipEl) return;

  hoverTipEl.classList.toggle("is-list", !!list);
  if (list) {
    hoverTipEl.innerHTML = `<ul>${list.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  } else {
    hoverTipEl.textContent = text;
  }
  hoverTipEl.classList.remove("is-visible", "is-below");

  const fieldRect = field.getBoundingClientRect();
  const tipRect = hoverTipEl.getBoundingClientRect();
  const margin = 8;
  const gap = 12;

  let left = fieldRect.left + fieldRect.width / 2 - tipRect.width / 2;
  left = Math.min(Math.max(left, margin), window.innerWidth - tipRect.width - margin);

  let top = fieldRect.top - tipRect.height - gap;
  let below = false;
  if (top < margin) {
    top = fieldRect.bottom + gap;
    below = true;
  }

  // Arrow stays pointed at the field's true center even when the bubble
  // itself has been shifted sideways to stay on-screen.
  const fieldCenter = fieldRect.left + fieldRect.width / 2;
  let arrowLeft = fieldCenter - left;
  arrowLeft = Math.min(Math.max(arrowLeft, 12), tipRect.width - 12);

  hoverTipEl.style.setProperty("--lt-tip-arrow-left", `${arrowLeft}px`);
  hoverTipEl.style.left = `${left}px`;
  hoverTipEl.style.top = `${top}px`;
  hoverTipEl.classList.toggle("is-below", below);
  hoverTipEl.classList.add("is-visible");
}

function hideHoverTip() {
  if (hoverTipEl) hoverTipEl.classList.remove("is-visible");
}

function toggleTheme() {
  const current = document.body.classList.contains("theme-aurora")
    ? "aurora"
    : document.body.classList.contains("theme-lumina")
      ? "lumina"
      : "winter";
  const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
  applyTheme(next, true);
}

function applyTheme(name, animate) {
  const btn = themeToggleBtn;
  if (animate) {
    btn.classList.add("theme-pulse");
    setTimeout(() => btn.classList.remove("theme-pulse"), 700);
  }
  document.body.classList.remove("theme-aurora", "theme-lumina");
  if (name === "aurora") {
    document.body.classList.add("theme-aurora");
    brandSubtitle.textContent = "Aurora Glass · Analytics";
  } else if (name === "lumina") {
    document.body.classList.add("theme-lumina");
    brandSubtitle.textContent = "Lumina Glass · Analytics";
  } else {
    brandSubtitle.textContent = "URL Shortener & Analytics";
  }
  localStorage.setItem("lt-theme", name);
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
  if (campaignSetupOpen) {
    showToast("Please complete or cancel Campaign Setup first.");
    return;
  }

  urlError.hidden = true;
  aliasError.hidden = true;
  campaignError.hidden = true;

  const originalUrl = normalizeUrl(urlInput.value);
  const campaignName = campaignInput.value.trim();
  let alias = aliasInput.value.trim().toLowerCase();

  if (!originalUrl) {
    urlError.hidden = false;
    return;
  }

  if (!campaignName) {
    campaignError.hidden = false;
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
    clicks: 0,
    campaign_name: campaignName
  };

  try {
    const newRecord = await saveLink(payload);

    if (newRecord) {
      const platformSlugs = committedPlatforms.slice();
      const tagNames = committedTags.slice();
      await saveCampaignRelations(newRecord.code, platformSlugs, tagNames);

      links.unshift(newRecord);
      renderAll();
      displayReceipt(newRecord);

      urlInput.value = "";
      aliasInput.value = "";
      resetCampaignState();
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
    linksLoaded = true;
    renderAll();
    return;
  }

  links = data || [];
  linksLoaded = true;
  renderAll();
}

// Loads the visitor-level analytics captured by api/redirect.js.
// Gracefully no-ops (rather than throwing) if the "clicks" table hasn't
// been created yet in Supabase — see supabase_migration.sql.
async function loadClicks() {
  const { data, error } = await supabaseClient
    .from("clicks")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.warn("Visitor analytics table not available yet:", error.message);
    clicksLog = [];
  clicksByCode = {};
    clicksLoaded = true;
    if (currentView === "users") renderAllUsers();
    return;
  }

  clicksLog = data || [];
  rebuildClicksByCodeIndex();
  clicksLoaded = true;
  renderAll();
  if (currentView === "users") renderAllUsers();
}

// clicksForCode() is called repeatedly while building every link/grid row —
// a few times per row, for every row on the page, on every re-render (each
// filter/sort/search change). It used to re-scan the entire clicksLog array
// (up to 500 rows) each call, which is what made filter switching and
// scrolling feel sluggish once there was any real amount of visitor data.
// Indexing once by link_code turns every one of those lookups into an O(1)
// map read instead of an O(n) scan.
let clicksByCode = {};

function rebuildClicksByCodeIndex() {
  const map = {};
  for (const c of clicksLog) {
    (map[c.link_code] || (map[c.link_code] = [])).push(c);
  }
  clicksByCode = map;
}

function clicksForCode(code) {
  return clicksByCode[code] || [];
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

// "Visit" action — opens the link the same way a real visitor would: through
// the tracked /api/redirect endpoint, not the raw destination URL.
//
// This used to open link.original directly and bump links.clicks by hand
// from the browser. That duplicated (and diverged from) the tracking that
// api/redirect.js already does for every real click: it inflated the
// "clicks" number on the links table without ever inserting a row into the
// "clicks" table, so this click had no visitor_id, device, or geo data and
// never showed up on the Users page or in a link's visitor list. That gap
// is exactly what made "clicks" and "users" stop matching up — every
// dashboard "visit" counted as a click but not as a user.
//
// Routing through /api/redirect makes this click go through the *one*
// place clicks are recorded, so it's logged as a real, deduped visit —
// consistent with every other click on the link.
// Guards openLink() against a genuine double-fire: a fast double-tap/
// double-click, or a touch event and its synthetic mouse "click" both
// landing, can call openLink() twice for what the person experienced as
// one interaction. This is different from two deliberate, separate clicks
// (which SHOULD both count — that's two real visits) — it's specifically
// about suppressing a second call that fires within the same interaction
// window as the first, before the first one has even finished opening the
// tab. Keyed by link code so clicking two different links back-to-back is
// never blocked by this.
const recentOpens = new Map();
const OPEN_DEBOUNCE_MS = 800;

async function openLink(code) {
  const link = links.find(l => l.code === code);
  if (!link) return;

  const now = Date.now();
  const lastOpen = recentOpens.get(code) || 0;
  if (now - lastOpen < OPEN_DEBOUNCE_MS) return;
  recentOpens.set(code, now);

  window.open(`${BASE_URL}/api/redirect?id=${code}`, "_blank");

  // The click above is logged server-side and won't be reflected in our
  // already-loaded `links`/`clicksLog` state, so pull fresh data shortly
  // after so the dashboard's counts catch up without a manual refresh.
  setTimeout(() => {
    loadLinks();
    loadClicks();
  }, 1200);
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
  expandedRows.delete(code);
  renderAll();
  showToast("Tracking link deleted successfully.");
}

async function runMergeDuplicates(btnEl, labelEl, { confirmFirst = true, busyLabel = "Merging…", loadLinksToo = false } = {}) {
  if (confirmFirst && !confirm(
    "Scan every recorded visitor for likely duplicates (same device fingerprint, same IP + OS, or the same IP across a mobile + desktop device) and merge them into a single visitor card?\n\nThis updates visitor records directly and can't be undone."
  )) return;

  btnEl.disabled = true;
  btnEl.classList.add("is-loading");
  const originalLabel = labelEl.textContent;
  labelEl.textContent = busyLabel;

  try {
    const { data, error } = await supabaseClient.rpc("merge_duplicate_visitors", {});

    if (error) {
      console.error("Merge duplicates error:", error);
      showToast("Failed to merge duplicate visitors.");
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    const mergedCount = result?.merged_visitor_count ?? 0;

    // loadClicks() alone is enough to fold duplicate visitor cards together
    // and combine their total click counts everywhere clicksLog feeds a
    // view (dashboard table, Users listing, visitor cards). Links (and
    // their own click totals) don't change shape from a visitor merge, but
    // the dashboard Refresh action re-pulls them too so "Refresh" reads as
    // a full data reload, not just a dedupe pass.
    if (loadLinksToo) await loadLinks();
    await loadClicks();

    if (mergedCount === 0) {
      showToast(loadLinksToo ? "Refreshed — no duplicate visitors found." : "No duplicate visitors found.");
      return;
    }

    showToast(`Merged ${mergedCount.toLocaleString()} duplicate ${mergedCount === 1 ? "visitor" : "visitors"} — click counts combined.`);
  } finally {
    btnEl.disabled = false;
    btnEl.classList.remove("is-loading");
    labelEl.textContent = originalLabel;
  }
}

// Flow 2 — Duplicate Merge (Reconciliation). Real-time matching in
// api/redirect.js only ever looks back MATCH_WINDOW_MINUTES worth of
// clicks, so pairs of clicks from the same real visitor that land further
// apart than that (or that arrive during a race, a temporary lookup
// failure, or an IP change) can still end up as separate visitor cards.
// This is the admin-triggered cleanup pass that catches those: it re-scans
// ALL recorded clicks (no time bound, unlike the real-time matcher) in
// three passes — device fingerprint first, then same IP + OS + device,
// then (new) same IP across different device types, e.g. a "Mobile" card
// and a "Desktop" card sharing one IP — and folds every duplicate group's
// clicks onto the visitor_id that clicked first, so the extra cards
// disappear from the Users listing.
// merge_duplicate_visitors() (see merge_duplicate_visitors_migration.sql)
// does the actual grouping/reassignment in one locked database call so
// concurrent runs (e.g. two admins clicking this at once) can't race.
function handleMergeDuplicates() {
  return runMergeDuplicates(usersMergeBtn, usersMergeLabel);
}

// Dashboard "Refresh" button (left of View All Links): same merge pass as
// above, plus a full links+clicks reload, so any visitor cards shown on the
// dashboard (Recent Visitors, Tracking History) also collapse duplicates
// into one card with a combined Total Clicks count.
function handleDashboardRefresh() {
  return runMergeDuplicates(dashRefreshBtn, dashRefreshLabel, { busyLabel: "Refreshing…", loadLinksToo: true });
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
  refreshFilterOptionPools();
  if (currentView === "all") renderAllLinks();
  if (currentView === "users") renderAllUsers();
}

// Keeps every filter dropdown's option pool in sync with the latest data
// (links created/deleted, tags loaded from Supabase) without touching the
// user's current selections. Safe to call before the dropdowns exist yet
// (very first loadLinks()/loadClicks() calls can race DOMContentLoaded).
function refreshFilterOptionPools() {
  if (!linksNameMenu || !usersLinkFilterMenu) return;

  linksNameFilter = populateNameFilterMenu({
    menu: linksNameMenu, label: linksNameLabel, type: linksTypeFilter, currentValue: linksNameFilter,
    onChange: (val, text) => {
      linksNameFilter = val;
      linksNameLabel.textContent = text;
      linksPage = 1;
      renderAllLinks();
    }
  });

  populateUsersLinkFilter();

  if (linksTagFilterCtrl) linksTagFilterCtrl.refreshOptions();
  if (usersTagFilterCtrl) usersTagFilterCtrl.refreshOptions();
}

function updateStats() {
  const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);
  statActive.classList.remove("is-loading");
  statClicks.classList.remove("is-loading");
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

// Same date/time as formatDate(), but split into two pieces so the time can
// sit on its own line under the date in tight card layouts instead of being
// squeezed onto one line and clipped by the field's ellipsis.
function formatDateParts(iso) {
  if (!iso) return { date: "—", time: "" };
  const d = new Date(iso);
  if (isNaN(d)) return { date: "—", time: "" };
  return {
    date: d.toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" }),
    time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  };
}

function closeAllKebabMenus() {
  document.querySelectorAll(".kebab-menu, .grid-kebab-menu").forEach(m => m.hidden = true);
  document.querySelectorAll(".kebab-open").forEach(el => el.classList.remove("kebab-open"));
}

// Recent (top 6) list on the dashboard — always List View (no grid toggle here)
function renderTable() {
  footerCount.classList.remove("is-loading");
  footerCount.textContent = `${links.length.toLocaleString()} link${links.length === 1 ? '' : 's'} created`;
  buildLinkList(tableBody, links.slice(0, 6), { context: "dashboard", mode: "list" });
}

// Full searchable / sortable list
// ==========================================
// PAGINATION — shared by All Tracking Links & All User Listings.
// Keeps the DOM small (one page's worth of rows at a time) which is what
// actually fixes the mobile "list disappears on fast scroll" bug, and
// surfaces total counts + page controls as requested.
// ==========================================
function paginate(list, page, pageSize) {
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = list.slice(start, start + pageSize);
  return { pageItems, total, totalPages, safePage, start };
}

function renderPagination(el, { page, pageSize, total, onPageChange, onPageSizeChange }) {
  if (total === 0) {
    el.innerHTML = "";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  // Windowed page numbers: first, last, current +/-1, with ellipses.
  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  // Custom Lumia-glass dropdown (instead of a native <select>) so the
  // page-size picker shares the exact same look, animation, and scrollbar
  // language as every other filter dropdown in the app.
  const ddId = `${el.id}-pagesize`;
  const sizeOptionsHtml = PAGE_SIZE_OPTIONS
    .map(n => `<button type="button" data-size="${n}" class="${n === pageSize ? "active" : ""}">${n} / page</button>`)
    .join("");

  el.innerHTML = `
    <div class="pagination-summary">Showing <strong>${start}–${end}</strong> of <strong>${total}</strong></div>
    <div class="pagination-controls">
      <button type="button" class="page-btn page-nav" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="Previous page">${ICONS.chevron}</button>
      <div class="page-numbers">
        ${pages.map(p => p === "…"
          ? `<span class="page-ellipsis">…</span>`
          : `<button type="button" class="page-btn page-num ${p === page ? "active" : ""}" data-page="${p}">${p}</button>`
        ).join("")}
      </div>
      <button type="button" class="page-btn page-nav page-nav--next" data-page="${page + 1}" ${page >= totalPages ? "disabled" : ""} aria-label="Next page">${ICONS.chevron}</button>
      <div class="lt-dd-wrap lt-pagesize-wrap">
        <button type="button" class="page-size-btn lt-dd-btn" id="${ddId}-btn" aria-haspopup="true" aria-expanded="false" aria-label="Rows per page">
          <span id="${ddId}-label">${pageSize} / page</span>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="lt-dd-menu lt-dd-scroll lt-pagesize-scroll" id="${ddId}-menu" hidden>${sizeOptionsHtml}</div>
      </div>
    </div>
  `;

  el.querySelectorAll(".page-btn[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = Number(btn.dataset.page);
      if (target >= 1 && target <= totalPages) onPageChange(target);
    });
  });

  const ddBtn = el.querySelector(`#${ddId}-btn`);
  const ddMenu = el.querySelector(`#${ddId}-menu`);
  const ddLabel = el.querySelector(`#${ddId}-label`);
  wireDropdownToggle(ddBtn, ddMenu);
  ddMenu.querySelectorAll("button[data-size]").forEach(btn => {
    btn.addEventListener("click", () => {
      ddMenu.hidden = true;
      ddBtn.setAttribute("aria-expanded", "false");
      ddLabel.textContent = `${btn.dataset.size} / page`;
      onPageSizeChange(Number(btn.dataset.size));
    });
  });
}

// Lightweight themed skeleton shown the moment a page loads, before the
// first Supabase response lands — so slow mobile connections show a clear
// "loading" state instead of an empty panel that looks broken.
function renderSkeletonRows(container, count = 4) {
  container.innerHTML = Array.from({ length: count }).map(() => `
    <div class="skeleton-row">
      <span class="skeleton-block skeleton-icon"></span>
      <span class="skeleton-lines">
        <span class="skeleton-block skeleton-line skeleton-line--wide"></span>
        <span class="skeleton-block skeleton-line skeleton-line--narrow"></span>
      </span>
    </div>
  `).join("");
}

function renderAllLinks() {
  let list = links.slice();

  if (linksTypeFilter !== "all") {
    list = list.filter(l => linkMatchesType(l, linksTypeFilter));
  }

  if (linksNameFilter !== "all") {
    list = list.filter(l => l.code === linksNameFilter);
  }

  if (linksSelectedTags.size) {
    list = list.filter(l => (linkTagsByCode[l.code] || []).some(t => linksSelectedTags.has(t)));
  }

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

  const anyFilterActive = !!searchTerm || linksTypeFilter !== "all" || linksNameFilter !== "all" || linksSelectedTags.size > 0;
  filterPill.textContent = anyFilterActive
    ? `All Links · ${list.length.toLocaleString()} of ${links.length.toLocaleString()}`
    : `All Links · ${links.length.toLocaleString()}`;

  const { pageItems, safePage, totalPages } = paginate(list, linksPage, linksPageSize);
  linksPage = safePage;

  // fullRows + offset let the export functions number rows continuously
  // (page 2 continues at 7, 8, 9…) instead of every page restarting at 1.
  linksExportSnapshot = {
    rows: pageItems,
    fullRows: list,
    offset: (linksPage - 1) * linksPageSize,
    filterLabel: filterPill.textContent
  };

  buildLinkList(allTableBody, pageItems, { emptyLabel: anyFilterActive ? "No links match your filters." : "No links created yet.", context: "all", mode: getViewMode() });

  renderPagination(document.getElementById("links-pagination"), {
    page: linksPage,
    pageSize: linksPageSize,
    total: list.length,
    onPageChange: (p) => { linksPage = p; renderAllLinks(); document.getElementById("all-table-body").scrollIntoView({ behavior: "smooth", block: "start" }); },
    onPageSizeChange: (size) => { linksPageSize = size; linksPage = 1; renderAllLinks(); }
  });
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

  const mode = opts.mode === "grid" ? "grid" : "list";
  const context = opts.context || "dashboard";
  list.forEach(link => {
    let node;
    if (context === "dashboard") {
      node = buildHistoryItem(link);
    } else if (mode === "grid") {
      node = buildGridCard(link, context);
    } else {
      node = buildLinkItem(link, context);
    }
    container.appendChild(node);
  });
}

// Small glass icon badge helper — used across visitor detail cards
function glassIcon(label, glowClass, innerSvg) {
  return `<span class="glass-field-icon ${glowClass}" title="${label}">${innerSvg}</span>`;
}

const ICONS = {
  country: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="9" r="2.4" stroke="currentColor" stroke-width="1.8"/></svg>',
  device: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6.5" y="2.5" width="11" height="19" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 18.5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  browser: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" stroke="currentColor" stroke-width="1.6"/></svg>',
  os: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="12" rx="1.6" stroke="currentColor" stroke-width="1.8"/><path d="M8 20h8M12 16v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="8.5" r="3.5" stroke="currentColor" stroke-width="1.8"/><path d="M4.5 20c1.4-3.6 4.5-5.5 7.5-5.5s6.1 1.9 7.5 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 5h8l8 8-8 8-8-8V5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8" cy="9" r="1.4" fill="currentColor"/></svg>',
  status: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2.5 13h4l2.5-7 4 14 2.5-7h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8.5" y="8.5" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 8.5V5.5A2 2 0 0 0 13.5 3.5H5.5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" stroke="currentColor" stroke-width="1.8"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 6H5.5A1.5 1.5 0 0 0 4 7.5v11A1.5 1.5 0 0 0 5.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14 4h6v6M20 4l-9 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 20V10M11 20V4M18 20v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  click: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 3.5v3M4.6 6.1l2.1 2.1M3.5 12h3M15.4 6.1l-2.1 2.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M9.3 9.4l8.7 3.3-3.5 1.5-1.5 3.5-3.7-8.3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  ip: '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M7 9v6M12 9v6M17 9v6M7 9h.01M12 9h.01M17 9h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

// ==========================================
// 2c. CAMPAIGN SETUP (multi-platform + tags)
// ==========================================
// Real recognizable glyphs for each platform (instead of the old two-letter
// text badges), so the icon still reads correctly at a glance even scaled
// up big — vector paths stay crisp at any zoom, where text initials just
// looked blurry/generic once enlarged.
const PLATFORM_ICON_SVGS = {
  facebook: '<svg viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M15.5 8.5h2V5.6c-.35-.05-1.55-.15-2.95-.15-2.92 0-4.92 1.83-4.92 5.2v2.75H6.75v3.3h2.88V21h3.4v-6.7h2.76l.44-3.3h-3.2V10.9c0-.96.26-1.6 1.47-1.6Z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.4"/><circle cx="16.4" cy="7.6" r="0.9" fill="#fff" stroke="none"/></svg>',
  twitter: '<svg viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M5 5l14 14M19 5 5 19" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg"><rect x="4.5" y="9.5" width="2.8" height="9" /><circle cx="5.9" cy="6" r="1.7"/><path d="M10 9.5h2.7v1.3c.5-.85 1.5-1.55 3.05-1.55 3 0 3.75 1.75 3.75 4.4v5.35h-2.8v-4.75c0-1.2-.35-2.05-1.55-2.05-1.15 0-1.7.75-1.7 2.05v4.75H10V9.5Z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg"><rect x="3.5" y="6.5" width="17" height="11" rx="3.2"/><path d="M10.5 9.8v4.4l4-2.2-4-2.2Z" fill="#0a0d1c"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5a7.4 7.4 0 0 0-6.35 11.2L4.5 19.5l3.95-1.1A7.4 7.4 0 1 0 12 4.5Z" fill="none" stroke="#fff" stroke-width="1.7"/><path d="M9.2 9.6c.2-.5.4-.5.6-.5h.45c.15 0 .35 0 .5.4.2.5.65 1.7.7 1.8.05.15.1.3 0 .5-.1.2-.15.3-.3.45-.15.15-.3.35-.45.45-.15.15-.3.3-.15.6.15.3.7 1.15 1.5 1.85 1 .9 1.85 1.2 2.15 1.35.3.15.5.1.65-.1.2-.2.7-.85.9-1.15.2-.3.4-.25.65-.15.25.1 1.65.8 1.9.95.25.15.45.2.5.35.05.15.05.85-.2 1.65-.25.8-1.5 1.45-2.1 1.5-.55.1-1.2.15-1.95-.1a11 11 0 0 1-1.15-.4C11 18.7 8.3 16.9 7.3 14.2c-.15-.4-.25-.75-.25-1.1 0-.65.35-1.25.55-1.5.2-.25.5-.25.65-.25Z" fill="#fff"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M4.5 12.2 18.7 6.4c.65-.25 1.25.35.95 1.05l-2.8 11.7c-.2.85-.75 1.05-1.35.65l-3.5-2.6-1.7 1.65c-.2.2-.4.3-.7.3l.25-3.55 6.4-5.85c.3-.25-.05-.4-.4-.15l-7.9 5-3.4-1.05c-.75-.25-.75-.75.15-1.15Z"/></svg>',
  snapchat: '<svg viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.2c2.2 0 3.6 1.75 3.5 3.85-.05.9-.1 1.6 0 2.05.1.05.5.15.95-.1.35-.2.85 0 .8.5-.05.5-.75.85-1.25 1.1-.3.15-.35.35-.25.6.35.9 1.5 1.55 2.5 1.7.3.05.35.35.1.6-.35.35-1.1.55-1.6.65-.15.35-.1.65-.35.85-.35.25-1.35.05-2.15.35-.7.25-1.15 1.35-2.25 1.35s-1.55-1.1-2.25-1.35c-.8-.3-1.8-.1-2.15-.35-.25-.2-.2-.5-.35-.85-.5-.1-1.25-.3-1.6-.65-.25-.25-.2-.55.1-.6 1-.15 2.15-.8 2.5-1.7.1-.25.05-.45-.25-.6-.5-.25-1.2-.6-1.25-1.1-.05-.5.45-.7.8-.5.45.25.85.15.95.1.1-.45.05-1.15 0-2.05-.1-2.1 1.3-3.85 3.5-3.85Z"/></svg>'
};

function platformIconHtml(slug) {
  return PLATFORM_ICON_SVGS[slug] || "";
}

function platformBadgeHtml(slug, size = "sm") {
  const p = PLATFORM_BY_SLUG[slug];
  if (!p) return "";
  return `<span class="platform-badge platform-badge--${size}" style="background:${p.color}" title="${escapeHtml(p.name)}">${platformIconHtml(slug)}</span>`;
}

function tagBadgeHtml(name) {
  return `<span class="tag-badge">${ICONS.tag}${escapeHtml(name)}</span>`;
}

function renderCampaignPreviewIcons() {
  campaignPreviewIcons.innerHTML = committedPlatforms.map(slug => platformBadgeHtml(slug)).join("");
}

function renderCampaignTagsDisplay() {
  if (!committedTags.length) {
    campaignTagsDisplay.hidden = true;
    campaignTagsDisplay.innerHTML = "";
    return;
  }
  campaignTagsDisplay.hidden = false;
  campaignTagsDisplay.innerHTML = committedTags.map(t => tagBadgeHtml(t)).join("");
}

function renderPlatformGrid() {
  platformGrid.innerHTML = SOCIAL_PLATFORMS.map(p => `
    <button type="button" class="platform-tile ${tempPlatforms.includes(p.slug) ? "selected" : ""}" data-slug="${p.slug}" aria-pressed="${tempPlatforms.includes(p.slug)}">
      <span class="platform-tile-icon" style="background:${p.color}">${platformIconHtml(p.slug)}</span>
      <span class="platform-tile-name">${escapeHtml(p.name)}</span>
    </button>
  `).join("");

  platformGrid.querySelectorAll(".platform-tile").forEach(tile => {
    tile.addEventListener("click", () => {
      const slug = tile.dataset.slug;
      if (tempPlatforms.includes(slug)) {
        tempPlatforms = tempPlatforms.filter(s => s !== slug);
      } else {
        tempPlatforms.push(slug);
      }
      renderPlatformGrid();
    });
  });
}

function renderTagChips() {
  tagChipList.innerHTML = tempTags.map(name => `
    <span class="tag-chip">${ICONS.tag}${escapeHtml(name)}<button type="button" class="tag-chip-remove" data-tag="${escapeHtml(name)}" aria-label="Remove tag ${escapeHtml(name)}">&times;</button></span>
  `).join("");

  tagChipList.querySelectorAll(".tag-chip-remove").forEach(btn => {
    btn.addEventListener("click", () => {
      tempTags = tempTags.filter(t => t !== btn.dataset.tag);
      renderTagChips();
    });
  });
}

function addTempTag(rawName) {
  const name = rawName.trim();
  if (!name) return;
  const exists = tempTags.some(t => t.toLowerCase() === name.toLowerCase());
  if (!exists) tempTags.push(name);
  tagInput.value = "";
  tagSuggestions.hidden = true;
  renderTagChips();
}

function renderTagSuggestions() {
  const term = tagInput.value.trim().toLowerCase();
  const pool = Array.from(new Set([...knownTagNames, ...DEFAULT_TAG_SUGGESTIONS]));
  const matches = pool.filter(name =>
    !tempTags.some(t => t.toLowerCase() === name.toLowerCase()) &&
    (term === "" || name.toLowerCase().includes(term))
  ).slice(0, 8);

  if (!matches.length) {
    tagSuggestions.hidden = true;
    tagSuggestions.innerHTML = "";
    return;
  }

  tagSuggestions.hidden = false;
  tagSuggestions.innerHTML = matches.map(name => `<button type="button" data-tag="${escapeHtml(name)}">${ICONS.tag}${escapeHtml(name)}</button>`).join("");
  tagSuggestions.querySelectorAll("button[data-tag]").forEach(btn => {
    btn.addEventListener("click", () => addTempTag(btn.dataset.tag));
  });
}

function openCampaignSetup() {
  campaignSetupOpen = true;
  tempPlatforms = committedPlatforms.slice();
  tempTags = committedTags.slice();

  previewPlaceholder.hidden = true;
  previewCreated.hidden = true;
  campaignSetupPanel.hidden = false;
  campaignSetupArrow.setAttribute("aria-expanded", "true");
  createPanel.classList.add("setup-locked");

  renderPlatformGrid();
  renderTagChips();
  tagSuggestions.hidden = true;
}

function closeCampaignSetup(applyChanges) {
  if (applyChanges) {
    committedPlatforms = tempPlatforms.slice();
    committedTags = tempTags.slice();
    renderCampaignPreviewIcons();
    renderCampaignTagsDisplay();
  }

  campaignSetupOpen = false;
  campaignSetupPanel.hidden = true;
  campaignSetupArrow.setAttribute("aria-expanded", "false");
  createPanel.classList.remove("setup-locked");

  // Restore whichever preview state was showing before setup opened.
  if (previewCreated.dataset.hasContent === "true") {
    previewCreated.hidden = false;
  } else {
    previewPlaceholder.hidden = false;
  }
}

function resetCampaignState() {
  committedPlatforms = [];
  committedTags = [];
  tempPlatforms = [];
  tempTags = [];
  campaignInput.value = "";
  campaignError.hidden = true;
  renderCampaignPreviewIcons();
  renderCampaignTagsDisplay();
}

function guardLockedField(el) {
  if (!campaignSetupOpen) return false;
  el.blur();
  showToast("Please complete or cancel Campaign Setup first.");
  return true;
}

async function loadSocialPlatforms() {
  const { data, error } = await supabaseClient.from("social_platforms").select("*");
  if (error) {
    console.warn("Social platforms table not available yet:", error.message);
    return;
  }
  PLATFORM_ID_BY_SLUG = {};
  (data || []).forEach(p => { PLATFORM_ID_BY_SLUG[p.slug] = p.id; });
}

async function loadKnownTags() {
  const { data, error } = await supabaseClient.from("tags").select("name");
  if (error) {
    console.warn("Tags table not available yet:", error.message);
    return;
  }
  const dbNames = (data || []).map(t => t.name);
  knownTagNames = Array.from(new Set([...DEFAULT_TAG_SUGGESTIONS, ...dbNames]));
}

// Loads which platforms/tags belong to which link, so every listing page
// (dashboard, All Tracking Links, All User Listings) can show them.
async function loadCampaignJoins() {
  const { data: lp, error: lpErr } = await supabaseClient
    .from("link_platforms")
    .select("link_code, social_platforms(slug, name)");
  if (!lpErr && lp) {
    const map = {};
    lp.forEach(row => {
      if (!row.social_platforms) return;
      (map[row.link_code] ||= []).push(row.social_platforms);
    });
    linkPlatformsByCode = map;
  } else if (lpErr) {
    console.warn("link_platforms table not available yet:", lpErr.message);
  }

  const { data: lt, error: ltErr } = await supabaseClient
    .from("link_tags")
    .select("link_code, tags(name)");
  if (!ltErr && lt) {
    const map = {};
    lt.forEach(row => {
      if (!row.tags) return;
      (map[row.link_code] ||= []).push(row.tags.name);
    });
    linkTagsByCode = map;
  } else if (ltErr) {
    console.warn("link_tags table not available yet:", ltErr.message);
  }

  renderAll();
}

async function ensureTagIds(tagNames) {
  const ids = [];
  for (const name of tagNames) {
    try {
      const { data: existing } = await supabaseClient
        .from("tags").select("id").ilike("name", name).maybeSingle();
      if (existing) { ids.push(existing.id); continue; }

      const slug = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const { data: created, error } = await supabaseClient
        .from("tags").insert([{ name, slug }]).select().single();
      if (error) { console.error("Tag creation failed:", error); continue; }
      ids.push(created.id);
    } catch (err) {
      console.error("Tag lookup/creation failed:", err);
    }
  }
  return ids;
}

// Persists the platform + tag selections for a just-created link. Fails
// gracefully (matching loadClicks' pattern) if the campaign tables haven't
// been created yet — see campaign_migration.sql.
async function saveCampaignRelations(code, platformSlugs, tagNames) {
  try {
    if (platformSlugs.length) {
      const platformIds = platformSlugs.map(s => PLATFORM_ID_BY_SLUG[s]).filter(Boolean);
      if (platformIds.length) {
        const { error } = await supabaseClient
          .from("link_platforms")
          .insert(platformIds.map(pid => ({ link_code: code, platform_id: pid })));
        if (error) console.error("Saving link platforms failed:", error);
      }
    }
    if (tagNames.length) {
      const tagIds = await ensureTagIds(tagNames);
      if (tagIds.length) {
        const { error } = await supabaseClient
          .from("link_tags")
          .insert(tagIds.map(tid => ({ link_code: code, tag_id: tid })));
        if (error) console.error("Saving link tags failed:", error);
      }
    }
  } catch (err) {
    console.error("Failed to save campaign relations:", err);
  }

  // Update local lookup maps immediately so the new link's icons/tags show
  // up right away, without waiting on a full re-fetch.
  if (platformSlugs.length) {
    linkPlatformsByCode[code] = platformSlugs.map(s => PLATFORM_BY_SLUG[s]).filter(Boolean);
  }
  if (tagNames.length) {
    linkTagsByCode[code] = tagNames.slice();
    knownTagNames = Array.from(new Set([...knownTagNames, ...tagNames]));
  }
}

function flagImg(countryCode, fallbackSeed) {
  const code = (countryCode || flagForCode(fallbackSeed) || "us").toLowerCase();
  return `https://flagcdn.com/w80/${code}.png`;
}

// Builds one visitor card (used inside an expanded link row and in the
// "All User Listings" panel).
function visitorKey(click) {
  return `${click.visitor_id}__${click.created_at}`;
}

// "New" vs "Returning" is derived from real click history (any earlier
// recorded click from the same visitor_id) rather than a fabricated field.
function visitorStatus(click) {
  const hasEarlierVisit = clicksLog.some(c =>
    c.visitor_id === click.visitor_id &&
    c.id !== click.id &&
    new Date(c.created_at).getTime() < new Date(click.created_at).getTime()
  );
  return hasEarlierVisit ? "Returning" : "New";
}

// Number of clicks this visitor has recorded on THIS link (click.link_code),
// derived from actual click history rather than a fabricated counter —
// mirrors how visitorStatus() derives New/Returning.
//
// This used to sum the visitor's clicks across every link they've ever
// opened, not just this one. A visitor card is always shown in the context
// of one specific link (the "Recent Visitors" panel under a link, or a
// single click event on the Users page tagged "via <code>"), so a global,
// cross-link total here could run higher than that link's own Total Clicks
// stat — exactly the "12 clicks on a card but 4 Total Clicks for the link"
// mismatch. Scoping to click.link_code keeps every card's number consistent
// with the link it's actually being shown under.
function visitorClickCount(click) {
  return clicksLog.reduce(
    (n, c) => n + (c.visitor_id === click.visitor_id && c.link_code === click.link_code ? 1 : 0),
    0
  );
}

// Collapses a list of click events down to one entry per unique visitor —
// the visitor's most recent click (within the given list) is kept as the
// representative row, so location/device/etc. reflect their latest visit
// while visitorClickCount() still reports their true total across every
// click on record. This is what lets a visitor who has clicked 5 times
// show up as a single card in the Users listing instead of 5 duplicate
// cards, while still surfacing their real click count.
function dedupeByVisitor(list) {
  const latestByVisitor = new Map();
  for (const c of list) {
    const existing = latestByVisitor.get(c.visitor_id);
    if (!existing || new Date(c.created_at) > new Date(existing.created_at)) {
      latestByVisitor.set(c.visitor_id, c);
    }
  }
  return Array.from(latestByVisitor.values());
}

function buildVisitorCard(click, opts = {}) {
  const flag = flagImg(click.country_code, click.visitor_id);
  const place = [click.city, click.country].filter(Boolean).join(", ") || "Unknown location";
  const clickCount = visitorClickCount(click);
  // navigate mode (dashboard preview): "Details" jumps to the Users page and
  // opens this exact visit there, rather than expanding inline.
  const toggleLabel = opts.navigate
    ? `Details ${ICONS.arrow}`
    : `Details ${ICONS.chevron}`;
  const toggleClass = opts.navigate ? "visitor-details-toggle visitor-details-toggle--nav" : "visitor-details-toggle";

  return `
    <div class="visitor-card" data-visitor-key="${escapeHtml(visitorKey(click))}" data-visitor-id="${escapeHtml(click.visitor_id)}" data-link-code="${escapeHtml(click.link_code)}">
      <div class="visitor-card-top">
        <span class="visitor-flag" style="background-image:url('${flag}')" title="${escapeHtml(click.country || "Unknown")}"></span>
        <div class="visitor-place">
          <span class="visitor-place-main">${escapeHtml(place)}</span>
          ${opts.showCode ? (() => {
            const ownerLink = links.find(l => l.code === click.link_code);
            const campaignBit = ownerLink && ownerLink.campaign_name ? ` — ${escapeHtml(ownerLink.campaign_name)}` : "";
            return `<span class="visitor-linkcode">via ${escapeHtml(click.link_code)}${campaignBit}</span>`;
          })() : ""}
        </div>
        <div class="visitor-card-actions">
          <span class="visitor-click-count" title="Total clicks by this visitor">${ICONS.click}${clickCount.toLocaleString()} ${clickCount === 1 ? "click" : "clicks"}</span>
          <button class="${toggleClass}" type="button">${toggleLabel}</button>
        </div>
      </div>
      <div class="visitor-detail-grid" hidden>
        <div class="vfield">${glassIcon("Country", "glow-teal", ICONS.country)}<div><label>Country</label><span>${escapeHtml(click.country || "Unknown")}</span></div></div>
        <div class="vfield">${glassIcon("City", "glow-teal", ICONS.country)}<div><label>City</label><span>${escapeHtml(click.city || "Unknown")}</span></div></div>
        <div class="vfield">${glassIcon("Device", "glow-purple", ICONS.device)}<div><label>Device</label><span>${escapeHtml(click.device || "Unknown")}</span></div></div>
        <div class="vfield">${glassIcon("Browser", "glow-amber", ICONS.browser)}<div><label>Browser</label><span>${escapeHtml(click.browser || "Unknown")}</span></div></div>
        <div class="vfield">${glassIcon("OS", "glow-purple", ICONS.os)}<div><label>OS</label><span>${escapeHtml(click.os || "Unknown")}</span></div></div>
        <div class="vfield">${glassIcon("IP", "glow-purple", ICONS.ip)}<div><label>IP</label><span class="mono lt-tooltip" data-tooltip="${click.ip_hash ? escapeHtml(click.ip_hash) : "Unknown"}" title="${click.ip_hash ? escapeHtml(click.ip_hash) : "Unknown"}">${click.ip_hash ? escapeHtml(click.ip_hash.slice(0, 8)) + "…" : "Unknown"}</span></div></div>
        <div class="vfield">${glassIcon("Click Time", "glow-teal", ICONS.clock)}<div><label>Click Time</label>${(() => {
          const { date, time } = formatDateParts(click.created_at);
          return `<span class="vfield-date">${escapeHtml(date)}</span>${time ? `<span class="vfield-time">${escapeHtml(time)}</span>` : ""}`;
        })()}</div></div>
        <div class="vfield">${glassIcon("Visitor ID", "glow-amber", ICONS.user)}<div><label>Visitor ID</label><span class="mono lt-tooltip" data-tooltip="${escapeHtml(click.visitor_id || "Unknown")}" title="${escapeHtml(click.visitor_id || "Unknown")}">${click.visitor_id ? escapeHtml(click.visitor_id.slice(0, 8)) + "…" : "Unknown"}</span></div></div>
        <div class="vfield">${glassIcon("Total Clicks", "glow-teal", ICONS.click)}<div><label>Total Clicks</label><span>${clickCount.toLocaleString()}</span></div></div>
        ${(() => {
          const status = visitorStatus(click);
          const statusClass = status === "Returning" ? "status-returning" : "status-new";
          const glow = status === "Returning" ? "glow-purple" : "glow-teal";
          return `<div class="vfield">${glassIcon("Status", glow, ICONS.status)}<div><label>Status</label><span class="status-badge ${statusClass}">${status}</span></div></div>`;
        })()}
      </div>
    </div>
  `;
}

// Used on the Users page, where "Details" expands the card in place.
function wireVisitorCardToggles(root) {
  root.querySelectorAll(".visitor-details-toggle").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const card = btn.closest(".visitor-card");
      const grid = card.querySelector(".visitor-detail-grid");
      const willOpen = grid.hidden;
      grid.hidden = !willOpen;
      card.classList.toggle("open", willOpen);
      btn.classList.toggle("open", willOpen);
    });
  });
}

// Used on the dashboard's recent-visitors preview, where "Details" jumps to
// the Users page (filtered to this link) and opens that exact visit there,
// instead of expanding in place.
function wireVisitorCardNavigation(root) {
  root.querySelectorAll(".visitor-card").forEach(card => {
    const btn = card.querySelector(".visitor-details-toggle--nav");
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const [visitorId, createdAt] = card.dataset.visitorKey.split("__");
      openUsersView(card.dataset.linkCode, { linkCode: card.dataset.linkCode, visitorId, createdAt });
    });
  });
}

// A "link item" wraps the compact summary row plus its (optional, on-demand)
// expanded visitor panel — this two-part structure is what keeps the layout
// from ever overlapping at narrow viewport widths, since the detail content
// only ever appears full-width, below the summary line.
function buildLinkItem(link, context = "dashboard") {
  const wrap = document.createElement("div");
  wrap.className = "link-item";

  const row = buildLinkRow(link, context);
  wrap.appendChild(row);

  // The All Tracking Links page keeps rows compact (no inline expand) — use
  // the eye icon on the row instead to jump straight to the Users page.
  if (context === "all") {
    return wrap;
  }

  // clicksForCode() returns every raw click event on this link - a visitor
  // who clicked 3 times shows up as 3 entries there. dedupeByVisitor()
  // collapses that to one entry per unique visitor (their most recent
  // click), which is what "Recent visitors" and "View all N visitors"
  // should both be counting - otherwise the same person's repeat clicks
  // each got their own card here ("doubling"), and the "View all N" count
  // didn't match the Visitors stat shown above it.
  const linkVisitors = dedupeByVisitor(clicksForCode(link.code));
  const recentClicks = linkVisitors.slice(0, 3);
  const detail = document.createElement("div");
  detail.className = "row-detail";
  detail.hidden = !expandedRows.has(link.code);

  if (recentClicks.length === 0) {
    detail.innerHTML = `<div class="row-detail-empty">No visitor activity recorded yet for this link.</div>`;
  } else {
    detail.innerHTML = `
      <div class="row-detail-head">Recent visitors</div>
      <div class="visitor-cards">${recentClicks.map(c => buildVisitorCard(c, { navigate: true })).join("")}</div>
      ${linkVisitors.length > 3 ? `<button class="link-viewall" data-code="${escapeHtml(link.code)}">View all ${linkVisitors.length} visitors →</button>` : ""}
    `;
    wireVisitorCardNavigation(detail);
    const viewAll = detail.querySelector(".link-viewall");
    if (viewAll) {
      viewAll.addEventListener("click", () => openUsersView(link.code));
    }
  }

  wrap.appendChild(detail);
  return wrap;
}

// Truncates display text to `max` characters, appending an ellipsis when
// cut. Callers still put the untouched string in a `title` attribute so
// hovering reveals the full value — this just keeps card layouts from
// wrapping or stretching to fit long URLs/tags/names.
function truncateText(str, max) {
  const s = String(str || "");
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

// Shared rule for the compact click/visitor stat displays (List View's
// .row-clicks and Grid View's .grid-stat): a short value — 0 up through any
// 2-digit number (0-99) — reads better centered under its label than
// hugging the left/right edge, while 3+ digit numbers keep their normal
// alignment. Centralized here so both views can never drift out of sync on
// the threshold.
function isShortStat(n) {
  return String(n ?? 0).length <= 2;
}

function buildLinkRow(link, context = "dashboard") {
  const row = document.createElement("div");
  row.className = "link-row";

  const clickCount = link.clicks || 0;
  const clicksAlignClass = isShortStat(clickCount) ? " clicks-center" : "";
  const linkClicks = clicksForCode(link.code);
  const visitorCount = dedupeByVisitor(linkClicks).length;
  const latest = linkClicks[0];
  const flag = latest ? (latest.country_code || flagForCode(link.code)) : flagForCode(link.code);
  const isOpen = expandedRows.has(link.code);
  const fullUrl = link.original || "";
  const createdIso = latest ? latest.created_at : link.created;
  const createdShort = (() => {
    const d = new Date(link.created);
    return isNaN(d) ? "—" : d.toLocaleDateString([], { month: "short", day: "2-digit" });
  })();

  // Dashboard rows keep the inline expand chevron (recent-visitors preview).
  // The All Tracking Links page instead shows a hover-revealed eye icon that
  // jumps straight to the Users page, filtered to this link — there's no
  // inline expand panel on that page. In grid/card mode both are replaced by
  // the visible "Analytics" action button, which does the same navigation.
  const actionBtnHtml = context === "all"
    ? `<button class="row-eye-btn" aria-label="View visitors for this link" title="View visitors for ${escapeHtml(link.code)}">${ICONS.eye}</button>`
    : `<button class="row-expand-btn ${isOpen ? "open" : ""}" aria-label="Show visitor details" title="Show visitor details">${ICONS.chevron}</button>`;

  const rowPlatforms = linkPlatformsByCode[link.code] || [];
  const rowTags = linkTagsByCode[link.code] || [];
  const hasCampaignIcon = rowPlatforms.length > 0;

  // Profile header icon: a selected campaign platform takes visual priority
  // over the decorative/geo country flag — only one badge occupies this
  // slot at a time so the header never shows conflicting identity cues.
  const primaryPlatform = hasCampaignIcon ? PLATFORM_BY_SLUG[rowPlatforms[0].slug] : null;
  const iconHtml = (hasCampaignIcon && primaryPlatform)
    ? `<div class="row-icon row-icon--platform" style="background:${primaryPlatform.color}" title="${escapeHtml(primaryPlatform.name)}">${platformIconHtml(primaryPlatform.slug)}</div>`
    : `<div class="row-icon row-icon--flag" style="background-image:url('${flagImg(flag, link.code)}')" title="${escapeHtml(flag).toUpperCase()}"></div>`;

  // Short (trackable) link — this is what actually gets copied/shared, as
  // opposed to row-url below which is the long destination it redirects to.
  const shortUrl = `${BASE_URL}/api/redirect?id=${link.code}`;
  const profileName = link.code ? String(link.code) : "—";

  // Only render tag chips when tags actually exist — no placeholder mark
  // for links without a tag, so the meta row just shows nothing there
  // instead of an empty shaded "—" badge.
  const tagsHtml = rowTags.length
    ? rowTags.slice(0, 3).map(t => {
        const full = String(t);
        const short = truncateText(full, 5);
        return `<span class="tag-badge" title="${escapeHtml(full)}">${ICONS.tag}${escapeHtml(short)}</span>`;
      }).join("")
    : "";

  row.innerHTML = `
    <div class="row-top">
      ${iconHtml}
      <div class="row-heading">
        ${link.campaign_name ? `
          <div class="row-campaign">
            ${rowPlatforms.length ? `<span class="row-platform-icons">${rowPlatforms.map(p => platformBadgeHtml(p.slug, "xs")).join("")}</span>` : ""}
            <span class="row-campaign-name" title="${escapeHtml(link.campaign_name)}">${escapeHtml(truncateText(link.campaign_name, 20))}</span>
          </div>` : ""}
        <div class="row-code" title="${escapeHtml(link.code)}">${escapeHtml(link.code)}</div>
      </div>
      <div class="row-profile">
        <div class="row-profile-name" title="${escapeHtml(profileName)}">${escapeHtml(profileName)}</div>
        <div class="row-profile-url-line">
          <span class="row-profile-url" title="${escapeHtml(shortUrl)}">${escapeHtml(truncateText(shortUrl, 18))}</span>
          <button class="row-profile-copy" data-action="copy-profile" aria-label="Copy short link" title="Copy short link">${ICONS.copy}</button>
        </div>
      </div>
      <div class="row-toggle">${actionBtnHtml}</div>
      <div class="row-menu">
        <button class="kebab-btn" aria-label="More actions" title="More actions">&#8942;</button>
        <div class="kebab-menu" hidden>
          <button data-action="copy">Copy Link</button>
          <button data-action="visit">Visit Link</button>
          <button data-action="delete">Delete</button>
        </div>
      </div>
    </div>
    <div class="row-main">
      <div class="row-url" title="${escapeHtml(fullUrl)}">${escapeHtml(truncateText(fullUrl, 18) || "—")}</div>
      <div class="row-meta">
        <div class="row-meta-left">
          <span class="badge-active"><i></i>Active</span>
          <span class="row-date">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            ${formatDate(createdIso)}
          </span>
        </div>
        <div class="row-meta-right">
          ${tagsHtml}
          <button type="button" class="row-visitor-btn" data-action="toggle-visitors" aria-expanded="false" aria-label="Show visitor count" title="Show visitor count">
            ${ICONS.user}
            <span class="row-visitor-count" hidden>${visitorCount.toLocaleString()} visitor${visitorCount === 1 ? "" : "s"}</span>
          </button>
        </div>
      </div>
      <div class="row-stats-mini">
        <div class="stat-mini"><span class="stat-mini-num">${clickCount.toLocaleString()}</span><span class="stat-mini-label">Clicks</span></div>
        <div class="stat-mini"><span class="stat-mini-num">${visitorCount.toLocaleString()}</span><span class="stat-mini-label">Visitors</span></div>
        <div class="stat-mini"><span class="stat-mini-num">${createdShort}</span><span class="stat-mini-label">Created</span></div>
      </div>
      <div class="row-actions">
        <button class="row-action-btn" data-action="copy" title="Copy Link">${ICONS.copy}<span>Copy</span></button>
        <button class="row-action-btn" data-action="visit" title="Visit Link">${ICONS.external}<span>Visit</span></button>
        <button class="row-action-btn" data-action="analytics" title="View Analytics">${ICONS.chart}<span>Analytics</span></button>
      </div>
    </div>
    <div class="row-clicks${clicksAlignClass}">
      <span class="clicks-num">${clickCount.toLocaleString()}</span>
      <span class="clicks-label">CLICKS</span>
    </div>
  `;

  const codeEl = row.querySelector(".row-code");
  codeEl.addEventListener("click", () => openLink(link.code));

  // "Analytics" (visible in card/grid mode) always jumps to the Users page
  // filtered to this link — the same real navigation the eye button already
  // performs on the All Tracking Links page.
  const goToAnalytics = (e) => {
    e.stopPropagation();
    openUsersView(link.code);
  };

  if (context === "all") {
    const eyeBtn = row.querySelector(".row-eye-btn");
    eyeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openUsersView(link.code);
    });
  } else {
    const expandBtn = row.querySelector(".row-expand-btn");
    expandBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const wrap = row.parentElement;
      const detail = wrap.querySelector(".row-detail");
      const willOpen = detail.hidden;
      detail.hidden = !willOpen;
      expandBtn.classList.toggle("open", willOpen);
      if (willOpen) expandedRows.add(link.code); else expandedRows.delete(link.code);
    });
  }

  const visitorBtn = row.querySelector(".row-visitor-btn");
  if (visitorBtn) {
    visitorBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const countEl = visitorBtn.querySelector(".row-visitor-count");
      const willShow = countEl.hidden;
      countEl.hidden = !willShow;
      visitorBtn.classList.toggle("open", willShow);
      visitorBtn.setAttribute("aria-expanded", String(willShow));
    });
  }

  row.querySelector('.row-action-btn[data-action="copy"]').addEventListener("click", (e) => {
    e.stopPropagation();
    copyLinkToClipboard(link.code);
  });
  row.querySelector('.row-profile-copy').addEventListener("click", (e) => {
    e.stopPropagation();
    copyLinkToClipboard(link.code);
  });
  row.querySelector('.row-action-btn[data-action="visit"]').addEventListener("click", (e) => {
    e.stopPropagation();
    openLink(link.code);
  });
  row.querySelector('.row-action-btn[data-action="analytics"]').addEventListener("click", goToAnalytics);

  const kebabBtn = row.querySelector(".kebab-btn");
  const kebabMenu = row.querySelector(".kebab-menu");
  kebabBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasHidden = kebabMenu.hidden;
    closeAllKebabMenus();
    sortMenu.hidden = true;
    kebabMenu.hidden = !wasHidden;
    row.classList.toggle("kebab-open", !wasHidden);
  });
  kebabMenu.addEventListener("click", (e) => e.stopPropagation());

  kebabMenu.querySelector('[data-action="copy"]').addEventListener("click", () => {
    copyLinkToClipboard(link.code);
    kebabMenu.hidden = true;
    row.classList.remove("kebab-open");
  });
  kebabMenu.querySelector('[data-action="visit"]').addEventListener("click", () => {
    openLink(link.code);
    kebabMenu.hidden = true;
    row.classList.remove("kebab-open");
  });
  kebabMenu.querySelector('[data-action="delete"]').addEventListener("click", () => {
    kebabMenu.hidden = true;
    row.classList.remove("kebab-open");
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
// 6a1. TRACKING HISTORY — dedicated table-style row
// ==========================================
// Kept fully separate from buildLinkRow/buildLinkItem (used by the All
// Tracking Links page) so this redesign can never affect that page's
// markup, styling, or behaviour — only the dashboard's Tracking History
// panel uses these.

// Resolves a 2-letter country code to a display name using the browser's
// built-in locale data — avoids shipping/maintaining a manual country list.
function countryDisplayName(code) {
  const upper = String(code || "").toUpperCase();
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(upper) || upper;
  } catch {
    return upper;
  }
}

// Buckets a link's real click timestamps into "clicks per day" for the
// last `days` days (oldest first) — used for both the sparkline and the
// trend percentage, so both stay backed by actual click history rather
// than invented numbers.
function dailyClickBuckets(clicks, days = 7) {
  const buckets = new Array(days).fill(0);
  const now = Date.now();
  clicks.forEach(c => {
    const t = new Date(c.created_at).getTime();
    if (isNaN(t)) return;
    const dayIndex = days - 1 - Math.floor((now - t) / 86400000);
    if (dayIndex >= 0 && dayIndex < days) buckets[dayIndex]++;
  });
  return buckets;
}

// Recent-vs-prior half of the bucketed window — a genuine trend derived
// from real click timestamps (not a fabricated growth figure).
function trendGrowthPercent(buckets) {
  const mid = Math.ceil(buckets.length / 2);
  const prior = buckets.slice(0, mid).reduce((a, b) => a + b, 0);
  const recent = buckets.slice(mid).reduce((a, b) => a + b, 0);
  if (prior === 0) return recent > 0 ? 100 : 0;
  return Math.round(((recent - prior) / prior) * 100);
}

function sparklineSvg(buckets) {
  const max = Math.max(1, ...buckets);
  const w = 60, h = 22;
  const step = buckets.length > 1 ? w / (buckets.length - 1) : 0;
  const pts = buckets.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`).join(" ");
  return `<svg class="trend-spark" viewBox="0 0 ${w} ${h}" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="${pts}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function buildHistoryRow(link) {
  const row = document.createElement("div");
  row.className = "history-row";

  const clickCount = link.clicks || 0;
  const linkClicks = clicksForCode(link.code);
  const visitorCount = dedupeByVisitor(linkClicks).length;
  const latest = linkClicks[0];
  const flag = latest ? (latest.country_code || flagForCode(link.code)) : flagForCode(link.code);
  const createdIso = latest ? latest.created_at : link.created;
  const isOpen = expandedRows.has(link.code);

  const rowPlatforms = linkPlatformsByCode[link.code] || [];
  const rowTags = linkTagsByCode[link.code] || [];
  const primaryPlatform = rowPlatforms.length ? PLATFORM_BY_SLUG[rowPlatforms[0].slug] : null;
  const categoryLabel = primaryPlatform ? primaryPlatform.name : (rowTags[0] || "General");
  const categoryIcon = primaryPlatform
    ? `<span class="h-category-dot" style="background:${primaryPlatform.color}">${platformIconHtml(primaryPlatform.slug)}</span>`
    : ICONS.tag;

  const iconHtml = primaryPlatform
    ? `<div class="row-icon row-icon--platform" style="background:${primaryPlatform.color}" title="${escapeHtml(primaryPlatform.name)}">${platformIconHtml(primaryPlatform.slug)}</div>`
    : `<div class="row-icon row-icon--flag" style="background-image:url('${flagImg(flag, link.code)}')" title="${escapeHtml(flag).toUpperCase()}"></div>`;

  const buckets = dailyClickBuckets(linkClicks, 7);
  const growth = trendGrowthPercent(buckets);
  const growthClass = growth > 0 ? "up" : growth < 0 ? "down" : "flat";
  const growthLabel = `${growth > 0 ? "+" : ""}${growth}%`;

  const ctrPct = clickCount > 0 ? Math.min(100, Math.round((visitorCount / clickCount) * 100)) : 0;

  const shortUrl = `${BASE_URL}/api/redirect?id=${link.code}`;
  const created = formatDate(createdIso);
  const [createdDate, createdTime] = created.split(" · ");
  const countryName = countryDisplayName(flag);

  // Title prefers the campaign name; when there isn't one, fall back to the
  // destination domain rather than repeating the @handle shown just below.
  const destHost = (() => {
    try { return new URL(link.original).hostname.replace(/^www\./, ""); }
    catch { return "Tracked Link"; }
  })();
  const titleText = link.campaign_name || destHost;

  row.innerHTML = `
    <div class="h-details">
      ${iconHtml}
      <div class="h-details-text">
        <div class="h-details-top">
          <span class="h-code" title="${escapeHtml(link.campaign_name || link.code)}">${escapeHtml(titleText)}</span>
          ${link.campaign_name ? `<span class="h-badge-featured">Featured</span>` : ""}
        </div>
        <div class="h-details-sub">
          <span class="h-handle" title="${escapeHtml(shortUrl)}">@${escapeHtml(link.code)}</span>
          <span class="badge-active"><i></i>Active</span>
        </div>
      </div>
    </div>
    <div class="h-visitors">
      <span class="h-visitors-num">${visitorCount.toLocaleString()}</span>
      <span class="h-visitors-growth ${growthClass}">${ICONS.user}${growthLabel}</span>
    </div>
    <div class="h-created">
      <span class="h-created-date">${escapeHtml(createdDate || "—")}</span>
      <span class="h-created-time">${escapeHtml(createdTime || "")}</span>
    </div>
    <div class="h-location" title="${escapeHtml(countryName)}">
      <img class="h-flag" src="${flagImg(flag, link.code)}" alt="" width="18" height="13">
      <span class="h-location-name">${escapeHtml(countryName)}</span>
    </div>
    <div class="h-category">
      ${categoryIcon}
      <span class="h-category-name" title="${escapeHtml(categoryLabel)}">${escapeHtml(truncateText(categoryLabel, 10))}</span>
    </div>
    <div class="h-clicks">
      <span class="h-clicks-num">${clickCount.toLocaleString()}</span>
      <span class="h-clicks-label">Total Clicks</span>
    </div>
    <div class="h-ctr">
      <div class="ctr-ring" style="--pct:${ctrPct}">
        <span class="ctr-ring-value">${ctrPct}%</span>
      </div>
    </div>
    <div class="h-trend">
      ${sparklineSvg(buckets)}
      <span class="h-trend-growth ${growthClass}">${growthLabel}</span>
    </div>
    <div class="h-action">
      <button class="h-open-btn ${isOpen ? "open" : ""}" aria-label="Show visitor details" title="Show visitor details">${ICONS.arrow}</button>
      <div class="row-menu">
        <button class="kebab-btn" aria-label="More actions" title="More actions">&#8942;</button>
        <div class="kebab-menu" hidden>
          <button data-action="copy">Copy Link</button>
          <button data-action="visit">Visit Link</button>
          <button data-action="delete">Delete</button>
        </div>
      </div>
    </div>
  `;

  row.querySelector(".h-code").addEventListener("click", () => openLink(link.code));

  const openBtn = row.querySelector(".h-open-btn");
  openBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wrap = row.parentElement;
    const detail = wrap.querySelector(".row-detail");
    const willOpen = detail.hidden;
    detail.hidden = !willOpen;
    openBtn.classList.toggle("open", willOpen);
    if (willOpen) expandedRows.add(link.code); else expandedRows.delete(link.code);
  });

  const kebabBtn = row.querySelector(".kebab-btn");
  const kebabMenu = row.querySelector(".kebab-menu");
  kebabBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasHidden = kebabMenu.hidden;
    closeAllKebabMenus();
    sortMenu.hidden = true;
    kebabMenu.hidden = !wasHidden;
    row.classList.toggle("kebab-open", !wasHidden);
  });
  kebabMenu.addEventListener("click", (e) => e.stopPropagation());

  kebabMenu.querySelector('[data-action="copy"]').addEventListener("click", () => {
    copyLinkToClipboard(link.code);
    kebabMenu.hidden = true;
    row.classList.remove("kebab-open");
  });
  kebabMenu.querySelector('[data-action="visit"]').addEventListener("click", () => {
    openLink(link.code);
    kebabMenu.hidden = true;
    row.classList.remove("kebab-open");
  });
  kebabMenu.querySelector('[data-action="delete"]').addEventListener("click", () => {
    kebabMenu.hidden = true;
    row.classList.remove("kebab-open");
    deleteLink(link.code);
  });

  return row;
}

// Wrapper: table row + the same "Recent visitors" expand panel Tracking
// History already had — behaviour is unchanged, only the row's look is new.
function buildHistoryItem(link) {
  const wrap = document.createElement("div");
  wrap.className = "link-item";
  wrap.appendChild(buildHistoryRow(link));

  // clicksForCode() returns every raw click event on this link - a visitor
  // who clicked 3 times shows up as 3 entries there. dedupeByVisitor()
  // collapses that to one entry per unique visitor (their most recent
  // click), which is what "Recent visitors" and "View all N visitors"
  // should both be counting - otherwise the same person's repeat clicks
  // each got their own card here ("doubling"), and the "View all N" count
  // didn't match the Visitors stat shown above it.
  const linkVisitors = dedupeByVisitor(clicksForCode(link.code));
  const recentClicks = linkVisitors.slice(0, 3);
  const detail = document.createElement("div");
  detail.className = "row-detail";
  detail.hidden = !expandedRows.has(link.code);

  if (recentClicks.length === 0) {
    detail.innerHTML = `<div class="row-detail-empty">No visitor activity recorded yet for this link.</div>`;
  } else {
    detail.innerHTML = `
      <div class="row-detail-head">Recent visitors</div>
      <div class="visitor-cards">${recentClicks.map(c => buildVisitorCard(c, { navigate: true })).join("")}</div>
      ${linkVisitors.length > 3 ? `<button class="link-viewall" data-code="${escapeHtml(link.code)}">View all ${linkVisitors.length} visitors →</button>` : ""}
    `;
    wireVisitorCardNavigation(detail);
    const viewAll = detail.querySelector(".link-viewall");
    if (viewAll) {
      viewAll.addEventListener("click", () => openUsersView(link.code));
    }
  }

  wrap.appendChild(detail);
  return wrap;
}

// ==========================================
// 6a2. GRID VIEW — independent card builder
// ==========================================
// Grid View's cards are intentionally built from their own markup/classes
// (grid-card, grid-card-*) instead of reusing List View's .link-row —
// this keeps the two views fully independent, so refining one can never
// regress the other.

// Opens the destination URL directly — no click logging, no redirect hop.
// Distinct from openLink(), which is the tracked "Visit" action.
function openOriginalLink(originalUrl) {
  let destination = String(originalUrl || "").trim();
  if (!destination) return;
  if (!/^https?:\/\//i.test(destination)) destination = "https://" + destination;
  window.open(destination, "_blank");
}

// Friendly fallback label for the card header when a link has no campaign
// name — the destination's bare hostname reads far better than a raw
// short code, which Grid View never displays.
function hostnameLabel(url) {
  const raw = String(url || "").trim();
  if (!raw) return "Untitled Link";
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
    return new URL(withScheme).hostname.replace(/^www\./, "") || "Untitled Link";
  } catch {
    return "Untitled Link";
  }
}

function closeAllGridKebabMenus() {
  document.querySelectorAll(".grid-kebab-menu").forEach(m => m.hidden = true);
  document.querySelectorAll(".grid-card.kebab-open").forEach(el => el.classList.remove("kebab-open"));
}

function buildGridCard(link, context = "dashboard") {
  const card = document.createElement("div");
  card.className = "grid-card";

  const clickCount = link.clicks || 0;
  const linkClicks = clicksForCode(link.code);
  const visitorCount = dedupeByVisitor(linkClicks).length;
  const latest = linkClicks[0];
  const flag = latest ? (latest.country_code || flagForCode(link.code)) : flagForCode(link.code);
  const createdIso = latest ? latest.created_at : link.created;
  const createdShort = (() => {
    const d = new Date(link.created);
    return isNaN(d) ? "—" : d.toLocaleDateString([], { month: "short", day: "2-digit" });
  })();

  const cardPlatforms = linkPlatformsByCode[link.code] || [];
  const cardTags = linkTagsByCode[link.code] || [];
  const hasCampaignIcon = cardPlatforms.length > 0;
  const primaryPlatform = hasCampaignIcon ? PLATFORM_BY_SLUG[cardPlatforms[0].slug] : null;

  const iconHtml = (hasCampaignIcon && primaryPlatform)
    ? `<div class="grid-card-icon grid-card-icon--platform" style="background:${primaryPlatform.color}" title="${escapeHtml(primaryPlatform.name)}">${platformIconHtml(primaryPlatform.slug)}</div>`
    : `<div class="grid-card-icon grid-card-icon--flag" style="background-image:url('${flagImg(flag, link.code)}')" title="${escapeHtml(flag).toUpperCase()}"></div>`;

  // Short (trackable) link shown under the name — this is what Copy
  // actually copies, as opposed to the original destination.
  const shortUrl = `${BASE_URL}/api/redirect?id=${link.code}`;

  // Card header identity: campaign name when set, otherwise the
  // destination's hostname — never the raw short code.
  const displayName = link.campaign_name ? link.campaign_name : hostnameLabel(link.original);

  // Only one primary tag badge is ever shown on the card face — additional
  // tags collapse into a "+N" suffix on that same badge, with the full
  // list available via the title tooltip on hover.
  const tagsHtml = cardTags.length
    ? (() => {
        const primary = escapeHtml(truncateText(String(cardTags[0]), 12));
        const extra = cardTags.length - 1;
        const allTitle = escapeHtml(cardTags.join(", "));
        return `<span class="tag-badge grid-card-tag" title="${allTitle}">${ICONS.tag}${primary}${extra > 0 ? ` +${extra}` : ""}</span>`;
      })()
    : "";

  // Short (1-2 digit) counts look off-balance left-aligned in their stat
  // column — this mirrors the old List View "clicks-center" rule so a
  // small number like "3" or "42" sits centered under its label instead
  // of hugging the left edge. Longer numbers, and the Created date stat,
  // are unaffected and keep their normal left alignment.
  const clicksCenterClass = isShortStat(clickCount) ? " grid-stat--center" : "";
  const visitorsCenterClass = isShortStat(visitorCount) ? " grid-stat--center" : "";

  card.innerHTML = `
    <div class="grid-card-header">
      ${iconHtml}
      <div class="grid-card-heading">
        <div class="grid-card-name" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</div>
        <div class="grid-card-url-line">
          <span class="grid-card-url" title="${escapeHtml(shortUrl)}">${escapeHtml(truncateText(shortUrl, 15))}</span>
          <button class="grid-card-copy" data-action="copy-short" aria-label="Copy short link" title="Copy short link">${ICONS.copy}</button>
        </div>
      </div>
      <div class="grid-card-menu">
        <button class="grid-kebab-btn" aria-label="More actions" title="More actions">&#8942;</button>
        <div class="grid-kebab-menu" hidden>
          <button data-action="copy-short">Copy Short Link</button>
          <button data-action="open-og">Open Original Link (OG)</button>
          <button data-action="analytics">Analytics</button>
          <button data-action="delete">Delete</button>
        </div>
      </div>
    </div>
    <div class="grid-card-meta">
      <span class="badge-active"><i></i>Active</span>
      <span class="grid-card-date">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ${formatDate(createdIso)}
      </span>
    </div>
    <div class="grid-card-tag-row">${tagsHtml}</div>
    <div class="grid-card-stats">
      <div class="grid-stat${clicksCenterClass}"><span class="grid-stat-num">${clickCount.toLocaleString()}</span><span class="grid-stat-label">Clicks</span></div>
      <div class="grid-stat${visitorsCenterClass}"><span class="grid-stat-num">${visitorCount.toLocaleString()}</span><span class="grid-stat-label">Visitors</span></div>
      <div class="grid-stat"><span class="grid-stat-num">${createdShort}</span><span class="grid-stat-label">Created</span></div>
    </div>
    <div class="grid-card-actions">
      <button class="grid-action-btn" data-action="copy-short" title="Copy Short Link">${ICONS.copy}<span>Copy</span></button>
      <button class="grid-action-btn" data-action="visit" title="Visit Link">${ICONS.external}<span>Visit</span></button>
      <button class="grid-action-btn" data-action="analytics" title="View Analytics">${ICONS.chart}<span>Analytics</span></button>
    </div>
  `;

  card.querySelectorAll('[data-action="copy-short"]').forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      copyLinkToClipboard(link.code);
    });
  });

  card.querySelector('.grid-action-btn[data-action="visit"]').addEventListener("click", (e) => {
    e.stopPropagation();
    openLink(link.code);
  });

  const goToAnalytics = (e) => {
    e.stopPropagation();
    openUsersView(link.code);
  };
  card.querySelector('.grid-action-btn[data-action="analytics"]').addEventListener("click", goToAnalytics);

  const kebabBtn = card.querySelector(".grid-kebab-btn");
  const kebabMenu = card.querySelector(".grid-kebab-menu");
  kebabBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasHidden = kebabMenu.hidden;
    closeAllGridKebabMenus();
    closeAllFilterMenus();
    sortMenu.hidden = true;
    kebabMenu.hidden = !wasHidden;
    card.classList.toggle("kebab-open", !wasHidden);
  });
  kebabMenu.addEventListener("click", (e) => e.stopPropagation());

  kebabMenu.querySelector('[data-action="copy-short"]').addEventListener("click", () => {
    copyLinkToClipboard(link.code);
    kebabMenu.hidden = true;
    card.classList.remove("kebab-open");
  });
  kebabMenu.querySelector('[data-action="open-og"]').addEventListener("click", () => {
    openOriginalLink(link.original);
    kebabMenu.hidden = true;
    card.classList.remove("kebab-open");
  });
  kebabMenu.querySelector('[data-action="analytics"]').addEventListener("click", () => {
    kebabMenu.hidden = true;
    card.classList.remove("kebab-open");
    openUsersView(link.code);
  });
  kebabMenu.querySelector('[data-action="delete"]').addEventListener("click", () => {
    kebabMenu.hidden = true;
    card.classList.remove("kebab-open");
    deleteLink(link.code);
  });

  return card;
}

// ==========================================
// 6b. ALL USER LISTINGS (flattened visitor feed)
// ==========================================
function renderAllUsers() {
  let list = clicksLog.slice();

  if (usersTypeFilter !== "all") {
    list = list.filter(c => {
      const ownerLink = links.find(l => l.code === c.link_code);
      return ownerLink ? linkMatchesType(ownerLink, usersTypeFilter) : false;
    });
  }

  if (usersLinkFilterMode !== "all") {
    list = list.filter(c => c.link_code === usersLinkFilterMode);
  }

  if (usersSelectedTags.size) {
    list = list.filter(c => (linkTagsByCode[c.link_code] || []).some(t => usersSelectedTags.has(t)));
  }

  if (userSearchTerm) {
    list = list.filter(c =>
      (c.visitor_id || "").toLowerCase().includes(userSearchTerm) ||
      (c.country || "").toLowerCase().includes(userSearchTerm) ||
      (c.city || "").toLowerCase().includes(userSearchTerm) ||
      (c.link_code || "").toLowerCase().includes(userSearchTerm)
    );
  }

  // A visitor who clicked several times still only gets one row here — all
  // their clicks are counted (via visitorClickCount inside buildVisitorCard)
  // but they're noted once, not once per click.
  list = dedupeByVisitor(list);

  switch (userSortMode) {
    case "oldest":
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      break;
    case "country":
      list.sort((a, b) => (a.country || "").localeCompare(b.country || ""));
      break;
    case "newest":
    default:
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      break;
  }

  const anyFilterActive = !!userSearchTerm || usersTypeFilter !== "all" || usersLinkFilterMode !== "all" || usersSelectedTags.size > 0;
  const scopeLabel = usersLinkFilterMode === "all" ? "All Users" : `Users · ${usersLinkFilterMode}`;
  const scopeTotal = dedupeByVisitor(usersLinkFilterMode === "all" ? clicksLog : clicksForCode(usersLinkFilterMode)).length;
  usersFilterPill.textContent = anyFilterActive
    ? `${scopeLabel} · ${list.length.toLocaleString()} of ${scopeTotal.toLocaleString()}`
    : `${scopeLabel} · ${scopeTotal.toLocaleString()}`;

  if (list.length === 0) {
    allUsersBody.innerHTML = "";
    const emptyMsg = anyFilterActive
      ? "No visitors match your filters."
      : "No visitor activity recorded yet. Once someone opens one of your links, they'll show up here.";
    allUsersBody.innerHTML = `<div class="empty-state"><span class="icon">&#128100;</span><span>${emptyMsg}</span></div>`;
    document.getElementById("users-pagination").innerHTML = "";
    usersExportSnapshot = { rows: [], fullRows: [], offset: 0, filterLabel: usersFilterPill.textContent };
    return;
  }

  // If we're jumping here to highlight one specific visit, make sure the
  // page we render actually contains it (instead of always defaulting to
  // page 1 and the card never appearing).
  if (pendingVisitorHighlight) {
    const idx = list.findIndex(c => c.visitor_id === pendingVisitorHighlight.visitorId);
    if (idx !== -1) usersPage = Math.floor(idx / usersPageSize) + 1;
  }

  const { pageItems, safePage } = paginate(list, usersPage, usersPageSize);
  usersPage = safePage;

  // fullRows = the entire filtered/sorted list (every page) so "Export All"
  // can dump everything currently in view, not just this page. offset lets
  // per-page export continue the S.No instead of restarting at 1 each page.
  usersExportSnapshot = {
    rows: pageItems,
    fullRows: list,
    offset: (usersPage - 1) * usersPageSize,
    filterLabel: usersFilterPill.textContent
  };

  allUsersBody.innerHTML = pageItems.map(c => buildVisitorCard(c, { showCode: usersLinkFilterMode === "all" })).join("");
  wireVisitorCardToggles(allUsersBody);

  renderPagination(document.getElementById("users-pagination"), {
    page: usersPage,
    pageSize: usersPageSize,
    total: list.length,
    onPageChange: (p) => { usersPage = p; renderAllUsers(); document.getElementById("all-users-body").scrollIntoView({ behavior: "smooth", block: "start" }); },
    onPageSizeChange: (size) => { usersPageSize = size; usersPage = 1; renderAllUsers(); }
  });

  // If we arrived here via a dashboard "Details" click on one specific
  // visit, open that exact card and scroll it into view.
  if (pendingVisitorHighlight) {
    const target = allUsersBody.querySelector(`.visitor-card[data-visitor-id="${CSS.escape(pendingVisitorHighlight.visitorId)}"]`);
    if (target) {
      const grid = target.querySelector(".visitor-detail-grid");
      const btn = target.querySelector(".visitor-details-toggle");
      grid.hidden = false;
      target.classList.add("open");
      if (btn) btn.classList.add("open");
      target.classList.add("visitor-card--flash");
      setTimeout(() => target.classList.remove("visitor-card--flash"), 1800);
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    pendingVisitorHighlight = null;
  }
}

// ==========================================
// 6b. EXPORT (PDF / EXCEL) — All Tracking Links & All User Listings
// ==========================================
// Both exports work off the snapshot captured by the most recent render, so
// what gets exported always matches exactly what's on screen — i.e. the
// current page of results after any active search/filters/sort, not the
// full unfiltered dataset.

// A link's "Category" for exports mirrors the same platform/tag fallback
// already used for the on-screen category badge (see buildHistoryRow): the
// platform tied to the link's campaign when it has one, else its first tag,
// else "General" when neither is set.
function categoryForLink(code) {
  const rowPlatforms = linkPlatformsByCode[code] || [];
  const rowTags = linkTagsByCode[code] || [];
  const primaryPlatform = rowPlatforms.length ? PLATFORM_BY_SLUG[rowPlatforms[0].slug] : null;
  return primaryPlatform ? primaryPlatform.name : (rowTags[0] || "General");
}

function exportFilenameStub(prefix, filterLabel, page) {
  const clean = String(filterLabel || "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}${clean ? "-" + clean : ""}-page${page}-${date}`;
}

// Single source of truth for a link's export row shape — used by both the
// per-page Links export (exportLinksRows, below) and the "Export All" Links
// sheet (exportFullReportExcel) so the two never drift out of sync.
function linkExportRow(link, sno) {
  return {
    "S.No": sno,
    "Category": categoryForLink(link.code),
    "Short Code": link.code || "",
    "Campaign": link.campaign_name || "—",
    "Short URL": `${BASE_URL}/api/redirect?id=${link.code}`,
    "Destination URL": link.original || "",
    "Tags": linkTagsSorted(link.code).join(", ") || "—",
    "Clicks": link.clicks || 0,
    "Visitors": dedupeByVisitor(clicksForCode(link.code)).length,
    "Status": "Active",
    "Created": formatDate(link.created)
  };
}

function exportLinksRows(useFull = false) {
  const snapshot = linksExportSnapshot;
  const source = useFull ? snapshot.fullRows : snapshot.rows;
  const offset = useFull ? 0 : (snapshot.offset || 0);
  return source.map((link, idx) => linkExportRow(link, offset + idx + 1));
}

// Note: the app never stores a visitor's raw IP address (see api/redirect.js
// / device_dedup_migration.sql) — only a salted SHA-256 ip_hash, which is
// what the visitor card's "IP" field already shows on screen. So the "IP
// Address" export column below is that same hash, not a literal IP, since
// that's all the database has. The full ip_hash is included (not truncated
// like the on-screen "12ab34cd…") since a spreadsheet/PDF is exactly where
// the untruncated value is useful (e.g. matching two rows as the same
// network/device).
//
// Column order mirrors the on-screen visitor card (see buildVisitorCard):
// row number, then who the visitor is (Username), then every "web listing"
// field shown on the card itself (Country, City, IP, Device, Browser, OS,
// Status, Total Clicks, Click Time), then the owning link's context fields
// last, since those describe the link rather than the user. A visitor has
// no real account "Category" — that link-only classification (still used by
// the Links export) is dropped here in favor of Username, which is what
// actually identifies each record.
function exportUsersRows(useFull = false) {
  const snapshot = usersExportSnapshot;
  const source = useFull ? snapshot.fullRows : snapshot.rows;
  const offset = useFull ? 0 : (snapshot.offset || 0);
  return source.map((click, idx) => {
    const ownerLink = links.find(l => l.code === click.link_code);
    return {
      "S.No": offset + idx + 1,
      "Username": click.visitor_id || "Unknown",
      "Country": click.country || "Unknown",
      "City": click.city || "Unknown",
      "IP Address": click.ip_hash || "Unknown",
      "Device": click.device || "Unknown",
      "Browser": click.browser || "Unknown",
      "OS": click.os || "Unknown",
      "Status": visitorStatus(click),
      "Total Clicks": visitorClickCount(click),
      "Click Time": formatDate(click.created_at),
      "Link Name": click.link_code || "",
      "Campaign": (ownerLink && ownerLink.campaign_name) || "—",
      "Tags": linkTagsSorted(click.link_code).join(", ") || "—",
      "Short URL": `${BASE_URL}/api/redirect?id=${click.link_code}`,
      "Original URL": ownerLink ? (ownerLink.original || "") : ""
    };
  });
}

// ---- Column width helpers for Excel exports ----
// The xlsx library never auto-sizes columns, so every sheet used to ship
// at Excel's default ~8.43-char width regardless of content — long URLs,
// tags, and names all got clipped/misaligned on open. These compute a
// width per column from the actual header + cell content instead.
function autoFitColumns(rows, minWidth = 6, maxWidth = 60) {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  return headers.map((key) => {
    let longest = String(key).length;
    for (const row of rows) {
      const val = row[key];
      const len = val === null || val === undefined ? 0 : String(val).length;
      if (len > longest) longest = len;
    }
    return { wch: Math.min(Math.max(longest + 2, minWidth), maxWidth) };
  });
}

// Decides each column's Excel number format + alignment purely from its
// header name. This never touches the values themselves (those come from
// exportLinksRows/exportUsersRows/etc. untouched) — it only tells Excel how
// to *display* whatever numeric value is already in the cell, e.g. so a
// count reads "1,024" instead of "1024" and lines up under its header.
// Currency/percentage columns aren't in the current data model, but are
// detected the same way so a future "Amount"/"Conversion Rate" column would
// automatically get correct formatting without any export code changes.
function excelColumnFormat(key) {
  const k = String(key).trim().toLowerCase();
  if (k === "s.no") return { align: "center", numFmt: "0" };
  if (/(^|\s)(rate|percent(age)?)(\s|$)/.test(k) || /%/.test(key)) return { align: "right", numFmt: "0.0%" };
  if (/(^|\s)(amount|price|cost|revenue|fee|total\s*\$)(\s|$)/.test(k)) return { align: "right", numFmt: "$#,##0.00" };
  if (/\bclicks\b|\bvisitors\b/.test(k)) return { align: "right", numFmt: "#,##0" };
  if (/\bcreated\b|\bclick time\b|\bdate\b|\bupdated\b/.test(k)) return { align: "center" };
  return { align: "left" };
}

// ---- Premium styling for Excel exports ----
// Colors mirror the app's own dark/teal brand (see style.css --bg-deep-alt,
// --teal) so exported sheets read as part of the product, not a generic
// spreadsheet. Requires xlsx-js-style (see index.html) — the plain "xlsx"
// package accepts these same `.s` objects but silently drops them on save.
const XL_THEME = {
  headerFill: "1B2140",   // deep navy, matches --bg-deep-alt
  headerFont: "FFFFFF",
  accent: "2DD4BF",       // matches --teal
  zebraFill: "F4F6FB",
  labelFill: "EEF1FA",
  border: "D7DCE5",
  muted: "6B7280"
};

function xlBorder(color = XL_THEME.border) {
  const b = { style: "thin", color: { rgb: color } };
  return { top: b, bottom: b, left: b, right: b };
}

// Bold white-on-navy header band across a row range (used for both the
// per-page table header and each visitor sub-table header in the full report).
function styleHeaderRow(ws, range) {
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: range.s.r, c });
    if (!ws[addr]) ws[addr] = { t: "s", v: "" };
    ws[addr].s = {
      font: { bold: true, sz: 11, color: { rgb: XL_THEME.headerFont } },
      fill: { patternType: "solid", fgColor: { rgb: XL_THEME.headerFill } },
      alignment: { horizontal: "center", vertical: "center" },
      border: xlBorder()
    };
  }
}

// Bordered body rows with light zebra banding. Alignment and number format
// (thousands separators, percentages, currency, centered dates — see
// excelColumnFormat) are driven per-column so headers and data always agree
// visually instead of a single blanket left/right rule for the whole sheet.
// A cell left empty by the null-safe row copy in buildTableSheet (below)
// still gets its border/fill so blank values read as clean empty cells
// rather than gaps in the table.
function styleDataRows(ws, range, { colFormats = [] } = {}) {
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const zebra = (r - range.s.r) % 2 === 0;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "s", v: "" };
      const fmt = colFormats[c] || {};
      const style = {
        font: { sz: 10.5 },
        alignment: { horizontal: fmt.align || "left", vertical: "center" },
        border: xlBorder()
      };
      if (zebra) style.fill = { patternType: "solid", fgColor: { rgb: XL_THEME.zebraFill } };
      ws[addr].s = style;
      if (fmt.numFmt && typeof ws[addr].v === "number") ws[addr].z = fmt.numFmt;
    }
  }
}

// Teal section-banner row (used to open each link's block in the full report).
function styleSectionBanner(ws, r, colCount) {
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r, c });
    if (!ws[addr]) ws[addr] = { t: "s", v: "" };
    ws[addr].s = {
      font: { bold: true, sz: 11, color: { rgb: XL_THEME.headerFont } },
      fill: { patternType: "solid", fgColor: { rgb: XL_THEME.accent } },
      alignment: { horizontal: "left", vertical: "center" },
      border: xlBorder()
    };
  }
  if (!ws["!rows"]) ws["!rows"] = [];
  ws["!rows"][r] = { hpx: 20 };
}

// ---- Shared builder for every flat, filterable Excel export sheet ----
// Every Excel export in the app — Links "This page", Links "Export All",
// Users "This page", and Users "Export All" — now runs through this one
// function, so all four are guaranteed to look identical: a colored title
// banner, a quiet generated-on/record-count subtitle, then a bold header
// band with an autofilter dropdown on every column and a frozen pane that
// keeps the header visible while scrolling. Column widths, row heights,
// per-column number formats/alignment, and null handling are all derived
// from the rows themselves — this function only changes how the data is
// *displayed*, never the values passed in.
function buildTableSheet(rows, title) {
  const headerKeys = Object.keys(rows[0]);
  const colCount = headerKeys.length;
  const HEADER_ROW = 3; // 0-indexed: title, subtitle, spacer, then header

  // Null-safe copy: undefined/null become "" so a missing value renders as
  // a clean blank cell instead of the literal text "null"/"undefined".
  // Values the app already normalizes (e.g. "Unknown", "—") pass through
  // unchanged — this only catches genuinely missing fields.
  const safeRows = rows.map((row) => {
    const clean = {};
    headerKeys.forEach((key) => {
      const v = row[key];
      clean[key] = (v === null || v === undefined) ? "" : v;
    });
    return clean;
  });

  const ws = {};
  XLSX.utils.sheet_add_aoa(ws, [[title]], { origin: "A1" });
  const subtitle = `Generated ${formatDate(new Date().toISOString())} · ${safeRows.length.toLocaleString()} record${safeRows.length === 1 ? "" : "s"}`;
  XLSX.utils.sheet_add_aoa(ws, [[subtitle]], { origin: "A2" });
  XLSX.utils.sheet_add_json(ws, safeRows, { origin: `A${HEADER_ROW + 1}` });

  const lastRow = HEADER_ROW + safeRows.length; // 0-indexed last data row
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow, c: colCount - 1 } });
  ws["!cols"] = autoFitColumns(safeRows);

  // Autofilter across every column, and a frozen pane so the title,
  // subtitle, and header band all stay visible while scrolling through data.
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: HEADER_ROW, c: 0 }, e: { r: HEADER_ROW, c: colCount - 1 } }) };
  ws["!views"] = [{ state: "frozen", ySplit: HEADER_ROW + 1 }];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } }];

  // Title banner (teal accent), sized up from the default section-banner
  // height so it reads as the sheet's main title.
  styleSectionBanner(ws, 0, colCount);
  ws["!rows"][0] = { hpx: 28 };
  ws[XLSX.utils.encode_cell({ r: 0, c: 0 })].s.font.sz = 15;

  // Quiet italic subtitle, spacer row, then the header band + every data
  // row gets an explicit height — tall enough to breathe, not so tall the
  // sheet feels sparse.
  const subAddr = XLSX.utils.encode_cell({ r: 1, c: 0 });
  if (ws[subAddr]) ws[subAddr].s = { font: { italic: true, sz: 10, color: { rgb: XL_THEME.muted } } };
  ws["!rows"][1] = { hpx: 16 };
  ws["!rows"][2] = { hpx: 6 };
  ws["!rows"][HEADER_ROW] = { hpx: 22 };
  for (let r = 0; r < safeRows.length; r++) ws["!rows"][HEADER_ROW + 1 + r] = { hpx: 19 };

  const headerRange = { s: { r: HEADER_ROW, c: 0 }, e: { r: HEADER_ROW, c: colCount - 1 } };
  styleHeaderRow(ws, headerRange);

  const colFormats = headerKeys.map(excelColumnFormat);
  styleDataRows(ws, { s: { r: HEADER_ROW, c: 0 }, e: { r: lastRow, c: colCount - 1 } }, { colFormats });

  return ws;
}

// Numeric/count columns that should read right-aligned like a spreadsheet
// rather than left-aligned like text.
const PDF_RIGHT_ALIGN_COLUMNS = /^(s\.no|clicks|visitors|total clicks)$/i;

function exportToPDF(title, rows, filenameStub) {
  if (!rows.length) { showToast("No rows on this page to export."); return; }
  if (!window.jspdf || !window.jspdf.jsPDF) { showToast("PDF export isn't available right now."); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const headerKeys = Object.keys(rows[0]);
  const headers = [headerKeys];
  const body = rows.map(r => Object.values(r));

  // S.No stays fixed-width. Any "*URL*" column gets capped too — otherwise
  // long Short/Original URLs (routinely 80-100+ chars) soak up most of the
  // landscape width and force every other column (Country, Device, Status,
  // Click Time, etc.) to wrap into multiple lines, which was inflating row
  // height enough to spill a handful of rows across several PDF pages.
  // Capped URL cells still wrap internally — that's fine, they're expected
  // to be long — but they no longer starve the columns around them.
  const columnStyles = { 0: { cellWidth: 12, halign: "center" } };
  headerKeys.forEach((key, i) => {
    if (/url/i.test(key)) columnStyles[i] = { cellWidth: 42 };
    if (PDF_RIGHT_ALIGN_COLUMNS.test(key)) columnStyles[i] = { ...(columnStyles[i] || {}), halign: "right" };
  });

  // Colored title band (matches the app's own navy/teal brand — see
  // XL_THEME in the Excel styling helpers below) so the PDF reads as a
  // branded report rather than a bare data dump.
  const drawHeaderBand = () => {
    doc.setFillColor(27, 33, 64); // navy — XL_THEME.headerFill
    doc.rect(0, 0, pageWidth, 18, "F");
    doc.setFillColor(45, 212, 191); // teal accent underline — XL_THEME.accent
    doc.rect(0, 18, pageWidth, 1.2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(title, 14, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const genLabel = `Generated ${formatDate(new Date().toISOString())} · ${rows.length.toLocaleString()} record${rows.length === 1 ? "" : "s"}`;
    doc.text(genLabel, pageWidth - 14, 12, { align: "right" });
    doc.setTextColor(0, 0, 0);
  };
  drawHeaderBand();

  doc.autoTable({
    head: headers,
    body,
    startY: 24,
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [215, 220, 229], lineWidth: 0.1, valign: "middle" },
    headStyles: { fillColor: [27, 33, 64], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" },
    alternateRowStyles: { fillColor: [244, 246, 251] },
    columnStyles,
    margin: { left: 14, right: 14, top: 24, bottom: 16 },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(130);
      doc.text("Link Tracker — Export Report", 14, pageHeight - 8);
      doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, pageWidth - 14, pageHeight - 8, { align: "right" });
      doc.setTextColor(0, 0, 0);
    }
  });

  doc.save(`${filenameStub}.pdf`);
}

function exportToExcel(sheetName, rows, filenameStub, title) {
  if (!rows.length) { showToast("No rows on this page to export."); return; }
  if (!window.XLSX) { showToast("Excel export isn't available right now."); return; }

  const ws = buildTableSheet(rows, title || sheetName);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filenameStub}.xlsx`);
}

// ---- "Export All" — a complete report: every link, each followed by its
// full visitor list, laid out as clearly separated sections (not one giant
// mixed table). Unlike the per-page exports above, this always covers every
// link regardless of the current page/filter, since the point of "All" is
// a full backup-style report rather than a snapshot of what's on screen. ----

function linkTagsSorted(code) {
  return (linkTagsByCode[code] || []).slice().sort((a, b) => a.localeCompare(b));
}

function exportFullReportPDF() {
  if (!links.length) { showToast("No links to export."); return; }
  if (!window.jspdf || !window.jspdf.jsPDF) { showToast("PDF export isn't available right now."); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  let y;

  // Colored title band — same navy/teal brand treatment as the per-page
  // exports, repeated on every new page so section headers never open on a
  // bare white page.
  const drawTitleBand = () => {
    doc.setFillColor(27, 33, 64);
    doc.rect(0, 0, pageWidth, 20, "F");
    doc.setFillColor(45, 212, 191);
    doc.rect(0, 20, pageWidth, 1.2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Complete Link & Visitor Report", marginX, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Generated ${formatDate(new Date().toISOString())} · ${links.length.toLocaleString()} link${links.length === 1 ? "" : "s"}`, pageWidth - marginX, 13, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y = 27;
  };
  drawTitleBand();

  const sortedLinks = links.slice().sort((a, b) => new Date(b.created) - new Date(a.created));

  sortedLinks.forEach((link, idx) => {
    const linkClicks = clicksForCode(link.code);

    // Leave room for at least the section header + detail table before
    // deciding a fresh page reads better than splitting them apart.
    if (y > pageHeight - 45) {
      doc.addPage();
      drawTitleBand();
    }

    doc.setFontSize(11.5);
    doc.setFont("helvetica", "bold");
    doc.text(`${idx + 1}. ${link.code}`, marginX, y);
    doc.setFont("helvetica", "normal");
    y += 5;

    doc.autoTable({
      startY: y,
      margin: { left: marginX, right: marginX },
      theme: "plain",
      styles: { fontSize: 8, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 } },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 26, textColor: [90, 90, 110] } },
      body: [
        ["Category", categoryForLink(link.code)],
        ["Short URL", `${BASE_URL}/api/redirect?id=${link.code}`],
        ["Destination", link.original || ""],
        ["Campaign", link.campaign_name || "—"],
        ["Tags", linkTagsSorted(link.code).join(", ") || "—"],
        ["Clicks", String(link.clicks || 0)],
        ["Visitors", String(dedupeByVisitor(linkClicks).length)],
        ["Created", formatDate(link.created)]
      ]
    });
    y = doc.lastAutoTable.finalY + 3;

    if (linkClicks.length === 0) {
      doc.setFontSize(8.5);
      doc.setTextColor(140);
      doc.text("No visitor activity recorded for this link.", marginX, y + 3);
      doc.setTextColor(0);
      y += 12;
    } else {
      doc.autoTable({
        startY: y,
        margin: { left: marginX, right: marginX },
        head: [["S.No", "Visitor ID", "Country", "City", "Device", "Browser", "OS", "Status", "Total Clicks", "Click Time"]],
        body: linkClicks.map((c, i) => [
          i + 1,
          c.visitor_id || "",
          c.country || "Unknown",
          c.city || "Unknown",
          c.device || "Unknown",
          c.browser || "Unknown",
          c.os || "Unknown",
          visitorStatus(c),
          visitorClickCount(c),
          formatDate(c.created_at)
        ]),
        styles: { fontSize: 7.5, cellPadding: 2, lineColor: [215, 220, 229], lineWidth: 0.1 },
        headStyles: { fillColor: [27, 33, 64], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [244, 246, 251] },
        columnStyles: { 0: { cellWidth: 12, halign: "right" }, 8: { halign: "right" } }
      });
      y = doc.lastAutoTable.finalY + 11; // extra breathing room before the next link's section
    }
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text("Link Tracker — Export Report", marginX, pageHeight - 8);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }

  doc.save(`complete-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

function exportFullReportExcel() {
  if (!links.length) { showToast("No links to export."); return; }
  if (!window.XLSX) { showToast("Excel export isn't available right now."); return; }

  // Every link, regardless of the current page/filter (see exportLinksRows
  // above for the filtered per-page version) — same ordering as before.
  const sortedLinks = links.slice().sort((a, b) => new Date(b.created) - new Date(a.created));
  const linkRows = sortedLinks.map((link, idx) => linkExportRow(link, idx + 1));

  // Every visitor across every link, flattened into one table with the
  // owning link's code/campaign carried on each row for context — the same
  // underlying click data as before, just laid out as a normal table
  // instead of a separate nested block per link.
  const visitorRows = [];
  sortedLinks.forEach((link) => {
    clicksForCode(link.code).forEach((c) => {
      visitorRows.push({
        "S.No": visitorRows.length + 1,
        "Link Code": link.code || "",
        "Campaign": link.campaign_name || "—",
        "Visitor ID": c.visitor_id || "",
        "Country": c.country || "Unknown",
        "City": c.city || "Unknown",
        "Device": c.device || "Unknown",
        "Browser": c.browser || "Unknown",
        "OS": c.os || "Unknown",
        "Status": visitorStatus(c),
        "Total Clicks": visitorClickCount(c),
        "Click Time": formatDate(c.created_at)
      });
    });
  });

  // Two sheets, one workbook — both built by the exact same buildTableSheet
  // function as the "This page" exports, so title banner, header styling,
  // autofilter, frozen pane, column widths, and number formats all match.
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildTableSheet(linkRows, "All Tracking Links"), "Links");
  if (visitorRows.length) {
    XLSX.utils.book_append_sheet(wb, buildTableSheet(visitorRows, "All Visitors"), "Visitors");
  }
  XLSX.writeFile(wb, `complete-report-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function exportLinks(format) {
  if (format === "all-pdf") { exportFullReportPDF(); return; }
  if (format === "all-excel") { exportFullReportExcel(); return; }
  const rows = exportLinksRows();
  const stub = exportFilenameStub("tracking-links", linksExportSnapshot.filterLabel, linksPage);
  if (format === "pdf") exportToPDF("All Tracking Links", rows, stub);
  else exportToExcel("Tracking Links", rows, stub, "All Tracking Links");
}

// ---- Users listing export (PDF): one clearly-separated record per user ----
// Unlike the Links table (one row per link, all columns comfortably fit),
// a full user record has 15 fields including two long URLs and a full IP
// hash — cramming that into one flat table row either truncates fields or
// forces columns to be dropped. Instead each user gets their own bordered
// "record" (S.No + Username banner, then a two-column label/value grid) in
// the PDF, using the app's navy/teal brand. The Excel version (below) uses
// a flat, filterable table instead — see buildTableSheet.

function exportUsersToPDF(rows, title, filenameStub) {
  if (!rows.length) { showToast("No users to export."); return; }
  if (!window.jspdf || !window.jspdf.jsPDF) { showToast("PDF export isn't available right now."); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2;
  let y;

  const drawTitleBand = () => {
    doc.setFillColor(27, 33, 64); // navy — XL_THEME.headerFill
    doc.rect(0, 0, pageWidth, 20, "F");
    doc.setFillColor(45, 212, 191); // teal accent underline — XL_THEME.accent
    doc.rect(0, 20, pageWidth, 1.2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(title, marginX, 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Generated ${formatDate(new Date().toISOString())} · ${rows.length.toLocaleString()} record${rows.length === 1 ? "" : "s"}`, pageWidth - marginX, 13, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y = 28;
  };
  drawTitleBand();

  rows.forEach((row) => {
    // Each record needs room for its banner + ~7 detail lines before a page
    // break reads better than splitting a user's data across two pages.
    if (y > pageHeight - 55) {
      doc.addPage();
      drawTitleBand();
    }

    // Record banner — teal, carries the (now correctly sequential) S.No and
    // the Username so a record is identifiable at a glance without having
    // to open the detail grid underneath it.
    doc.setFillColor(45, 212, 191);
    doc.rect(marginX, y - 5.5, contentWidth, 8, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(`#${row["S.No"]}   ${row["Username"]}`, marginX + 3, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    y += 5.5;

    // Two-column label/value grid for every remaining "web listing" field —
    // nothing gets dropped or truncated since the layout is vertical, not a
    // single crammed-wide row.
    const entries = Object.entries(row).filter(([k]) => k !== "S.No" && k !== "Username");
    const half = contentWidth / 2;
    const body = [];
    for (let i = 0; i < entries.length; i += 2) {
      const [k1, v1] = entries[i];
      const pair = entries[i + 1];
      body.push([k1, String(v1 ?? ""), pair ? pair[0] : "", pair ? String(pair[1] ?? "") : ""]);
    }

    doc.autoTable({
      startY: y,
      margin: { left: marginX, right: marginX },
      theme: "plain",
      styles: { fontSize: 8, cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 }, overflow: "linebreak" },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 26, textColor: [90, 90, 110] },
        1: { cellWidth: half - 26 },
        2: { fontStyle: "bold", cellWidth: 26, textColor: [90, 90, 110] },
        3: { cellWidth: half - 26 }
      },
      body
    });
    y = doc.lastAutoTable.finalY;

    // Clear separator between this record and the next.
    y += 4;
    doc.setDrawColor(215, 220, 229);
    doc.setLineWidth(0.3);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 8;
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text("Link Tracker — Export Report", marginX, pageHeight - 8);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, pageHeight - 8, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }

  doc.save(`${filenameStub}.pdf`);
}

function exportUsersToExcel(rows, title, filenameStub, sheetName) {
  if (!rows.length) { showToast("No users to export."); return; }
  if (!window.XLSX) { showToast("Excel export isn't available right now."); return; }

  // exportUsers() passes the "This page" rows here for a plain excel export
  // and the "every page" rows here for all-excel — both go through the same
  // buildTableSheet used by the Links exports, so "This page" and "Export
  // All" are always styled identically.
  const ws = buildTableSheet(rows, title);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filenameStub}.xlsx`);
}

function exportUsers(format) {
  // "all-*" = every user matching the current filters, across every page
  // (not just this page) — mirrors the Links page's "Export All" split.
  // S.No always comes from exportUsersRows' offset+index math, so per-page
  // exports continue the running count and "all" exports restart at 1 and
  // number straight through — never duplicated, never out of order.
  const isAll = format === "all-pdf" || format === "all-excel";
  const rows = exportUsersRows(isAll);
  if (!rows.length) { showToast("No users to export."); return; }

  const stub = isAll
    ? exportFilenameStub("user-listings-all", usersExportSnapshot.filterLabel, "all")
    : exportFilenameStub("user-listings", usersExportSnapshot.filterLabel, usersPage);

  if (format === "pdf" || format === "all-pdf") {
    exportUsersToPDF(rows, "All User Listings", stub);
  } else {
    exportUsersToExcel(rows, "All User Listings", stub, "User Listings");
  }
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

  const platforms = linkPlatformsByCode[link.code] || [];
  const tags = linkTagsByCode[link.code] || [];
  const previewCampaign = document.getElementById("preview-campaign");
  if (link.campaign_name) {
    previewCampaign.hidden = false;
    document.getElementById("gen-campaign-icons").innerHTML = platforms
      .map(p => platformBadgeHtml(p.slug))
      .join("");
    document.getElementById("gen-campaign-name").textContent = link.campaign_name;
    document.getElementById("gen-campaign-tags").innerHTML = tags.map(t => tagBadgeHtml(t)).join("");
  } else {
    previewCampaign.hidden = true;
  }

  previewPlaceholder.hidden = true;
  previewCreated.hidden = false;
  previewCreated.dataset.hasContent = "true";
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
