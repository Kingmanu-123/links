// ==========================================
// 1. INITIALIZATION & DATABASE CONFIG
// ==========================================
const SUPABASE_URL = "https://jctdtavzpcxnvpebpyqx.supabase.co";
const SUPABASE_KEY = "sb_publishable_QUrKq5DUY3pwmHv4HEjKCQ_bGFZi4VQ";
const BASE_URL = "https://links-one-rho.vercel.app";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Global state tracking
let links = [];

// DOM Elements
const urlInput = document.getElementById("url-input");
const aliasInput = document.getElementById("alias-input");
const urlError = document.getElementById("url-error");
const aliasError = document.getElementById("alias-error");
const createBtn = document.getElementById("create-btn");
const generatedWrap = document.getElementById("generated-wrap");
const tableBody = document.getElementById("table-body");
const footerCount = document.getElementById("footer-count");
const toast = document.getElementById("toast");

// ==========================================
// 2. LIFECYCLE ROUTING & APP STARTUP
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  loadLinks();
  createBtn.addEventListener("click", handleCreateLink);
});

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
  urlError.style.display = "none";
  aliasError.style.display = "none";

  const originalUrl = normalizeUrl(urlInput.value);
  let alias = aliasInput.value.trim().toLowerCase();

  if (!originalUrl) {
    urlError.style.display = "block";
    return;
  }

  createBtn.disabled = true;
  createBtn.innerText = "CHECKING CODES...";

  if (!alias) {
    do {
      alias = randomCode();
    } while (await checkCodeExists(alias));
  } else {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9-_]*[a-zA-Z0-9]$/.test(alias) && !/^[a-zA-Z0-9]$/.test(alias)) {
      aliasError.innerText = "Invalid format. Must begin/end with a letter or number.";
      aliasError.style.display = "block";
      createBtn.disabled = false;
      createBtn.innerHTML = `<span>Create Link</span><span class="btn-arrow">&#10142;</span>`;
      return;
    }

    const standsAlone = await checkCodeExists(alias);
    if (standsAlone) {
      aliasError.innerText = "Conflict: Custom short code already in use.";
      aliasError.style.display = "block";
      createBtn.disabled = false;
      createBtn.innerHTML = `<span>Create Link</span><span class="btn-arrow">&#10142;</span>`;
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
      renderTable();
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
    createBtn.disabled = false;
    createBtn.innerHTML = `<span>Create Link</span><span class="btn-arrow">&#10142;</span>`;
  }
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
  renderTable();
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
    renderTable();

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
  renderTable();
  showToast("Tracking link deleted successfully.");
}

// ==========================================
// 6. INTERFACE LOGIC RENDER ENGINE
// ==========================================
function renderTable() {
  footerCount.textContent = `${links.length} link${links.length === 1 ? '' : 's'} created`;
  
  tableBody.innerHTML = "";

  if (links.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML = `<span class="icon">&#128230;</span>No links created yet. Get started above.`;
    tableBody.appendChild(emptyState);
    return;
  }

  links.forEach(link => {
    const row = document.createElement("div");
    row.className = "history-row";

    const cellMain = document.createElement("div");
    cellMain.className = "cell-main";

    const shortDiv = document.createElement("div");
    shortDiv.className = "short-code";
    shortDiv.textContent = link.code; 
    shortDiv.addEventListener("click", () => openLink(link.code));

    const origDiv = document.createElement("div");
    origDiv.className = "orig-url";
    origDiv.textContent = link.original; 

    cellMain.appendChild(shortDiv);
    cellMain.appendChild(origDiv);

    const cellAnalytics = document.createElement("div");
    cellAnalytics.className = "cell-analytics";
    cellAnalytics.innerHTML = `<span class="status-label">ACTIVE</span> ${link.clicks} CLKS`;

    const delBtn = document.createElement("button");
    delBtn.className = "cell-del";
    delBtn.innerHTML = "&times;";
    delBtn.addEventListener("click", () => deleteLink(link.code));

    row.appendChild(cellMain);
    row.appendChild(cellAnalytics);
    row.appendChild(delBtn);

    tableBody.appendChild(row);
  });
}

function displayReceipt(link) {
  // FIXED: Explicitly uses the production BASE_URL structure 
  const fullShortUrl = `${BASE_URL}/api/redirect?id=${link.code}`;

  document.getElementById("gen-short").innerText = fullShortUrl;
  document.getElementById("gen-orig").innerText = link.original;
  document.getElementById("gen-time").innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const barcode = document.getElementById("gen-barcode");
  barcode.innerHTML = "";
  for (let i = 0; i < 26; i++) {
    const bar = document.createElement("div");
    bar.style.width = `${Math.floor(Math.random() * 3) + 1}px`; 
    barcode.appendChild(bar);
  }

  document.getElementById("copy-btn").onclick = async () => {
    try {
      await navigator.clipboard.writeText(fullShortUrl);
      showToast("Tracking link copied to clipboard.");
    } catch (err) {
      const fallbackInput = document.createElement("input");
      fallbackInput.value = fullShortUrl;
      fallbackInput.style.position = "absolute";
      fallbackInput.style.left = "-9999px";
      document.body.appendChild(fallbackInput);
      fallbackInput.select();
      
      try {
        document.execCommand("copy");
        showToast("Tracking link copied to clipboard.");
      } catch (fallbackErr) {
        console.error("Copy context blocked:", fallbackErr);
        showToast("Copying blocked by browser security settings.");
      }
      document.body.removeChild(fallbackInput);
    }
  };

  document.getElementById("open-btn").onclick = () => {
    openLink(link.code);
  };

  generatedWrap.style.display = "block";
}

// Global Notification Toast
function showToast(message) {
  clearTimeout(showToast.timer);
  toast.textContent = message;
  toast.classList.add("show");
  
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}
