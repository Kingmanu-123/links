/* =============================================
   OCEANGLASS DASHBOARD — app.js  v2
   ============================================= */
'use strict';

/* Background is now a static image (.ocean-bg in HTML/CSS) — the animated
   canvas ocean draw-loop and JS bubble spawner have been removed. */



/* ══════════════════════════════════════════════
   3. NUMBER COUNTER ANIMATION
══════════════════════════════════════════════ */
function animateCounter(el) {
  const target  = parseInt(el.dataset.target, 10);
  const divisor = parseFloat(el.dataset.divisor || '1');
  const suffix  = el.dataset.suffix || '';
  const dur     = 1600;
  const start   = performance.now();
  const ease    = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t;

  (function tick(now) {
    const pct = ease(Math.min((now - start) / dur, 1));
    const val = target * pct;
    el.textContent = divisor > 1
      ? (val / divisor).toFixed(1) + suffix
      : Math.floor(val).toLocaleString();
    if (pct < 1) requestAnimationFrame(tick);
  })(start);
}

const counterObs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { animateCounter(e.target); counterObs.unobserve(e.target); } });
}, { threshold: 0.4 });
document.querySelectorAll('.stat-value').forEach(el => counterObs.observe(el));


/* ══════════════════════════════════════════════
   4. MINI SPARKLINE CHARTS
══════════════════════════════════════════════ */
// Placeholder trend data shown only until dashboard-integration.js supplies
// real numbers via window.setSparkData() (see below) and calls
// drawAllSparklines() again — kept non-empty so the cards aren't blank
// during the brief window before the first Supabase query resolves.
const sparkData = {
  chart1: [0,0,0,0,0,0,0,0,0,0,0,0],
  chart2: [0,0,0,0,0,0,0,0,0,0,0,0],
  chart3: [0,0,0,0,0,0,0,0,0,0,0,0],
  chart4: [0,0,0,0,0,0,0,0,0,0,0,0],
};

// Lets an external script (dashboard-integration.js) replace one card's
// sparkline series with real data and redraw just that canvas.
window.setSparkData = function setSparkData(id, values) {
  if (!Array.isArray(values) || !values.length) return;
  sparkData[id] = values;
  drawSparkline(id);
};
const sparkColors = {
  chart1: { line:'#5b96ff', fill:'rgba(91,150,255,0.3)' },
  chart2: { line:'#00d4ff', fill:'rgba(0,212,255,0.26)' },
  chart3: { line:'#00b4d8', fill:'rgba(0,180,216,0.26)' },
  chart4: { line:'#b392f9', fill:'rgba(179,146,249,0.26)' },
};

function drawSparkline(id) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const PR  = window.devicePixelRatio || 1;
  const W   = canvas.offsetWidth  || 200;
  const H   = canvas.offsetHeight || 42;
  canvas.width  = W * PR;
  canvas.height = H * PR;
  ctx.scale(PR, PR);

  const data = sparkData[id];
  const col  = sparkColors[id];
  const min  = Math.min(...data), max = Math.max(...data);
  const rng  = max - min || 1;
  const pad  = 5;
  const xS   = (W - pad*2) / (data.length - 1);
  const pts  = data.map((v, i) => ({
    x: pad + i * xS,
    y: pad + (1 - (v - min) / rng) * (H - pad*2),
  }));

  // Fill
  const fill = ctx.createLinearGradient(0, 0, 0, H);
  fill.addColorStop(0, col.fill);
  fill.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.moveTo(pts[0].x, H);
  ctx.lineTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const c1x = pts[i-1].x + xS * 0.45;
    const c2x = pts[i].x   - xS * 0.45;
    ctx.bezierCurveTo(c1x, pts[i-1].y, c2x, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.lineTo(pts[pts.length-1].x, H);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const c1x = pts[i-1].x + xS * 0.45;
    const c2x = pts[i].x   - xS * 0.45;
    ctx.bezierCurveTo(c1x, pts[i-1].y, c2x, pts[i].y, pts[i].x, pts[i].y);
  }
  ctx.strokeStyle = col.line;
  ctx.lineWidth   = 1.8;
  ctx.lineCap     = 'round';
  ctx.stroke();

  // End dot
  const last = pts[pts.length-1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3, 0, Math.PI*2);
  ctx.fillStyle   = col.line;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
}

