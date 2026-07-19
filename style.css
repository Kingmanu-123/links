/* ==========================================================================
   LINK TRACKER — Cosmic Dashboard Redesign
   Design tokens, glass panels, starfield backdrop
   ========================================================================== */

:root {
  /* ---- Palette ---- */
  --bg-deep:        #0a0d1c;
  --bg-deep-alt:     #0d1128;
  --panel:          rgba(22, 26, 51, 0.62);
  --panel-solid:    #171b32;
  --panel-border:   rgba(148, 158, 214, 0.16);
  --panel-border-soft: rgba(148, 158, 214, 0.09);
  --input-bg:       rgba(10, 13, 28, 0.55);

  --teal:           #2dd4bf;
  --teal-bright:    #5eead4;
  --teal-dark:      #0f9c8c;
  --purple:         #8b7bf6;
  --purple-bright:  #a78bfa;
  --green:          #34d399;
  --amber:          #fbbf24;
  --red:            #f87171;

  --text-1:         #eef0fb;
  --text-2:         #a8adc9;
  --text-3:         #6d7292;

  /* ---- Type ---- */
  --font-display: 'Space Grotesk', 'Segoe UI', sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'IBM Plex Mono', 'SFMono-Regular', Consolas, monospace;

  /* ---- Misc ---- */
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-pill: 999px;
  --transition-fast: 0.15s ease;
  --transition-med: 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/*
 * IMPORTANT: several components below (.page, .preview-created,
 * .preview-placeholder, .kebab-menu, .sort-menu) declare their own
 * `display: flex`. Because an author stylesheet always wins over the
 * browser's built-in `[hidden] { display: none }` rule at equal
 * specificity, those components would otherwise stay visually
 * visible even after JS sets `element.hidden = true`. This single
 * rule restores native hidden-attribute behavior everywhere.
 */
[hidden] {
  display: none !important;
}

html {
  color-scheme: dark;
}

html, body {
  max-width: 100%;
  overflow-x: hidden;
}

body {
  font-family: var(--font-body);
  background: var(--bg-deep);
  color: var(--text-1);
  min-height: 100vh;
  position: relative;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}

a:focus-visible,
button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--teal);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* ==========================================================================
   Cosmic backdrop: nebula glows + starfield
   ========================================================================== */

.cosmos {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  background: var(--bg-deep);
}

.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.55;
}

.glow--a {
  width: 620px;
  height: 620px;
  top: -220px;
  left: -160px;
  background: radial-gradient(circle, rgba(139, 123, 246, 0.55), transparent 70%);
  animation: drift-a 22s ease-in-out infinite alternate;
}

.glow--b {
  width: 560px;
  height: 560px;
  bottom: -260px;
  right: -180px;
  background: radial-gradient(circle, rgba(45, 212, 191, 0.35), transparent 70%);
  animation: drift-b 26s ease-in-out infinite alternate;
}

@keyframes drift-a {
  to { transform: translate(60px, 40px); }
}

@keyframes drift-b {
  to { transform: translate(-50px, -30px); }
}

.stars {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1.5px 1.5px at 10% 20%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1.5px 1.5px at 80% 10%, rgba(255,255,255,0.4), transparent),
    radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.35), transparent),
    radial-gradient(1.5px 1.5px at 30% 85%, rgba(255,255,255,0.4), transparent),
    radial-gradient(1px 1px at 90% 60%, rgba(255,255,255,0.3), transparent),
    radial-gradient(1.5px 1.5px at 45% 40%, rgba(255,255,255,0.35), transparent),
    radial-gradient(1px 1px at 20% 55%, rgba(255,255,255,0.3), transparent);
  background-repeat: repeat;
  background-size: 340px 340px;
  opacity: 0.8;
}

@media (prefers-reduced-motion: reduce) {
  .glow--a, .glow--b { animation: none; }
}

/* ---- Snowy mountain range, fixed to the bottom of the backdrop ---- */

