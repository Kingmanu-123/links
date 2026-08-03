/* =============================================
   OCEANGLASS ⇄ LINK TRACKER — dashboard integration
   =============================================
   Replaces every hardcoded/demo value in this page with live data from the
   same Supabase project the Link Tracker app (../link-tracker/) uses, via
   linktracker-data.js. Loaded after app.js — app.js still owns all the
   visual/interaction behavior (chart drawing engine, sidebar, ripples,
   etc.); this file only supplies the real numbers and real navigation
   targets, using the window.setSparkData / window.renderOverviewChart /
   window.setSearchSuggestions / window.setActivityFeed hooks app.js now
   exposes for exactly this purpose.

   Deep, per-record work (creating/editing links, filtering, sorting,
   paging, visitor drill-downs, PDF/Excel export, campaign & tag
   management) is NOT reimplemented here — the Link Tracker app already
   has all of that, fully built and tested. Rather than duplicate it in a
   second UI, the sidebar/quick-action links below send the user into the
   real app (deep-linked to the right view) for that work. This page is
   the live overview; the Link Tracker app is where you manage things.
   ============================================= */
'use strict';

(function () {
  const LT = window.LinkTrackerData;
  if (!LT) { console.error("dashboard-integration.js: linktracker-data.js did not load."); return; }

  // Where the full Link Tracker app lives relative to this page. Adjust
  // this one constant if you deploy the two apps at a different relative
  // path to each other.
  const LINK_TRACKER_URL = "../index.html";

  // ---------- Sidebar / quick-action navigation ----------
  // OceanGlass ships as a single overview page — none of the sidebar items
  // besides "Overview" have their own content in this template. Rather than
  // leave them inert (just an ".active" class toggle, per the original
  // app.js) or fake up new pages that would duplicate what the Link
  // Tracker app already does, each one deep-links into the real app's
  // matching view.
  const NAV_TARGETS = {
    'nav-overview':  null, // stays on this page
    'nav-links':     LINK_TRACKER_URL + '#all',
    'nav-campaigns': LINK_TRACKER_URL + '#all',
    'nav-analytics': LINK_TRACKER_URL + '#dashboard',
    'nav-users':     LINK_TRACKER_URL + '#users',
    'nav-platforms': LINK_TRACKER_URL + '#all',
    'nav-tags':      LINK_TRACKER_URL + '#all'
    // nav-settings / nav-activity: no equivalent view exists in either app
    // yet, so intentionally left as-is rather than linked to something
    // that doesn't exist.
  };
  Object.entries(NAV_TARGETS).forEach(([id, href]) => {
    if (!href) return;
    const el = document.getElementById(id);
    if (el) el.setAttribute('href', href);
  });

  const QUICK_ACTION_TARGETS = {
    'qa-create-link':     LINK_TRACKER_URL + '#dashboard',
    'qa-create-campaign': LINK_TRACKER_URL + '#dashboard',
    'qa-add-user':        LINK_TRACKER_URL + '#users',
    'qa-view-reports':    LINK_TRACKER_URL + '#all'
    // qa-settings: no settings view exists yet in either app.
  };
  Object.entries(QUICK_ACTION_TARGETS).forEach(([id, href]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => { window.location.href = href; });
  });

  // "View all" on the Recent Links card → All Links view in the real app.
  document.querySelectorAll('.recent-links-card .view-all-btn').forEach(el => {
    el.setAttribute('href', LINK_TRACKER_URL + '#all');
  });

  // ---------- Stat card helpers ----------
  function setStatValue(cardId, value, { suffix = '', divisor = 1 } = {}) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const valEl = card.querySelector('.stat-value');
    if (!valEl) return;
    valEl.dataset.target = String(value);
    if (suffix) valEl.dataset.suffix = suffix; else delete valEl.dataset.suffix;
    if (divisor !== 1) valEl.dataset.divisor = String(divisor); else delete valEl.dataset.divisor;
    // The counter animation only fires once via IntersectionObserver on
    // first scroll-into-view (see app.js §3). The cards are already in the
    // initial viewport on load, so that observer callback has likely
    // already fired with the placeholder 0 target by the time real data
    // arrives here — animate explicitly so the real number always shows.
    if (typeof animateCounter === 'function') animateCounter(valEl);
    else valEl.textContent = divisor > 1 ? (value / divisor).toFixed(1) + suffix : Math.round(value).toLocaleString();
  }

  function setStatChange(cardId, pct) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const changeEl = card.querySelector('.stat-change');
    if (!changeEl) return;
    const positive = pct >= 0;
    changeEl.classList.toggle('positive', positive);
    changeEl.classList.toggle('negative', !positive);
    const arrowPath = changeEl.querySelector('path');
    if (arrowPath) {
      arrowPath.setAttribute('stroke', positive ? '#22c55e' : '#ef4444');
      arrowPath.setAttribute('d', positive ? 'M6 9V3M6 3L3 6M6 3l3 3' : 'M6 3v6M6 9L3 6M6 9l3-3');
    }
    // Trailing text node after the arrow <svg> carries the label.
    const svg = changeEl.querySelector('svg');
    const label = ` ${Math.abs(pct)}% from last week`;
    if (svg && svg.nextSibling && svg.nextSibling.nodeType === Node.TEXT_NODE) {
      svg.nextSibling.textContent = label;
    } else {
      changeEl.appendChild(document.createTextNode(label));
    }
  }

  // ---------- Main render ----------
  async function renderDashboard() {
    await Promise.all([
      LT.loadLinks(),
      LT.loadClicks(),
      LT.loadCounts(),
      LT.loadCampaignJoins()
    ]);

    const { links, clicksLog } = LT.state;
    const uniqueVisitors = LT.dedupeByVisitor(clicksLog);

    // -- Stat cards --
    // "Views" and "Clicks" are the same underlying event in this schema
    // (the clicks table records every redirect/visit — there's no separate
    // pre-click "view" concept to report), so both cards intentionally
    // show the same real total rather than inventing a second metric.
    setStatValue('statCard1', LT.state.totalLinksCount);
    setStatValue('statCard2', LT.state.totalClicksCount);
    setStatValue('statCard3', LT.state.totalClicksCount);
    setStatValue('statCard4', uniqueVisitors.length);

    const linkBuckets = dailyBucketsByDate(links.map(l => l.created), 12);
    const clickBuckets12 = LT.dailyClickBuckets(clicksLog, 12);
    const visitorBuckets12 = dailyBucketsByDate(uniqueVisitors.map(c => c.created_at), 12);

    window.setSparkData('chart1', linkBuckets);
    window.setSparkData('chart2', clickBuckets12);
    window.setSparkData('chart3', clickBuckets12);
    window.setSparkData('chart4', visitorBuckets12);

    setStatChange('statCard1', LT.trendGrowthPercent(linkBuckets));
    setStatChange('statCard2', LT.trendGrowthPercent(clickBuckets12));
    setStatChange('statCard3', LT.trendGrowthPercent(clickBuckets12));
    setStatChange('statCard4', LT.trendGrowthPercent(visitorBuckets12));

    // -- Overview Analytics chart (last 7 days of clicks) --
    const days7 = LT.dailyClickBuckets(clicksLog, 7);
    const dayLabels = last7DayLabels();
    window.renderOverviewChart(dayLabels, days7);

    const today = days7[6] || 0;
    const thisWeek = days7.reduce((a, b) => a + b, 0);
    setMiniStat(0, today.toLocaleString());
    setMiniStat(1, thisWeek.toLocaleString());
    setMiniStat(2, LT.state.totalClicksCount.toLocaleString());

    // -- Recent Links --
    renderRecentLinks(links.slice(0, 5));

    // -- Top Platforms --
    renderTopPlatforms(links);

    // -- Best Performing Link --
    renderBestPerforming(links);

    // -- Recent Activity (from real click events) --
    renderActivityFeed(clicksLog.slice(0, 8));

    // -- Search suggestions (real link names + destination URLs) --
    window.setSearchSuggestions(
      links.flatMap(l => [l.campaign_name, l.original].filter(Boolean))
    );
  }

  // ---------- Chart data helpers ----------

  // Same day-bucketing idea as LT.dailyClickBuckets(), but for any list of
  // ISO timestamps (link creation dates, unique-visitor first-seen dates)
  // rather than specifically click rows.
  function dailyBucketsByDate(isoDates, days) {
    const buckets = new Array(days).fill(0);
    const now = Date.now();
    isoDates.forEach(iso => {
      const t = new Date(iso).getTime();
      if (isNaN(t)) return;
      const dayIndex = days - 1 - Math.floor((now - t) / 86400000);
      if (dayIndex >= 0 && dayIndex < days) buckets[dayIndex]++;
    });
    return buckets;
  }

  function last7DayLabels() {
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      labels.push(d.toLocaleDateString([], { month: 'short', day: '2-digit' }));
    }
    return labels;
  }

  function setMiniStat(index, text) {
    const nodes = document.querySelectorAll('.analytics-mini-stats .mini-stat .mini-stat-val');
    if (nodes[index]) nodes[index].textContent = text;
  }

  // ---------- Section renderers ----------

  function renderRecentLinks(recentLinks) {
    const list = document.querySelector('.recent-links-card .links-list');
    if (!list) return;
    if (!recentLinks.length) {
      list.innerHTML = `<div class="link-item"><div class="link-info"><span class="link-name">No links yet</span></div></div>`;
      return;
    }
    list.innerHTML = recentLinks.map(link => {
      const views = LT.clicksForCode(link.code).length;
      const displayName = link.campaign_name || LT.hostnameLabel(link.original) || link.code;
      const name = LT.escapeHtml(displayName);
      const host = LT.escapeHtml(LT.hostnameLabel(link.original) || link.code);
      return `
        <div class="link-item">
          <div class="link-icon-wrap"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6.5 9.5a3.5 3.5 0 0 0 5 0l1.5-1.5a3.5 3.5 0 0 0-5-5L6.75 4.24" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M9.5 6.5a3.5 3.5 0 0 0-5 0L3 8a3.5 3.5 0 0 0 5 5l1.24-1.24" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></div>
          <div class="link-info"><span class="link-name">${name}</span><span class="link-url">${host}</span></div>
          <div class="link-views"><span class="views-num">${views.toLocaleString()}</span><span class="views-lbl">Clicks</span></div>
          <span class="link-time">${LT.timeAgo(link.created)}</span>
        </div>`;
    }).join('');
  }

  function renderTopPlatforms(links) {
    const wrap = document.querySelector('.top-platforms-card .platforms-list');
    if (!wrap) return;

    // Count links per platform using the link_platforms join loaded by
    // LT.loadCampaignJoins(); links with no platform assigned aren't
    // counted (mirrors how the Link Tracker app treats them elsewhere —
    // see categoryForLink() in script.js, "General" fallback).
    const counts = {};
    links.forEach(l => {
      const platforms = LT.state.linkPlatformsByCode[l.code] || [];
      platforms.forEach(p => { counts[p.slug] = (counts[p.slug] || 0) + 1; });
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);

    if (!top.length) {
      wrap.innerHTML = `<div class="platform-item"><div class="platform-info"><span class="platform-name">No campaign platforms assigned yet</span></div></div>`;
      return;
    }

    const gradient = 'linear-gradient(90deg,#4f8ef7,#00d4ff)';
    wrap.innerHTML = top.map(([slug, count]) => {
      const meta = LT.PLATFORM_BY_SLUG[slug] || { name: slug };
      const pct = total ? Math.round((count / total) * 100) : 0;
      const iconSvg = (LT.PLATFORM_ICON_SVGS && LT.PLATFORM_ICON_SVGS[slug]) || '';
      const initials = LT.escapeHtml((meta.name || slug).slice(0, 2).toUpperCase());
      const iconInner = iconSvg
        ? iconSvg
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${meta.color || '#4f8ef7'};color:#fff;font-size:9px;font-weight:700;border-radius:8px;">${initials}</div>`;
      return `
        <div class="platform-item">
          <div class="platform-icon platform-icon--${slug}">${iconInner}</div>
          <div class="platform-info">
            <span class="platform-name">${LT.escapeHtml(meta.name || slug)}</span>
            <div class="platform-bar-wrap">
              <div class="platform-bar"><div class="platform-bar-fill" style="width:${pct}%; background:${gradient}"></div></div>
            </div>
          </div>
          <span class="platform-pct">${pct}%</span>
        </div>`;
    }).join('');
  }

  function renderBestPerforming(links) {
    const el = document.querySelector('.best-performing');
    if (!el || !links.length) return;
    let best = null, bestCount = -1;
    links.forEach(l => {
      const c = LT.clicksForCode(l.code).length;
      if (c > bestCount) { best = l; bestCount = c; }
    });
    if (!best) return;
    const urlEl = el.querySelector('.best-url');
    const numEl = el.querySelector('.best-views-num');
    if (urlEl) urlEl.textContent = `${LT.BASE_URL}/api/redirect?id=${best.code}`;
    if (numEl) numEl.textContent = bestCount >= 1000 ? (bestCount / 1000).toFixed(1) + 'K' : String(bestCount);
  }

  function renderActivityFeed(recentClicks) {
    if (!recentClicks.length) return;
    const feed = recentClicks.map(c => ({
      user: LT.escapeHtml(c.visitor_id || 'A visitor'),
      action: `clicked ${LT.escapeHtml(c.link_code || 'a link')}`,
      url: `${LT.BASE_URL}/api/redirect?id=${c.link_code}`,
      time: LT.timeAgo(c.created_at)
    }));
    window.setActivityFeed(feed);
  }

  // ---------- Real-time + polling refresh ----------
  // Supabase Realtime pushes an update immediately when it's enabled for
  // the links/clicks tables (Database → Replication in the Supabase
  // dashboard); the 60s poll is a fallback that keeps things reasonably
  // live either way.
  let refreshTimer = null;
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(renderDashboard, 400); // debounce bursts of changes
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderDashboard().catch(err => console.error("dashboard-integration.js: initial render failed:", err));
    LT.subscribeToChanges(scheduleRefresh);
    setInterval(renderDashboard, 60000);
  });
})();