// Draw after layout settled, and redraw whenever the window is resized —
// otherwise the canvas keeps its stale bitmap resolution from the last
// draw while its CSS box (width:100%) resizes with it, so the browser
// stretches the old pixels to fit the new size instead of re-rendering
// crisp lines at the new dimensions. This is what caused the sparklines
// to look stretched/distorted after resizing the browser window (e.g.
// un-maximizing, or dragging it narrower) without a full page reload.
function drawAllSparklines() {
  Object.keys(sparkData).forEach(id => drawSparkline(id));
}
window.addEventListener('load', drawAllSparklines);

let sparklineResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(sparklineResizeTimer);
  sparklineResizeTimer = setTimeout(drawAllSparklines, 100);
});


/* ══════════════════════════════════════════════
   5. OVERVIEW ANALYTICS CHART
══════════════════════════════════════════════ */
(function initOverviewChart() {
  const canvas = document.getElementById('overviewChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const PR  = window.devicePixelRatio || 1;

  // Placeholder series shown only until dashboard-integration.js supplies
  // real per-day click totals via window.renderOverviewChart(). Reassigned
  // (not re-declared) below so render()/the mousemove handler always read
  // whatever the latest call passed in.
  let labels  = ['Day 1','Day 2','Day 3','Day 4','Day 5','Day 6','Day 7'];
  let vals    = [0, 0, 0, 0, 0, 0, 0];
  let yMax    = 10;
  let yTicks  = [0, Math.round(yMax/4), Math.round(yMax/2), Math.round(yMax*3/4), yMax];
  let peakIndex = vals.indexOf(Math.max(...vals));

  // Lets dashboard-integration.js swap in real data (e.g. daily click
  // counts for the last 7 days) and redraw with it. yMax defaults to a
  // headroom-padded value above the highest point when not given.
  window.renderOverviewChart = function renderOverviewChart(newLabels, newVals, newYMax) {
    if (!Array.isArray(newLabels) || !Array.isArray(newVals) || !newLabels.length) return;
    labels = newLabels;
    vals = newVals;
    const maxVal = Math.max(...vals, 1);
    yMax = newYMax || Math.ceil(maxVal * 1.25 / 5) * 5 || 5;
    yTicks = [0, yMax/4, yMax/2, yMax*3/4, yMax];
    peakIndex = vals.indexOf(Math.max(...vals));
    render();
  };

  function render() {
    const W = canvas.offsetWidth  || 400;
    const H = canvas.offsetHeight || 140;
    canvas.width  = W * PR;
    canvas.height = H * PR;
    ctx.scale(PR, PR);

    const padL = 40, padR = 12, padT = 12, padB = 28;
    const cW   = W - padL - padR;
    const cH   = H - padT - padB;
    ctx.clearRect(0, 0, W, H);

    // Y grid
    yTicks.forEach(tick => {
      const y = padT + cH * (1 - tick / yMax);
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0,180,220,0.08)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([3, 5]);
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + cW, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle    = 'rgba(122,173,204,0.7)';
      ctx.font         = '10px Inter,sans-serif';
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(tick >= 1000 ? Math.round(tick/1000)+'K' : Math.round(tick).toLocaleString(), padL - 5, y);
    });

    // X labels + points
    const xS  = cW / (vals.length - 1);
    const pts = vals.map((v, i) => ({
      x: padL + i * xS,
      y: padT + cH * (1 - v / yMax),
    }));

    labels.forEach((lbl, i) => {
      ctx.fillStyle    = 'rgba(122,173,204,0.7)';
      ctx.font         = '9.5px Inter,sans-serif';
      ctx.textBaseline = 'top';
      // The first/last labels sit exactly on the plot's left/right edge.
      // Centering them (old behavior) let roughly half the text run past
      // the canvas boundary — "May 30" rendered as "May 3". Anchoring the
      // end labels inward instead keeps the full text on-canvas.
      if (i === 0) {
        ctx.textAlign = 'left';
        ctx.fillText(lbl, pts[i].x - 2, padT + cH + 6);
      } else if (i === labels.length - 1) {
        ctx.textAlign = 'right';
        ctx.fillText(lbl, pts[i].x + 2, padT + cH + 6);
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(lbl, pts[i].x, padT + cH + 6);
      }
    });

    // Area
    const grad = ctx.createLinearGradient(0, padT, 0, padT + cH);
    grad.addColorStop(0,    'rgba(0,212,255,0.30)');
    grad.addColorStop(0.45, 'rgba(0,160,230,0.12)');
    grad.addColorStop(1,    'rgba(0,100,180,0)');

    ctx.beginPath();
    ctx.moveTo(pts[0].x, padT + cH);
    ctx.lineTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const c1x = pts[i-1].x + xS * 0.5;
      const c2x = pts[i].x   - xS * 0.5;
      ctx.bezierCurveTo(c1x, pts[i-1].y, c2x, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.lineTo(pts[pts.length-1].x, padT + cH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const c1x = pts[i-1].x + xS * 0.5;
      const c2x = pts[i].x   - xS * 0.5;
      ctx.bezierCurveTo(c1x, pts[i-1].y, c2x, pts[i].y, pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = 'rgba(0,212,255,0.92)';
    ctx.lineWidth   = 2.2;
    ctx.lineCap     = 'round';
    ctx.stroke();

    // Dots + tooltip on May 29
    pts.forEach((pt, i) => {
      const peak = i === peakIndex;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, peak ? 4.5 : 3, 0, Math.PI*2);
      ctx.fillStyle   = peak ? '#00d4ff' : 'rgba(0,212,255,0.8)';
      ctx.fill();
      ctx.strokeStyle = peak ? '#fff' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth   = peak ? 1.8 : 1.2;
      ctx.stroke();

      if (peak) {
        const tw = 74, th = 26, r = 5;
        // The tooltip used to always open to the right of its point
        // (tx = pt.x + 5). With only padR(=12)px of right margin and a
        // 74px-wide box, that ran the box (and its "...Views" text) off
        // the canvas whenever the peak point was this close to the right
        // edge — which is exactly the "48.6K View" clipping seen in
        // testing. Flip it to open leftward instead when there isn't
        // room on the right.
        const tx = (pt.x + 5 + tw > W - 2) ? (pt.x - tw - 5) : (pt.x + 5);
        const ty = pt.y - 32;
        ctx.fillStyle   = 'rgba(8,20,44,0.94)';
        ctx.strokeStyle = 'rgba(0,212,255,0.36)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(tx+r, ty); ctx.lineTo(tx+tw-r, ty);
        ctx.quadraticCurveTo(tx+tw, ty, tx+tw, ty+r);
        ctx.lineTo(tx+tw, ty+th-r);
        ctx.quadraticCurveTo(tx+tw, ty+th, tx+tw-r, ty+th);
        ctx.lineTo(tx+r, ty+th);
        ctx.quadraticCurveTo(tx, ty+th, tx, ty+th-r);
        ctx.lineTo(tx, ty+r);
        ctx.quadraticCurveTo(tx, ty, tx+r, ty);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle    = 'rgba(122,173,204,0.85)';
        ctx.font         = '8.5px Inter,sans-serif';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(labels[peakIndex] || '', tx+7, ty+12);
        ctx.fillStyle = '#00d4ff';
        ctx.font      = 'bold 9.5px Inter,sans-serif';
        const peakVal = vals[peakIndex] || 0;
        const peakText = peakVal >= 1000 ? (peakVal/1000).toFixed(1)+'K' : peakVal.toLocaleString();
        ctx.fillText(peakText + ' Clicks', tx+7, ty+23);
      }
    });
  }

  window.addEventListener('load', render);
  window.addEventListener('resize', render);

  // Hover crosshair
  canvas.addEventListener('mousemove', e => {
    const rect  = canvas.getBoundingClientRect();
    const mx    = e.clientX - rect.left;
    const W2    = canvas.offsetWidth || 400;
    const H2    = canvas.offsetHeight || 140;
    const padL  = 40, padR = 12, padT = 12, padB = 28;
    const xS    = (W2 - padL - padR) / (vals.length - 1);
    const pts   = vals.map((v, i) => ({ x: padL + i * xS, y: padT + (H2 - padT - padB) * (1 - v / yMax) }));
    let best = -1, bd = 18;
    pts.forEach((p, i) => { const d = Math.abs(mx - p.x); if (d < bd) { bd = d; best = i; } });
    render();
    if (best >= 0) {
      const pt = pts[best];
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = 'rgba(0,212,255,0.35)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(pt.x, padT);
      ctx.lineTo(pt.x, H2 - padB);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  });
  canvas.addEventListener('mouseleave', render);
})();


/* ══════════════════════════════════════════════
   6. SIDEBAR TOGGLE
══════════════════════════════════════════════ */
(function() {
  const sidebar   = document.getElementById('sidebar');
  const btn       = document.getElementById('sidebarToggle');
  const mobileBtn = document.getElementById('mobileMenuBtn');
  const backdrop  = document.getElementById('sidebarBackdrop');
  let collapsed = false;

  function isMobile() { return window.matchMedia('(max-width: 980px)').matches; }

  function openDrawer() {
    // The mobile drawer should always show the full sidebar (icons + labels),
    // even if it was left in the "collapsed" (icons-only) state on desktop.
    if (collapsed) {
      collapsed = false;
      sidebar.classList.remove('collapsed');
      btn.style.transform = '';
    }
    sidebar.classList.add('sidebar-open');
    backdrop.classList.add('visible');
  }
  function closeDrawer() {
    sidebar.classList.remove('sidebar-open');
    backdrop.classList.remove('visible');
  }

  // Desktop: the little arrow on the sidebar edge collapses it to icons-only.
  // Mobile: that same arrow (visible once the drawer is open) just closes the drawer.
  //
  // Collapsing NEVER touches --sb-w / the .app-shell grid track anymore.
  // The sidebar's own width (100% → 60px, right-aligned via margin-left:auto
  // in style.css) shrinks inside its own reserved column only. That means:
  //  - .main-content's column width never changes, so stat cards / mid-row
  //    cards / everything next to the sidebar stays perfectly static and
  //    never stretches when the sidebar opens or closes.
  //  - Because the sidebar hugs the right edge of its column while
  //    collapsing, it visually closes left→right (its left edge recedes
  //    toward the right), while .sidebar-toggle — anchored to the
  //    sidebar's right edge — never shifts position on screen.
  btn.addEventListener('click', () => {
    if (isMobile()) { closeDrawer(); return; }
    collapsed = !collapsed;
    // .collapsed drives the real fix (style.css): it sets width:60px on
    // .sidebar, zeroes .nav-item's horizontal padding, centers the icon,
    // and removes labels from layout with display:none so no phantom
    // space is left behind.
    sidebar.classList.toggle('collapsed', collapsed);
    btn.style.transform = collapsed ? 'translateY(-50%) rotate(180deg)' : '';
  });

  if (mobileBtn) mobileBtn.addEventListener('click', openDrawer);
  if (backdrop)  backdrop.addEventListener('click', closeDrawer);

  // Tapping a nav item on mobile should close the drawer
  sidebar.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => { if (isMobile()) closeDrawer(); });
  });

  // If the viewport grows back to desktop size, make sure the drawer state resets
  window.addEventListener('resize', () => { if (!isMobile()) closeDrawer(); });
})();