.mountains {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -2px;
  width: 100%;
  height: 34vh;
  min-height: 180px;
  background-repeat: no-repeat;
  background-position: bottom center;
  background-size: cover;
  opacity: 0.9;
}

.mountains--back {
  height: 40vh;
  min-height: 220px;
  opacity: 0.35;
  background-image:
    linear-gradient(160deg, rgba(148, 158, 214, 0.16), rgba(148, 158, 214, 0.03)),
    conic-gradient(from 0deg at 10% 100%, transparent 0deg);
  clip-path: polygon(0% 100%, 0% 55%, 8% 40%, 16% 62%, 24% 30%, 33% 58%, 42% 25%, 52% 60%, 61% 38%, 70% 66%, 79% 22%, 88% 52%, 96% 34%, 100% 58%, 100% 100%);
  background-color: rgba(148, 158, 214, 0.1);
}

.mountains--front {
  height: 26vh;
  min-height: 130px;
  opacity: 0.6;
  clip-path: polygon(0% 100%, 0% 70%, 6% 48%, 14% 68%, 22% 42%, 30% 66%, 40% 36%, 50% 70%, 58% 46%, 68% 72%, 76% 40%, 86% 64%, 94% 44%, 100% 68%, 100% 100%);
  background: linear-gradient(180deg, #dfe4f7 0%, #b9c0e0 55%, #8890b8 100%);
}

/* ---- Falling snow ---- */

.snowfall {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.snow-layer {
  position: absolute;
  inset: -10% 0 0 0;
  background-repeat: repeat;
  opacity: 0.55;
}

.snow-layer--1 {
  background-image:
    radial-gradient(2px 2px at 12% 10%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 44% 30%, #fff, transparent),
    radial-gradient(2px 2px at 68% 15%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 85% 40%, #fff, transparent),
    radial-gradient(2px 2px at 25% 55%, #fff, transparent);
  background-size: 320px 320px;
  animation: snow-fall 14s linear infinite;
  opacity: 0.5;
}

.snow-layer--2 {
  background-image:
    radial-gradient(1.5px 1.5px at 20% 20%, #fff, transparent),
    radial-gradient(1px 1px at 55% 45%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 78% 25%, #fff, transparent),
    radial-gradient(1px 1px at 92% 60%, #fff, transparent),
    radial-gradient(1.5px 1.5px at 35% 75%, #fff, transparent);
  background-size: 260px 260px;
  animation: snow-fall 10s linear infinite;
  opacity: 0.4;
}

.snow-layer--3 {
  background-image:
    radial-gradient(2.5px 2.5px at 8% 35%, #fff, transparent),
    radial-gradient(2px 2px at 48% 12%, #fff, transparent),
    radial-gradient(2.5px 2.5px at 72% 50%, #fff, transparent),
    radial-gradient(2px 2px at 90% 20%, #fff, transparent);
  background-size: 400px 400px;
  animation: snow-fall 20s linear infinite;
  opacity: 0.3;
}

@keyframes snow-fall {
  from { transform: translateY(-15%); }
  to { transform: translateY(115%); }
}

@media (prefers-reduced-motion: reduce) {
  .snow-layer { animation: none; }
}

/* ==========================================================================
   Page shell
   ========================================================================== */

.page {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  padding: 2.5rem 1.25rem 4rem;
  min-height: 100vh;
  overflow-x: hidden;
}

.shell {
  width: 100%;
  max-width: 1080px;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  min-width: 0;
}

.shell--narrow {
  max-width: 760px;
}

/* Glassmorphism panel base */
.panel {
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
}

/* ==========================================================================
   Header
   ========================================================================== */

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1.25rem;
}

.header-search {
  flex: 1 1 240px;
  max-width: 360px;
  order: 2;
}

.stat-pills {
  order: 3;
}

@media (max-width: 760px) {
  .header-search {
    order: 3;
    max-width: none;
    flex-basis: 100%;
  }
  .stat-pills {
    order: 2;
  }
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.brand-icon {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0a0d1c;
  background: radial-gradient(circle at 50% 45%, var(--teal-bright) 0%, var(--teal) 45%, var(--purple) 100%);
  box-shadow: 0 0 0 1px rgba(94, 234, 212, 0.25), 0 8px 24px rgba(45, 212, 191, 0.45), 0 0 26px rgba(94, 234, 212, 0.35);
  flex-shrink: 0;
}

.brand-icon svg {
  width: 22px;
  height: 22px;
}

.brand-icon--sm {
  width: 34px;
  height: 34px;
  border-radius: 50%;
}

.brand-icon--sm svg {
  width: 17px;
  height: 17px;
}

.brand-text h1 {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-1);
  line-height: 1.15;
}

.brand-text h1 .accent,
.brand--sm h2 .accent {
  background: linear-gradient(120deg, var(--teal-bright), var(--teal));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.brand-text p {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--teal);
}

.brand--sm h2 {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-1);
}

.stat-pills {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.stat-pill {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 1rem;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-pill);
  backdrop-filter: blur(14px);
}

.stat-pill-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-pill-icon svg {
  width: 14px;
  height: 14px;
}

.stat-pill-icon--teal {
  background: rgba(45, 212, 191, 0.16);
  color: var(--teal-bright);
}

.stat-pill-icon--purple {
  background: rgba(139, 123, 246, 0.18);
  color: var(--purple-bright);
}

.stat-pill-value {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-1);
}

.stat-pill-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* ==========================================================================
   Workspace split
   ========================================================================== */

.workspace {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.25rem;
  align-items: stretch;
}

@media (min-width: 800px) {
  .workspace {
    grid-template-columns: 1fr 1fr;
  }
}

.create-panel,
.preview-panel {
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.35rem;
}

.create-panel h2,
.history-head h2,
.all-links-title {
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-1);
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.icon-badge {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--purple), var(--teal));
  color: #fff;
  flex-shrink: 0;
}

.icon-badge svg {
  width: 14px;
  height: 14px;
}

/* Fields */

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--text-2);
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-icon {
  position: absolute;
  left: 0.9rem;
  color: var(--text-3);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.input-icon svg {
  width: 16px;
  height: 16px;
}

.input-icon--hash {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 0.95rem;
}

.input-wrap input {
  width: 100%;
  padding: 0.85rem 0.95rem 0.85rem 2.6rem;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  font-size: 0.92rem;
  font-family: var(--font-body);
  background-color: var(--input-bg);
  color: var(--text-1);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.input-wrap input::placeholder {
  color: var(--text-3);
}

.input-wrap input:focus {
  outline: none;
  border-color: var(--teal);
  box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.16);
}

.field-error {
  font-size: 0.78rem;
  color: var(--red);
  font-weight: 500;
}

/* Create CTA button */

.btn-cta {
  background: linear-gradient(135deg, var(--teal-bright), var(--teal-dark));
  background-size: 200% 200%;
  background-position: 0% 50%;
  color: #08221f;
  border: none;
  border-radius: var(--radius-sm);
  padding: 0.95rem 1.25rem;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.98rem;
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast), opacity var(--transition-fast), background var(--transition-med), background-position var(--transition-med);
  box-shadow: 0 10px 26px rgba(45, 212, 191, 0.25);
}

.btn-cta svg {
  width: 17px;
  height: 17px;
}

.btn-cta:hover:not(:disabled) {
  background-image: linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6);
  background-position: 100% 50%;
  color: #0a0d1c;
  transform: translateY(-1px);
  box-shadow: 0 14px 32px rgba(167, 139, 250, 0.4);
}

.btn-cta:active:not(:disabled) {
  transform: translateY(0);
}

.btn-cta:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ==========================================================================
   Preview / receipt panel
   ========================================================================== */

.preview-panel {
  justify-content: center;
}

.preview-placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  min-height: 240px;
  color: var(--text-3);
  text-align: center;
  padding: 1.5rem;
}

.ph-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(148, 158, 214, 0.08);
  color: var(--text-3);
}

.ph-icon svg {
  width: 24px;
  height: 24px;
}

.preview-placeholder p {
  font-size: 0.85rem;
  max-width: 22ch;
}

.preview-created {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.35rem;
}

.preview-check {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(52, 211, 153, 0.14);
  color: var(--green);
  margin-bottom: 0.4rem;
}

.preview-check svg {
  width: 26px;
  height: 26px;
}

.preview-created h3 {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--text-1);
}

.preview-sub {
  font-size: 0.82rem;
  color: var(--text-3);
  margin-bottom: 0.85rem;
}

.preview-url-box {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  background: rgba(45, 212, 191, 0.1);
  border: 1px solid rgba(45, 212, 191, 0.3);
  border-radius: var(--radius-sm);
  padding: 0.75rem 0.9rem;
  margin-bottom: 1.1rem;
}

.preview-url-box span {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--teal-bright);
  word-break: break-all;
  text-align: left;
}

.preview-url-box button {
  flex-shrink: 0;
  background: transparent;
  border: none;
  color: var(--teal-bright);
  cursor: pointer;
  display: flex;
  padding: 0.2rem;
  transition: transform var(--transition-fast);
}

.preview-url-box button:hover {
  transform: scale(1.1);
}

.preview-url-box button svg {
  width: 16px;
  height: 16px;
}

.preview-grid {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem 1rem;
  text-align: left;
  margin-bottom: 1.3rem;
}

.preview-grid > div {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.preview-grid label {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.preview-grid span {
  font-size: 0.86rem;
  color: var(--text-1);
  font-weight: 500;
}

.badge-active {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  width: max-content;
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--green);
  background: rgba(52, 211, 153, 0.14);
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-pill);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.badge-active i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--green);
  display: inline-block;
}

.preview-actions {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.btn-outline,
.btn-solid {
  padding: 0.75rem;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 0.86rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: center;
  transition: transform var(--transition-fast), background var(--transition-fast);
}

.btn-outline {
  background: transparent;
  color: var(--text-1);
  border: 1px solid var(--panel-border);
}

.btn-outline:hover {
  background: rgba(148, 158, 214, 0.08);
  transform: translateY(-1px);
}

.btn-solid {
  background: linear-gradient(135deg, var(--teal-bright), var(--teal-dark));
  color: #08221f;
  border: none;
}

.btn-solid:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 24px rgba(45, 212, 191, 0.28);
}

/* ==========================================================================
   Tracking history
   ========================================================================== */

.history-panel {
  display: flex;
  flex-direction: column;
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 1.4rem 1.75rem;
  border-bottom: 1px solid var(--panel-border-soft);
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: rgba(148, 158, 214, 0.08);
  border: 1px solid var(--panel-border);
  color: var(--text-1);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.5rem 0.9rem;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background var(--transition-fast), transform var(--transition-fast);
}

.btn-ghost svg {
  width: 15px;
  height: 15px;
}

.btn-ghost:hover {
  background: rgba(148, 158, 214, 0.16);
  transform: translateY(-1px);
}

.link-list {
  display: flex;
  flex-direction: column;
  max-height: 460px;
  overflow-y: auto;
}

.link-list--full {
  max-height: none;
}

.link-list::-webkit-scrollbar {
  width: 8px;
}

.link-list::-webkit-scrollbar-track {
  background: transparent;
}

.link-list::-webkit-scrollbar-thumb {
  background: var(--panel-border);
  border-radius: 4px;
}

/* Row */

.link-row {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  padding: 1rem 1.75rem;
  border-bottom: 1px solid var(--panel-border-soft);
  transition: background var(--transition-fast);
  position: relative;
}

.link-row:last-child {
  border-bottom: none;
}

.link-row:hover {
  background: rgba(148, 158, 214, 0.05);
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.row-code {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--teal-bright);
  cursor: pointer;
  font-size: 0.98rem;
  width: max-content;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-code:hover {
  text-decoration: underline;
}

.row-url {
  font-size: 0.8rem;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-meta {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  flex-wrap: wrap;
  margin-top: 0.1rem;
}

.row-date {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.74rem;
  color: var(--text-3);
}

.row-date svg {
  width: 12px;
  height: 12px;
}

.row-clicks {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
  min-width: 64px;
  text-align: right;
}

/* 1-2 digit counts center-align; 3+ digit counts stay right-aligned (default above) */
.row-clicks.clicks-center {
  align-items: center;
  text-align: center;
}

.clicks-num {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--amber);
  line-height: 1.2;
}

.clicks-label {
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 0.06em;
}

.row-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(139, 123, 246, 0.35), rgba(45, 212, 191, 0.25));
  color: var(--teal-bright);
  overflow: hidden;
}

