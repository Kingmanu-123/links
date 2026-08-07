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
    { slug: "facebook",  name: "Facebook",     color: "#1877F2" },
    { slug: "instagram", name: "Instagram",    color: "linear-gradient(135deg, #FEDA75, #FA7E1E, #D62976, #962FBF, #4F5BD5)" },
    { slug: "twitter",   name: "X / Twitter",  color: "#000000" },
    { slug: "linkedin",  name: "LinkedIn",     color: "#0A66C2" },
    { slug: "youtube",   name: "YouTube",      color: "#FF0000" },
    { slug: "whatsapp",  name: "WhatsApp",     color: "#25D366" },
    { slug: "telegram",  name: "Telegram",     color: "#29A9EB" },
    { slug: "snapchat",  name: "Snapchat",     color: "#FFFC00" }
  ];
  const PLATFORM_BY_SLUG = Object.fromEntries(SOCIAL_PLATFORMS.map(p => [p.slug, p]));

  // Self-contained modern brand icons (background + glyph baked into each
  // SVG) — same visual language as the Link Tracker app's own icon set, so
  // a platform looks identical whichever app it's viewed in.
  const PLATFORM_ICON_SVGS = {
    facebook: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#1877F2"/><path d="M15.12 12.3h-2.2V19.5h-2.98V12.3H8.3V9.7h1.64V7.98c0-1.93.87-3.48 3.62-3.48h2.14v2.58h-1.37c-1.03 0-1.13.4-1.13 1.13V9.7h2.52l-.3 2.6Z" fill="#fff"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="igGradDash" x1="0" y1="24" x2="24" y2="0"><stop offset="0%" stop-color="#FEDA75"/><stop offset="30%" stop-color="#FA7E1E"/><stop offset="60%" stop-color="#D62976"/><stop offset="85%" stop-color="#962FBF"/><stop offset="100%" stop-color="#4F5BD5"/></linearGradient></defs><rect width="24" height="24" rx="6.5" fill="url(#igGradDash)"/><rect x="6.2" y="6.2" width="11.6" height="11.6" rx="3.6" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" stroke-width="1.6"/><circle cx="16.1" cy="7.9" r="1" fill="#fff"/></svg>',
    twitter: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6.5" fill="#000"/><path d="M6.6 6 11 12.2 6.36 18h1.8l3.9-4.66L15.44 18H19l-4.66-6.53L18.66 6h-1.8l-3.62 4.33L9.98 6H6.6Z" fill="#fff"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6.5" fill="#0A66C2"/><rect x="5.6" y="9.6" width="2.85" height="9" fill="#fff"/><circle cx="7.02" cy="6.35" r="1.75" fill="#fff"/><path d="M10.3 9.6h2.75v1.42h.04c.38-.72 1.32-1.5 2.72-1.5 2.9 0 3.44 1.92 3.44 4.42v5.66h-2.85v-5.02c0-1.2-.02-2.74-1.66-2.74-1.67 0-1.93 1.3-1.93 2.65v5.11H10.3V9.6Z" fill="#fff"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="7" fill="#FF0000"/><path d="M9.8 8.3v7.4l6.4-3.7-6.4-3.7Z" fill="#fff"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#25D366"/><path d="M12 6.2a5.8 5.8 0 0 0-4.96 8.8l.16.26-.6 2.2 2.26-.6.25.15A5.8 5.8 0 1 0 12 6.2Z" fill="none" stroke="#fff" stroke-width="1.3"/><path d="M9.3 8.9c.18-.4.35-.4.5-.4h.4c.13 0 .3 0 .45.35.17.4.56 1.4.6 1.5.05.13.08.27 0 .43-.08.16-.13.26-.26.4-.13.13-.27.3-.38.4-.13.13-.26.26-.11.5.14.27.6 1 1.3 1.6.86.78 1.6 1.04 1.86 1.16.27.13.43.1.58-.08.18-.18.6-.73.78-1 .17-.26.34-.2.56-.13.22.09 1.4.68 1.64.8.22.14.38.18.44.28.05.13.05.72-.18 1.42-.22.7-1.28 1.24-1.8 1.28-.48.08-1.03.13-1.66-.09a9.5 9.5 0 0 1-.98-.35c-2.35-1-3.85-3.44-3.97-3.6-.13-.17-.94-1.25-.94-2.38 0-1.13.6-1.68.8-1.9Z" fill="#fff"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="12" fill="#29A9EB"/><path d="M6.1 11.9 17.3 7.4c.55-.22 1.1.15.9.98l-2 9.6c-.14.7-.55.86-1.1.54l-3.1-2.3-1.5 1.45c-.17.17-.31.31-.6.31l.2-3 5.6-5.1c.24-.22-.06-.34-.36-.13l-6.9 4.4-3-.94c-.65-.2-.66-.65.16-.97Z" fill="#fff"/></svg>',
    snapchat: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" rx="6.5" fill="#FFFC00"/><path d="M12 5.8c2.05 0 3.35 1.7 3.25 3.75-.05.85-.1 1.5 0 1.9.1.06.5.14.9-.1.34-.18.8 0 .76.47-.05.47-.7.8-1.18 1.03-.28.14-.33.32-.24.56.33.83 1.4 1.44 2.34 1.58.28.05.33.32.1.55-.33.33-1.04.5-1.5.6-.14.33-.1.6-.33.8-.33.24-1.27.05-2.02.33-.66.24-1.08 1.27-2.12 1.27s-1.46-1.03-2.12-1.27c-.75-.28-1.7-.1-2.02-.33-.24-.2-.2-.47-.33-.8-.47-.1-1.17-.28-1.5-.6-.24-.24-.19-.5.1-.55.94-.14 2.02-.75 2.34-1.58.1-.24.05-.42-.24-.56-.47-.23-1.13-.56-1.18-1.03-.05-.47.42-.65.76-.47.4.23.8.16.9.1.1-.4.05-1.05 0-1.9-.1-2.05 1.2-3.75 3.25-3.75Z" fill="#000"/></svg>'
  };

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
    PLATFORM_ICON_SVGS,
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