/* ══════════════════════════════════════════════
   7. NAV ACTIVE STATE
══════════════════════════════════════════════ */
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
  });
});


/* ══════════════════════════════════════════════
   8. CARD MOUSE-TRACK GLOW
══════════════════════════════════════════════ */
document.querySelectorAll('.stat-card, .glass-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width  * 100).toFixed(1);
    const y = ((e.clientY - r.top)  / r.height * 100).toFixed(1);
    card.style.background = `radial-gradient(circle at ${x}% ${y}%, rgba(0,212,255,0.08) 0%, rgba(8,22,48,0.58) 65%)`;
  });
  card.addEventListener('mouseleave', () => { card.style.background = ''; });
});


/* ══════════════════════════════════════════════
   9. PLAN BAR ANIMATE
══════════════════════════════════════════════ */
window.addEventListener('load', () => {
  const bar = document.getElementById('planBarFill');
  if (bar) { bar.style.width = '0%'; setTimeout(() => { bar.style.width = '78%'; }, 700); }
});


/* ══════════════════════════════════════════════
   10. RIPPLE ON BUTTONS
══════════════════════════════════════════════ */
document.querySelectorAll('.quick-action-btn, .btn-upgrade, .view-all-btn, .icon-btn').forEach(btn => {
  btn.addEventListener('click', function(e) {
    const r    = this.getBoundingClientRect();
    const rip  = document.createElement('span');
    const size = Math.max(r.width, r.height) * 1.6;
    rip.style.cssText = `
      position:absolute;border-radius:50%;
      width:${size}px;height:${size}px;
      left:${e.clientX-r.left-size/2}px;
      top:${e.clientY-r.top-size/2}px;
      background:rgba(0,212,255,0.16);
      transform:scale(0);pointer-events:none;
      animation:rippleAnim 0.5s ease-out forwards;
    `;
    if (getComputedStyle(this).position === 'static') this.style.position = 'relative';
    this.style.overflow = 'hidden';
    this.appendChild(rip);
    setTimeout(() => rip.remove(), 550);
  });
});