.row-icon svg {
  width: 17px;
  height: 17px;
}

.row-icon.row-icon--flag {
  border: 2px solid rgba(255, 255, 255, 0.85);
  background-color: #fff;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 180%;
}

.row-menu {
  position: relative;
  flex-shrink: 0;
}

.kebab-btn {
  background: transparent;
  border: none;
  color: var(--text-3);
  font-size: 1.3rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.35rem 0.5rem;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.kebab-btn:hover {
  background: rgba(148, 158, 214, 0.1);
  color: var(--text-1);
}

.kebab-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: var(--panel-solid);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  min-width: 140px;
  overflow: hidden;
  z-index: 20;
}

.kebab-menu button {
  background: transparent;
  border: none;
  text-align: left;
  padding: 0.6rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-1);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.kebab-menu button:hover {
  background: rgba(148, 158, 214, 0.1);
}

.kebab-menu button[data-action="delete"] {
  color: var(--red);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3.5rem 2rem;
  color: var(--text-3);
  gap: 0.6rem;
  text-align: center;
}

.empty-state .icon {
  font-size: 1.8rem;
  opacity: 0.7;
}

.history-foot {
  padding: 0.9rem 1.75rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-3);
  border-top: 1px solid var(--panel-border-soft);
}

/* ==========================================================================
   All Links view
   ========================================================================== */

