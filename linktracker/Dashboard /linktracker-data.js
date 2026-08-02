/* =============================================
   LINK TRACKER — shared data layer
   =============================================
   Pure data-fetch + compute functions ported from the Link Tracker app's
   own script.js (same Supabase project, same tables, same field names).
   No DOM code lives here — this is the data source that
   dashboard-integration.js renders into the OceanGlass markup.

   Kept separate on purpose: the Link Tracker app (script.js) is a fully
   working, already-verified app that directly manipulates its OWN page's
   DOM elements by id. Loading it as-is on the OceanGlass page would throw
   on every one of those getElementById() calls (this page doesn't have
   those ids) and likely halt partway through its top-level setup code.
   This file re-exposes just the read-only data/compute pieces OceanGlass
   actually needs, under a single window.LinkTrackerData namespace, so nothing
   here collides with app.js's own globals and the two pages never fight
   over the same functions.
   ============================================= */
'use strict';

(function () {
  const SUPABASE_URL = "https://jctdtavzpcxnvpebpyqx.supabase.co";
  const SUPABASE_KEY = "sb_publishable_QUrKq5DUY3pwmHv4HEjKCQ_bGFZi4VQ";
  const BASE_URL = "https://links-one-rho.vercel.app";

  const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // Same fixed platform catalog as script.js (SOCIAL_PLATFORMS), so a
  // platform badge/name always matches what the Link Tracker app itself
  // would show for the same slug.
  const SOCIAL_PLATFORMS = [
    { slug: "facebook",  name: "Facebook",     color: "#3b82f6" },
    { slug: "instagram", name: "Instagram",    color: "#ec4899" },
    { slug: "twitter",   name: "X / Twitter",  color: "#38bdf8" },
    { slug: "linkedin",  name: "LinkedIn",     color: "#0ea5e9" },
    { slug: "youtube",   name: "YouTube",      color: "#f87171" },
    { slug: "whatsapp",  name: "WhatsApp",     color: "#34d399" },
    { slug: "telegram",  name: "Telegram",     color: "#5eead4" },
    { slug: "snapchat",  name: "Snapchat",     color: "#fbbf24" }
  ];
  const PLATFORM_BY_SLUG = Object.fromEntries(SOCIAL_PLATFORMS.map(p => [p.slug, p]));

  const state = {
    links: [],
    clicksLog: [],
    clicksByCode: {},
    linkPlatformsByCode: {},
    linkTagsByCode: {},
    linksLoaded: false,
    clicksLoaded: false,
    totalLinksCount: 0,
    totalClicksCount: 0
  };

  function rebuildClicksByCodeIndex() {
    const map = {};
    for (const c of state.clicksLog) {
      (map[c.link_code] || (map[c.link_code] = [])).push(c);
    }
    state.clicksByCode = map;
  }

  function clicksForCode(code) {
    return state.clicksByCode[code] || [];
  }

  // Loads every link (same query as script.js's loadLinks()).
  async function loadLinks() {
    const { data, error } = await supabaseClient
      .from("links")
      .select("*")
      .order("created", { ascending: false });
    if (error) {
      console.error("LinkTrackerData: failed to load links:", error.message);
    }
    state.links = data || [];
    state.linksLoaded = true;
    return state.links;
  }

  // Loads recent click/visit events (same query as script.js's loadClicks(),
  // capped at 500 most-recent rows to match the source app's own limit).
  async function loadClicks() {
    const { data, error } = await supabaseClient
      .from("clicks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      console.warn("LinkTrackerData: clicks table not available yet:", error.message);
      state.clicksLog = [];
    } else {
      state.clicksLog = data || [];
    }
    rebuildClicksByCodeIndex();
    state.clicksLoaded = true;
    return state.clicksLog;
  }

  // Exact all-time counts (head-only count queries — not limited to 500
  // like loadClicks() above), used for the stat cards so "Total Links" /
  // "Total Views" / "Total Clicks" reflect true totals, not just the most
  // recent page of rows.
  async function loadCounts() {
    const [{ count: linkCount }, { count: clickCount }] = await Promise.all([
      supabaseClient.from("links").select("*", { count: "exact", head: true }),
      supabaseClient.from("clicks").select("*", { count: "exact", head: true })
    ]);
    state.totalLinksCount = linkCount || 0;
    state.totalClicksCount = clickCount || 0;
    return { totalLinksCount: state.totalLinksCount, totalClicksCount: state.totalClicksCount };
  }

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
      state.linkPlatformsByCode = map;
    } else if (lpErr) {
      console.warn("LinkTrackerData: link_platforms table not available yet:", lpErr.message);
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
      state.linkTagsByCode = map;
    } else if (ltErr) {
      console.warn("LinkTrackerData: link_tags table not available yet:", ltErr.message);
    }
  }

  // ---- Visitor helpers (ported verbatim from script.js) ----

  function visitorClickCount(click) {
    return state.clicksLog.reduce(
      (n, c) => n + (c.visitor_id === click.visitor_id && c.link_code === click.link_code ? 1 : 0),
      0
    );
  }

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

  // Buckets click timestamps into "clicks per day" for the last `days`
  // days (oldest first) — same logic as script.js's dailyClickBuckets().
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

  function trendGrowthPercent(buckets) {
    const mid = Math.ceil(buckets.length / 2);
    const prior = buckets.slice(0, mid).reduce((a, b) => a + b, 0);
    const recent = buckets.slice(mid).reduce((a, b) => a + b, 0);
    if (prior === 0) return recent > 0 ? 100 : 0;
    return Math.round(((recent - prior) / prior) * 100);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    const datePart = d.toLocaleDateString([], { month: "short", day: "2-digit", year: "numeric" });
    const timePart = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `${datePart} · ${timePart}`;
  }

  // Lightweight "2h ago" / "3d ago" formatter for the activity feed / recent
  // links list, where OceanGlass's design calls for a relative timestamp
  // rather than the absolute one formatDate() produces.
  function timeAgo(iso) {
    if (!iso) return "—";
    const t = new Date(iso).getTime();
    if (isNaN(t)) return "—";
    const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    const diffMo = Math.floor(diffDay / 30);
    return `${diffMo}mo ago`;
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, m => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
  }

  function hostnameLabel(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch { return url || ""; }
  }

  // Subscribes to live inserts on `links` and `clicks` so callers can
  // refresh the dashboard the moment new data lands, instead of only on a
  // timer. Requires Realtime replication to be enabled for these two
  // tables in the Supabase project (Database → Replication) — if it isn't,
  // this subscription simply never fires and the polling fallback in
  // dashboard-integration.js keeps things reasonably fresh instead.
  function subscribeToChanges(onChange) {
    return supabaseClient
      .channel("oceanglass-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "links" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "clicks" }, onChange)
      .subscribe();
  }

  window.LinkTrackerData = {
    BASE_URL,
    PLATFORM_BY_SLUG,
    SOCIAL_PLATFORMS,
    state,
    loadLinks,
    loadClicks,
    loadCounts,
    loadCampaignJoins,
    clicksForCode,
    visitorClickCount,
    dedupeByVisitor,
    dailyClickBuckets,
    trendGrowthPercent,
    formatDate,
    timeAgo,
    escapeHtml,
    hostnameLabel,
    subscribeToChanges
  };
})();