/* ══════════════════════════════════════════════
   11. SEARCH AUTOCOMPLETE
══════════════════════════════════════════════ */
(function() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  // Populated for real by dashboard-integration.js once links have loaded
  // (window.setSearchSuggestions). Starts empty rather than with fabricated
  // demo names, so a search typed before data has loaded just shows no
  // matches instead of fake ones.
  let suggestions = [];
  window.setSearchSuggestions = function setSearchSuggestions(list) {
    if (Array.isArray(list)) suggestions = list;
  };
  let dd = null;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (dd) { dd.remove(); dd = null; }
    if (!q) return;
    const hits = suggestions.filter(s => s.toLowerCase().includes(q));
    if (!hits.length) return;

    dd = document.createElement('ul');
    dd.style.cssText = 'position:absolute;top:calc(100% + 5px);left:0;right:0;background:rgba(6,14,30,0.97);border:1px solid rgba(0,212,255,0.2);border-radius:9px;list-style:none;padding:5px;z-index:9999;backdrop-filter:blur(20px);box-shadow:0 10px 36px rgba(0,0,0,0.5);';
    hits.forEach(h => {
      const li = document.createElement('li');
      li.textContent = h;
      li.style.cssText = 'padding:7px 10px;border-radius:6px;cursor:pointer;font-size:12.5px;color:rgba(223,244,255,0.88);transition:background 0.15s;';
      li.addEventListener('mouseenter', () => li.style.background = 'rgba(0,212,255,0.1)');
      li.addEventListener('mouseleave', () => li.style.background = '');
      li.addEventListener('click', () => { input.value = h; dd.remove(); dd = null; });
      dd.appendChild(li);
    });

    const wrap = input.closest('.search-bar');
    wrap.style.position = 'relative';
    wrap.appendChild(dd);
  });

  document.addEventListener('click', e => { if (dd && !e.target.closest('.search-bar')) { dd.remove(); dd = null; } });
})();