.all-links-top {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--panel);
  border: 1px solid var(--panel-border);
  color: var(--text-1);
  font-size: 0.84rem;
  font-weight: 600;
  padding: 0.55rem 0.95rem;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background var(--transition-fast), transform var(--transition-fast);
  backdrop-filter: blur(14px);
}

.btn-back svg {
  width: 15px;
  height: 15px;
}

.btn-back:hover {
  background: rgba(148, 158, 214, 0.14);
  transform: translateX(-1px);
}

.all-links-panel {
  padding: 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.search-wrap svg {
  position: absolute;
  left: 0.9rem;
  width: 16px;
  height: 16px;
  color: var(--text-3);
  pointer-events: none;
}

.search-wrap input {
  width: 100%;
  padding: 0.8rem 0.95rem 0.8rem 2.6rem;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  font-size: 0.88rem;
  background-color: var(--input-bg);
  color: var(--text-1);
  font-family: var(--font-body);
}

.search-wrap input::placeholder {
  color: var(--text-3);
}

.search-wrap--header input {
  border-radius: var(--radius-pill);
  padding-right: 2.6rem;
  background-color: var(--panel);
  backdrop-filter: blur(14px);
}

.header-search-go {
  position: absolute;
  right: 0.35rem;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--teal-bright), var(--teal-dark));
  color: #08221f;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform var(--transition-fast);
}

