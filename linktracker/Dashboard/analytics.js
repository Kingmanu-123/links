/* =============================================
   OCEANGLASS ANALYTICS — analytics.js
   =============================================
   Drives the standalone Analytics page: loads real data from the same
   Supabase project via linktracker-data.js (window.LinkTrackerData),
   buckets it by Day / Month / Year, draws the large realtime chart, and
   keeps everything live via Supabase Realtime + a polling fallback —
   same pattern dashboard-integration.js uses for the Overview page.
   ============================================= */
'use strict';

(function () {
  const LT = window.LinkTrackerData;
  if (!LT) { console.error('analytics.js: linktracker-data.js did not load.'); return; }

  const LINK_TRACKER_URL = '../index.html';

  // ---------- Sidebar deep-links (same targets as the Overview page) ----------
  const NAV_TARGETS = {
    'nav-links':     LINK_TRACKER_URL + '#all',
    'nav-campaigns': LINK_TRACKER_URL + '#all',
    'nav-users':     LINK_TRACKER_URL + '#users',
    'nav-platforms': LINK_TRACKER_URL + '#all',
    'nav-tags':      LINK_TRACKER_URL + '#all'
  };
  Object.entries(NAV_TARGETS).forEach(([id, href]) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('href', href);
  });

  /* ══════════════════════════════════════════════
     STATE — granularity + which period is on screen
  ══════════════════════════════════════════════ */
  const state = {
    granularity: 'month',   // 'day' | 'month' | 'year'
    offset: 0,              // 0 = current period, -1 = previous, etc. Never > 0.
    linksTableRows: [],     // cached, unfiltered rows — re-filtered locally on search input
    usersTableRows: []
  };

  const MONTH_NAMES  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTH_NAMES_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // ---------- Period boundaries for the current granularity + offset ----------
  function currentPeriodRange() {
    const now = new Date();
    if (state.granularity === 'day') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + state.offset);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      return { start, end, anchor: d };
    }
    if (state.granularity === 'year') {
      const y = now.getFullYear() + state.offset;
      return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1), anchor: new Date(y, 0, 1) };
    }
    // month
    const d = new Date(now.getFullYear(), now.getMonth() + state.offset, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { start, end, anchor: d };
  }

  function previousPeriodRange() {
    const savedOffset = state.offset;
    state.offset -= 1;
    const range = currentPeriodRange();
    state.offset = savedOffset;
    return range;
  }

  function periodLabelText(range) {
    const a = range.anchor;
    if (state.granularity === 'day') {
      const todayStr     = new Date().toDateString();
      const yesterdayStr = new Date(Date.now() - 86400000).toDateString();
      if (a.toDateString() === todayStr) return 'Today';
      if (a.toDateString() === yesterdayStr) return 'Yesterday';
      return a.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
    if (state.granularity === 'year') return String(a.getFullYear());
    return `${MONTH_NAMES_FULL[a.getMonth()]} ${a.getFullYear()}`;
  }

  /* ══════════════════════════════════════════════
     BUCKETING — real click timestamps -> chart series
  ══════════════════════════════════════════════ */
  function bucketClicks(clicks, range) {
    const { start, end } = range;
    let labels, vals, unitMs;

    if (state.granularity === 'day') {
      labels = Array.from({ length: 24 }, (_, h) => {
        const hh = h % 12 === 0 ? 12 : h % 12;
        return `${hh}${h < 12 ? 'am' : 'pm'}`;
      });
      vals = new Array(24).fill(0);
      clicks.forEach(c => {
        const t = new Date(c.created_at);
        if (t >= start && t < end) vals[t.getHours()]++;
      });
    } else if (state.granularity === 'year') {
      labels = MONTH_NAMES.slice();
      vals = new Array(12).fill(0);
      clicks.forEach(c => {
        const t = new Date(c.created_at);
        if (t >= start && t < end) vals[t.getMonth()]++;
      });
    } else {
      const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      labels = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
      vals = new Array(daysInMonth).fill(0);
      clicks.forEach(c => {
        const t = new Date(c.created_at);
        if (t >= start && t < end) vals[t.getDate() - 1]++;
      });
    }
    return { labels, vals };
  }

  function clicksInRange(clicks, range) {
    return clicks.filter(c => {
      const t = new Date(c.created_at);
      return t >= range.start && t < range.end;
    });
  }

  /* ══════════════════════════════════════════════
     BIG CHART — large, responsive canvas line chart
  ══════════════════════════════════════════════ */
  const canvas = document.getElementById('analyticsBigChart');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const chartWrap = document.querySelector('.big-chart-wrap');
  let chartLabels = [], chartVals = [], chartYMax = 5;

  function drawBigChart() {
    if (!canvas || !ctx) return;
    const PR = window.devicePixelRatio || 1;
    const W = canvas.parentElement.clientWidth  || 600;
    const H = canvas.parentElement.clientHeight || 300;
    canvas.width  = W * PR;
    canvas.height = H * PR;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(PR, PR);
    ctx.clearRect(0, 0, W, H);

    const vals = chartVals, labels = chartLabels;
    if (!vals.length) return;
    const maxVal = Math.max(...vals, 1);
    chartYMax = Math.ceil(maxVal * 1.25 / 5) * 5 || 5;
    const yTicks = [0, chartYMax/4, chartYMax/2, chartYMax*3/4, chartYMax];

    const padL = 46, padR = 16, padT = 16, padB = 30;
    const cW = W - padL - padR, cH = H - padT - padB;

    // Y grid + labels
    yTicks.forEach(tick => {
      const y = padT + cH * (1 - tick / chartYMax);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0,180,220,0.09)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.moveTo(padL, y); ctx.lineTo(padL + cW, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(122,173,204,0.75)';
      ctx.font = '11px Inter,sans-serif';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(tick >= 1000 ? Math.round(tick/1000)+'K' : Math.round(tick).toLocaleString(), padL - 8, y);
    });

    const xS = cW / Math.max(vals.length - 1, 1);
    const pts = vals.map((v, i) => ({ x: padL + i * xS, y: padT + cH * (1 - v / chartYMax) }));

    // X labels — thin out when there are many buckets (e.g. 31 days) so text doesn't collide
    const maxLabels = Math.floor(cW / 34);
    const step = Math.max(1, Math.ceil(labels.length / maxLabels));
    labels.forEach((lbl, i) => {
      if (i % step !== 0 && i !== labels.length - 1) return;
      ctx.fillStyle = 'rgba(122,173,204,0.75)';
      ctx.font = '10.5px Inter,sans-serif';
      ctx.textBaseline = 'top';
      if (i === 0) { ctx.textAlign = 'left'; ctx.fillText(lbl, pts[i].x - 2, padT + cH + 8); }
      else if (i === labels.length - 1) { ctx.textAlign = 'right'; ctx.fillText(lbl, pts[i].x + 2, padT + cH + 8); }
      else { ctx.textAlign = 'center'; ctx.fillText(lbl, pts[i].x, padT + cH + 8); }
    });

    // Area fill
    const grad = ctx.createLinearGradient(0, padT, 0, padT + cH);
    grad.addColorStop(0, 'rgba(0,212,255,0.32)');
    grad.addColorStop(0.5, 'rgba(0,160,230,0.13)');
    grad.addColorStop(1, 'rgba(0,100,180,0)');
    ctx.beginPath();
    ctx.moveTo(pts[0].x, padT + cH);
    ctx.lineTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const c1x = pts[i-1].x + xS*0.5, c2x = pts[i].x - xS*0.5;
      ctx.bezierCurveTo(c1x, pts[i-1].y, c2x, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.lineTo(pts[pts.length-1].x, padT + cH);
    ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // Stroke line
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const c1x = pts[i-1].x + xS*0.5, c2x = pts[i].x - xS*0.5;
      ctx.bezierCurveTo(c1x, pts[i-1].y, c2x, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = 'rgba(0,212,255,0.95)';
    ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.stroke();

    // Dots — only draw every Nth when dense, so points don't smear together
    const dotStep = Math.max(1, Math.ceil(pts.length / 60));
    const peakIndex = vals.indexOf(maxVal);
    pts.forEach((pt, i) => {
      if (i % dotStep !== 0 && i !== peakIndex) return;
      const peak = i === peakIndex && maxVal > 0;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, peak ? 5 : 2.6, 0, Math.PI*2);
      ctx.fillStyle = peak ? '#00d4ff' : 'rgba(0,212,255,0.8)';
      ctx.fill();
      ctx.strokeStyle = peak ? '#fff' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth = peak ? 2 : 1.2;
      ctx.stroke();
    });

    if (chartWrap) chartWrap.classList.toggle('is-empty', maxVal <= 0 && vals.every(v => v === 0));
  }

  // Hover crosshair + tooltip
  if (canvas) {
    canvas.addEventListener('mousemove', e => {
      if (!chartVals.length) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const W = canvas.parentElement.clientWidth, H = canvas.parentElement.clientHeight;
      const padL = 46, padR = 16, padT = 16, padB = 30;
      const cW = W - padL - padR, cH = H - padT - padB;
      const xS = cW / Math.max(chartVals.length - 1, 1);
      const pts = chartVals.map((v, i) => ({ x: padL + i*xS, y: padT + cH*(1 - v/chartYMax) }));
      let best = -1, bd = 20;
      pts.forEach((p, i) => { const d = Math.abs(mx - p.x); if (d < bd) { bd = d; best = i; } });
      drawBigChart();
      if (best >= 0) {
        const pt = pts[best];
        ctx.save();
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = 'rgba(0,212,255,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pt.x, padT); ctx.lineTo(pt.x, padT + cH); ctx.stroke();
        ctx.setLineDash([]);

        const val = chartVals[best], lbl = chartLabels[best];
        const text = `${lbl}: ${val.toLocaleString()} click${val === 1 ? '' : 's'}`;
        ctx.font = 'bold 11px Inter,sans-serif';
        const tw = ctx.measureText(text).width + 18, th = 26;
        let tx = pt.x + 10; if (tx + tw > W - 4) tx = pt.x - tw - 10;
        let ty = pt.y - 34; if (ty < 4) ty = pt.y + 12;
        ctx.fillStyle = 'rgba(8,20,44,0.95)';
        ctx.strokeStyle = 'rgba(0,212,255,0.4)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(tx, ty, tw, th, 6); else ctx.rect(tx, ty, tw, th);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#dff4ff';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(text, tx + 9, ty + th/2 + 1);
        ctx.restore();
      }
    });
    canvas.addEventListener('mouseleave', drawBigChart);
    window.addEventListener('resize', () => drawBigChart());
  }

  /* ══════════════════════════════════════════════
     RENDER — pulls current data + period into every widget
  ══════════════════════════════════════════════ */
  function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }

  function updateStatChange(elId, pct) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.classList.toggle('positive', pct >= 0);
    el.classList.toggle('negative', pct < 0);
    const svg = el.querySelector('svg');
    if (svg) {
      const path = svg.querySelector('path');
      if (path) {
        path.setAttribute('stroke', pct >= 0 ? '#22c55e' : '#ef4444');
        path.setAttribute('d', pct >= 0 ? 'M6 9V3M6 3L3 6M6 3l3 3' : 'M6 3v6M6 9L3 6M6 9l3-3');
      }
    }
    const txt = el.querySelector('.change-text');
    if (txt) txt.textContent = `${pct >= 0 ? '↑' : '↓'} ${Math.abs(pct)}% vs previous period`;
  }

  function renderPlatformBreakdown(clicksForPeriod) {
    // Only drives the "Top Platform" stat card now (the platform-list
    // widget itself was removed along with the old mid-row), but the
    // stat still needs computing every render, so this no longer
    // early-returns when a list element isn't present on the page.
    const counts = {};
    clicksForPeriod.forEach(c => {
      const platforms = LT.state.linkPlatformsByCode[c.link_code] || [];
      platforms.forEach(p => { counts[p.slug] = (counts[p.slug] || 0) + 1; });
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);

    if (!top.length) {
      setText('statVal4', '—');
      setText('statChange4Label', 'No data yet');
      return;
    }

    const [bestSlug, bestCount] = top[0];
    const bestMeta = LT.PLATFORM_BY_SLUG[bestSlug] || { name: bestSlug };
    setText('statVal4', bestMeta.name || bestSlug);
    setText('statChange4Label', `${bestCount.toLocaleString()} click${bestCount === 1 ? '' : 's'} in period`);
  }

  /* ══════════════════════════════════════════════
     LINKS & CAMPAIGNS TABLE — clicks + unique users, grouped by link
     (a "campaign" is just a link with a campaign_name set), each row
     expandable to the list of visitors who clicked it.
  ══════════════════════════════════════════════ */
  function buildLinkRows(periodClicks) {
    const byCode = {};
    periodClicks.forEach(c => { (byCode[c.link_code] ||= []).push(c); });

    return Object.entries(byCode).map(([code, clicks]) => {
      const meta = LT.state.links.find(l => l.code === code);
      const uniqueUsers = LT.dedupeByVisitor(clicks);
      const platforms = LT.state.linkPlatformsByCode[code] || [];
      const platformCounts = {};
      clicks.forEach(c => {
        (LT.state.linkPlatformsByCode[c.link_code] || []).forEach(p => {
          platformCounts[p.slug] = (platformCounts[p.slug] || 0) + 1;
        });
      });
      const topSlug = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
      const topPlatformName = topSlug ? (LT.PLATFORM_BY_SLUG[topSlug]?.name || topSlug) : (platforms[0]?.name || '—');
      return {
        code,
        campaign: meta?.campaign_name || null,
        clicks: clicks.length,
        users: uniqueUsers.length,
        topPlatform: topPlatformName,
        clickRows: clicks
      };
    }).sort((a, b) => b.clicks - a.clicks);
  }

  function visitorSummaryFor(clicks) {
    const byVisitor = {};
    clicks.forEach(c => { (byVisitor[c.visitor_id] ||= []).push(c); });
    return Object.entries(byVisitor).map(([vid, list]) => {
      const last = list.reduce((a, b) => new Date(a.created_at) > new Date(b.created_at) ? a : b);
      return { vid, count: list.length, last: last.created_at };
    }).sort((a, b) => b.count - a.count);
  }

  function renderLinksCampaignsTable(periodClicks) {
    const body = document.getElementById('linksCampaignsBody');
    if (!body) return;
    state.linksTableRows = buildLinkRows(periodClicks);
    const q = (document.getElementById('linksTableSearch')?.value || '').trim().toLowerCase();
    const rows = !q ? state.linksTableRows : state.linksTableRows.filter(r =>
      r.code.toLowerCase().includes(q) || (r.campaign || '').toLowerCase().includes(q));
    drawLinksCampaignsRows(rows);
  }

  function drawLinksCampaignsRows(rows) {
    const body = document.getElementById('linksCampaignsBody');
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = `<div class="data-row empty">No click activity in this period yet.</div>`;
      return;
    }
    body.innerHTML = rows.map(r => `
      <div class="data-row" data-code="${LT.escapeHtml(r.code)}">
        <div class="data-row-main">
          <span class="dt-name">
            <strong>${LT.escapeHtml(r.campaign || r.code)}</strong>
            ${r.campaign ? `<em>/${LT.escapeHtml(r.code)}</em>` : ''}
          </span>
          <span class="dt-num">${r.clicks.toLocaleString()}</span>
          <span class="dt-num">${r.users.toLocaleString()}</span>
          <span class="dt-platform">${LT.escapeHtml(r.topPlatform)}</span>
          <button class="dt-expand" type="button" aria-label="Show users who clicked">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5 6 8l3-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="data-row-detail" hidden></div>
      </div>`).join('');
  }

  document.getElementById('linksCampaignsBody')?.addEventListener('click', e => {
    const btn = e.target.closest('.dt-expand');
    if (!btn) return;
    const row = btn.closest('.data-row');
    const detail = row.querySelector('.data-row-detail');
    const wasOpen = !detail.hidden;
    detail.hidden = wasOpen;
    row.classList.toggle('open', !wasOpen);
    if (wasOpen) return;
    const rowData = state.linksTableRows.find(r => r.code === row.dataset.code);
    const users = visitorSummaryFor(rowData?.clickRows || []);
    detail.innerHTML = users.length
      ? `<div class="detail-list">${users.map(u => `
          <div class="detail-item"><span>${LT.escapeHtml(u.vid)}</span><span>${u.count} click${u.count === 1 ? '' : 's'}</span><span>${LT.timeAgo(u.last)}</span></div>`).join('')}</div>`
      : `<div class="detail-empty">No visitor data.</div>`;
  });

  document.getElementById('linksTableSearch')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    const rows = (state.linksTableRows || []).filter(r =>
      !q || r.code.toLowerCase().includes(q) || (r.campaign || '').toLowerCase().includes(q));
    drawLinksCampaignsRows(rows);
  });

  /* ══════════════════════════════════════════════
     USERS TABLE — per-visitor totals, expandable to their
     link/campaign-level click history.
  ══════════════════════════════════════════════ */
  function buildUserRows(periodClicks) {
    const byVisitor = {};
    periodClicks.forEach(c => { (byVisitor[c.visitor_id] ||= []).push(c); });

    return Object.entries(byVisitor).map(([vid, clicks]) => {
      const linkCodes = new Set(clicks.map(c => c.link_code));
      const last = clicks.reduce((a, b) => new Date(a.created_at) > new Date(b.created_at) ? a : b);
      return { vid, clicks: clicks.length, linksCount: linkCodes.size, last: last.created_at, clickRows: clicks };
    }).sort((a, b) => b.clicks - a.clicks);
  }

  function linkSummaryFor(clicks) {
    const byCode = {};
    clicks.forEach(c => { (byCode[c.link_code] ||= []).push(c); });
    return Object.entries(byCode).map(([code, list]) => {
      const meta = LT.state.links.find(l => l.code === code);
      const last = list.reduce((a, b) => new Date(a.created_at) > new Date(b.created_at) ? a : b);
      return { code, campaign: meta?.campaign_name || null, count: list.length, last: last.created_at };
    }).sort((a, b) => b.count - a.count);
  }

  function renderUsersTable(periodClicks) {
    const body = document.getElementById('usersTableBody');
    if (!body) return;
    state.usersTableRows = buildUserRows(periodClicks);
    const q = (document.getElementById('usersTableSearch')?.value || '').trim().toLowerCase();
    if (!q) { drawUsersRows(state.usersTableRows); return; }
    const rows = state.usersTableRows.filter(r => {
      if ((r.vid || '').toLowerCase().includes(q)) return true;
      return r.clickRows.some(c => {
        const meta = LT.state.links.find(l => l.code === c.link_code);
        return c.link_code?.toLowerCase().includes(q) || (meta?.campaign_name || '').toLowerCase().includes(q);
      });
    });
    drawUsersRows(rows);
  }

  function drawUsersRows(rows) {
    const body = document.getElementById('usersTableBody');
    if (!body) return;
    if (!rows.length) {
      body.innerHTML = `<div class="data-row empty">No visitors in this period yet.</div>`;
      return;
    }
    body.innerHTML = rows.map(r => `
      <div class="data-row" data-vid="${LT.escapeHtml(r.vid)}">
        <div class="data-row-main">
          <span class="dt-name"><strong>${LT.escapeHtml(r.vid || 'anonymous visitor')}</strong></span>
          <span class="dt-num">${r.clicks.toLocaleString()}</span>
          <span class="dt-platform">${r.linksCount.toLocaleString()} link${r.linksCount === 1 ? '' : 's'}</span>
          <span class="dt-platform dt-lastseen">${LT.timeAgo(r.last)}</span>
          <button class="dt-expand" type="button" aria-label="Show this visitor's clicks">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5 6 8l3-3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="data-row-detail" hidden></div>
      </div>`).join('');
  }

  document.getElementById('usersTableBody')?.addEventListener('click', e => {
    const btn = e.target.closest('.dt-expand');
    if (!btn) return;
    const row = btn.closest('.data-row');
    const detail = row.querySelector('.data-row-detail');
    const wasOpen = !detail.hidden;
    detail.hidden = wasOpen;
    row.classList.toggle('open', !wasOpen);
    if (wasOpen) return;
    const rowData = state.usersTableRows.find(r => r.vid === row.dataset.vid);
    const links = linkSummaryFor(rowData?.clickRows || []);
    detail.innerHTML = links.length
      ? `<div class="detail-list">${links.map(l => `
          <div class="detail-item"><span>${LT.escapeHtml(l.campaign || l.code)}</span><span>${l.count} click${l.count === 1 ? '' : 's'}</span><span>${LT.timeAgo(l.last)}</span></div>`).join('')}</div>`
      : `<div class="detail-empty">No click data.</div>`;
  });

  document.getElementById('usersTableSearch')?.addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    const rows = (state.usersTableRows || []).filter(r => {
      if (!q) return true;
      if ((r.vid || '').toLowerCase().includes(q)) return true;
      return r.clickRows.some(c => {
        const meta = LT.state.links.find(l => l.code === c.link_code);
        return c.link_code?.toLowerCase().includes(q) || (meta?.campaign_name || '').toLowerCase().includes(q);
      });
    });
    drawUsersRows(rows);
  });

  function renderGranularityUI() {
    document.querySelectorAll('.gran-btn').forEach(b => b.classList.toggle('active', b.dataset.gran === state.granularity));
    const nextBtn = document.getElementById('periodNext');
    if (nextBtn) nextBtn.disabled = state.offset >= 0;
    const unitLabel = state.granularity === 'day' ? 'Hour' : state.granularity === 'year' ? 'Month' : 'Day';
    setText('avgUnitLabel', unitLabel);
    setText('busiestUnitLabel', unitLabel);
  }

  function render() {
    const { links, clicksLog } = LT.state;
    const range = currentPeriodRange();
    const prevRange = previousPeriodRange();

    setText('periodLabel', periodLabelText(range));
    const titleUnit = state.granularity === 'day' ? 'Clicks' : state.granularity === 'year' ? 'Clicks' : 'Clicks';
    setText('bigChartTitle', `${titleUnit} — ${periodLabelText(range)}`);
    setText('statLabel1', state.granularity === 'day' ? 'Clicks Today' : state.granularity === 'year' ? 'Clicks This Year' : 'Clicks This Month');
    setText('statLabel3', state.granularity === 'day' ? 'Peak Hour' : state.granularity === 'year' ? 'Peak Month' : 'Peak Day');

    const periodClicks = clicksInRange(clicksLog, range);
    const prevPeriodClicks = clicksInRange(clicksLog, prevRange);

    const { labels, vals } = bucketClicks(clicksLog, range);
    chartLabels = labels; chartVals = vals;
    drawBigChart();

    // Stat 1: total clicks + change vs previous period
    const total = periodClicks.length;
    setText('statVal1', total.toLocaleString());
    const prevTotal = prevPeriodClicks.length;
    const pctChange = prevTotal === 0 ? (total > 0 ? 100 : 0) : Math.round(((total - prevTotal) / prevTotal) * 100);
    updateStatChange('statChange1', pctChange);

    // Stat 2: unique visitors in period
    const uniqueVisitors = LT.dedupeByVisitor(periodClicks);
    setText('statVal2', uniqueVisitors.length.toLocaleString());
    const prevUnique = LT.dedupeByVisitor(prevPeriodClicks).length;
    const pctChange2 = prevUnique === 0 ? (uniqueVisitors.length > 0 ? 100 : 0) : Math.round(((uniqueVisitors.length - prevUnique) / prevUnique) * 100);
    updateStatChange('statChange2', pctChange2);

    // Stat 3: peak bucket
    const maxVal = Math.max(...vals, 0);
    const peakIdx = vals.indexOf(maxVal);
    setText('statVal3', maxVal.toLocaleString());
    setText('statChange3Label', maxVal > 0 ? `${labels[peakIdx]} · ${maxVal.toLocaleString()} click${maxVal === 1 ? '' : 's'}` : 'No activity yet');

    // Mini stats under chart
    const avg = vals.length ? (total / vals.length) : 0;
    setText('avgStat', avg >= 10 ? Math.round(avg).toLocaleString() : avg.toFixed(1));
    setText('busiestStat', maxVal > 0 ? labels[peakIdx] : '—');
    setText('totalPeriodStat', total.toLocaleString());

    // Platform breakdown (stat 4 filled inside)
    renderPlatformBreakdown(periodClicks);

    // Link/campaign- and user-wise click + unique-visitor breakdown, both
    // scoped to the same selected period as the chart and stat cards above.
    renderLinksCampaignsTable(periodClicks);
    renderUsersTable(periodClicks);

    renderGranularityUI();
  }

  /* ══════════════════════════════════════════════
     DATA LOAD + REALTIME
  ══════════════════════════════════════════════ */
  async function loadAndRender({ silent = false } = {}) {
    if (!silent) {
      const status = document.getElementById('lastUpdated');
      if (status) status.textContent = 'Loading…';
    }
    await Promise.all([
      LT.loadLinks(),
      LT.loadClicks(),
      LT.loadCounts(),
      LT.loadCampaignJoins()
    ]);
    render();
    setText('lastUpdated', `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  }

  let refreshTimer = null;
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => loadAndRender({ silent: true }).catch(err => console.error('analytics.js: refresh failed:', err)), 400);
  }

  /* ══════════════════════════════════════════════
     CONTROLS — granularity toggle + period nav
  ══════════════════════════════════════════════ */
  document.getElementById('granularityToggle')?.addEventListener('click', e => {
    const btn = e.target.closest('.gran-btn');
    if (!btn) return;
    state.granularity = btn.dataset.gran;
    state.offset = 0;
    render();
  });
  document.getElementById('periodPrev')?.addEventListener('click', () => { state.offset -= 1; render(); });
  document.getElementById('periodNext')?.addEventListener('click', () => { if (state.offset < 0) { state.offset += 1; render(); } });

  document.addEventListener('DOMContentLoaded', () => {
    loadAndRender().catch(err => console.error('analytics.js: initial load failed:', err));
    LT.subscribeToChanges(scheduleRefresh);
    setInterval(() => loadAndRender({ silent: true }), 60000);
  });
})();