/* ══════════════════════════════════════════════
   12. NOTIFICATION DOT
══════════════════════════════════════════════ */
document.getElementById('notifBtn')?.addEventListener('click', function() {
  const dot = this.querySelector('.notif-dot');
  if (dot) { dot.style.transition = 'opacity .3s'; dot.style.opacity = '0'; setTimeout(() => dot.remove(), 320); }
});


/* ══════════════════════════════════════════════
   13. USER DROPDOWN
══════════════════════════════════════════════ */
(function() {
  const profile = document.getElementById('userProfile');
  if (!profile) return;
  let menu = null;

  profile.addEventListener('click', e => {
    e.stopPropagation();
    if (menu) { menu.remove(); menu = null; return; }
    menu = document.createElement('div');
    menu.style.cssText = 'position:absolute;top:calc(100% + 7px);right:0;background:rgba(6,14,30,0.97);border:1px solid rgba(0,212,255,0.2);border-radius:11px;min-width:170px;z-index:9999;backdrop-filter:blur(22px);box-shadow:0 14px 44px rgba(0,0,0,0.6);padding:5px;';
    [['👤','My Profile'],['⚙️','Settings'],['🔑','API Keys'],['💳','Billing'],['🚪','Sign Out']].forEach(([ico,lbl],i) => {
      const row = document.createElement('div');
      row.style.cssText = `display:flex;align-items:center;gap:9px;padding:8px 11px;border-radius:7px;cursor:pointer;font-size:12.5px;color:rgba(223,244,255,0.88);transition:background .15s;${i===4?'margin-top:3px;border-top:1px solid rgba(0,212,255,0.1);':''}`;
      row.innerHTML = `<span>${ico}</span><span>${lbl}</span>`;
      row.addEventListener('mouseenter', () => row.style.background = 'rgba(0,212,255,0.1)');
      row.addEventListener('mouseleave', () => row.style.background = '');
      menu.appendChild(row);
    });
    profile.appendChild(menu);
  });
  document.addEventListener('click', () => { if (menu) { menu.remove(); menu = null; } });
})();