.header-search-go svg {
  width: 14px;
  height: 14px;
}

.header-search-go:hover {
  transform: translateY(-1px) scale(1.05);
}

.search-wrap input:focus {
  outline: none;
  border-color: var(--teal);
  box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.16);
}

.controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-pill {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-2);
  background: rgba(148, 158, 214, 0.08);
  border: 1px solid var(--panel-border);
  padding: 0.45rem 0.9rem;
  border-radius: var(--radius-pill);
}

.sort-wrap {
  position: relative;
}

.sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(148, 158, 214, 0.08);
  border: 1px solid var(--panel-border);
  color: var(--text-1);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.45rem 0.85rem;
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.sort-btn svg {
  width: 13px;
  height: 13px;
}

.sort-btn:hover {
  background: rgba(148, 158, 214, 0.16);
}

.sort-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  background: var(--panel-solid);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  min-width: 160px;
  overflow: hidden;
  z-index: 20;
}

.sort-menu button {
  background: transparent;
  border: none;
  text-align: left;
  padding: 0.6rem 0.9rem;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-1);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.sort-menu button:hover {
  background: rgba(148, 158, 214, 0.1);
}

.sort-menu button.active {
  color: var(--teal-bright);
  font-weight: 700;
}

/* ==========================================================================
   Toast notification
   ========================================================================== */