/* ══════════════════════════════════════════════
   14. REVEAL ANIMATION
══════════════════════════════════════════════ */
window.addEventListener('load', () => {
  const obs = new IntersectionObserver(entries => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 55);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
});


/* ══════════════════════════════════════════════
   15. PLATFORM BAR ANIMATION
══════════════════════════════════════════════ */
window.addEventListener('load', () => {
  document.querySelectorAll('.platform-bar-fill').forEach(bar => {
    const w = bar.style.width; bar.style.width = '0';
    setTimeout(() => { bar.style.width = w; }, 500);
  });
});


/* ══════════════════════════════════════════════
   16. ACTIVITY TICKER
══════════════════════════════════════════════ */
(function() {
  // Populated for real by dashboard-integration.js from actual click
  // events (window.setActivityFeed). Starts with a single placeholder
  // entry rather than fabricated names/actions.
  let acts = [
    { user: 'Link Tracker', action: 'waiting for activity…', url: '', time: '' }
  ];
  let idx = 0;
  const item = document.getElementById('activityItem');
  if (!item) return;

  function showCurrent() {
    const a = acts[idx];
    item.style.opacity   = '0';
    item.style.transform = 'translateY(5px)';
    setTimeout(() => {
      item.querySelector('.activity-desc').innerHTML = `<strong>${a.user}</strong> ${a.action}`;
      item.querySelector('.activity-url').textContent = a.url;
      item.querySelector('.activity-time').textContent = a.time;
      item.style.transition = 'opacity .38s ease, transform .38s ease';
      item.style.opacity    = '1';
      item.style.transform  = 'none';
    }, 280);
  }

  window.setActivityFeed = function setActivityFeed(list) {
    if (Array.isArray(list) && list.length) { acts = list; idx = 0; showCurrent(); }
  };

  setInterval(() => {
    idx = (idx + 1) % acts.length;
    showCurrent();
  }, 5000);
})();


/* ══════════════════════════════════════════════
   17. LINK ITEM SELECTION
══════════════════════════════════════════════ */
document.querySelectorAll('.link-item').forEach(item => {
  item.addEventListener('click', function() {
    document.querySelectorAll('.link-item').forEach(i => { i.style.background = ''; i.style.borderColor = ''; });
    this.style.background  = 'rgba(0,212,255,0.09)';
    this.style.borderColor = 'rgba(0,212,255,0.28)';
  });
});