.toast-alert {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%) translateY(100px);
  background-color: var(--panel-solid);
  color: var(--text-1);
  padding: 0.8rem 1.5rem 0.8rem 1.3rem;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  z-index: 9999;
  opacity: 0;
  transition: transform var(--transition-med), opacity var(--transition-med);
  pointer-events: none;
  border: 1px solid var(--panel-border);
  max-width: 90vw;
  isolation: isolate;
}

/* Accent bar as a pseudo-element rather than border-left: a differently
   coloured border-left combined with border-radius causes the corner
   miter to render as a detached curved bracket in some browsers. A
   pseudo-element avoids the border-join glitch entirely. */
.toast-alert::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: var(--radius-sm) 0 0 var(--radius-sm);
  background: var(--teal);
}

.toast-alert.show {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  display: block;
}

/* ==========================================================================
   Responsive — 320 through 1920
   ========================================================================== */

@media (min-width: 1400px) {
  .shell {
    max-width: 1180px;
  }
}

@media (max-width: 900px) {
  .shell {
    max-width: 100%;
  }
}

@media (max-width: 640px) {
  .page {
    padding: 1.5rem 0.9rem 3rem;
  }

  .shell {
    gap: 1.4rem;
  }

  .brand-text h1 {
    font-size: 1.25rem;
  }

  .stat-pills {
    width: 100%;
  }

  .stat-pill {
    flex: 1;
    justify-content: center;
  }

  .create-panel,
  .preview-panel,
  .all-links-panel {
    padding: 1.25rem;
  }

  .history-head {
    padding: 1.1rem 1.25rem;
  }

  .link-row {
    padding: 0.9rem 1.25rem;
    flex-wrap: wrap;
  }

  .row-main {
    order: 1;
    flex-basis: calc(100% - 48px);
  }

  .row-clicks {
    order: 3;
    flex-direction: row;
    align-items: baseline;
    gap: 0.3rem;
    margin-left: calc(38px + 0.9rem);
  }

  .row-menu {
    order: 2;
  }

  .preview-grid {
    grid-template-columns: 1fr;
  }

  .preview-actions {
    grid-template-columns: 1fr;
  }

  .history-foot {
    padding: 0.8rem 1.25rem;
  }

  .controls-row {
    flex-direction: column;
    align-items: stretch;
  }

  .sort-wrap {
    width: 100%;
  }

  .sort-btn {
    width: 100%;
    justify-content: space-between;
  }

  .sort-menu {
    left: 0;
    right: 0;
  }
}

@media (max-width: 380px) {
  .brand-text h1 {
    font-size: 1.1rem;
  }

  .brand-text p {
    font-size: 0.6rem;
  }

  .stat-pill-label {
    display: none;
  }

  .input-wrap input,
  .search-wrap input {
    font-size: 0.85rem;
  }

  .row-clicks {
    margin-left: 0.6rem;
  }
}
