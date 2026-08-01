import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";

const supabase = createClient(
  "https://jctdtavzpcxnvpebpyqx.supabase.co",
  "sb_publishable_QUrKq5DUY3pwmHv4HEjKCQ_bGFZi4VQ"
);

// How long a no-cookie click stays eligible to be matched back to an
// earlier visitor, under EITHER matching tier below (device fingerprint,
// or IP+OS fallback). Kept short on purpose: it's a heuristic, not an
// identity system, and a short window limits how often two different
// people on the same shared IP (office wifi, campus network, carrier
// NAT) or with coincidentally identical fingerprints could get merged
// into one "visitor". This is a lookback window only, not a delay —
// every click is still resolved and the dashboard updated immediately;
// the window just bounds how far back the match query searches.
const MATCH_WINDOW_MINUTES = 30;

// Salt so ip_hash isn't a trivial lookup table of hashed IPs. Override
// with an IP_HASH_SALT environment variable in Vercel for a private
// value; this constant is just a safe-by-default fallback.
const IP_HASH_SALT = process.env.IP_HASH_SALT || "link-tracker-v1";

function hashIp(ip) {
  if (!ip) return null;
  return createHash("sha256").update(IP_HASH_SALT + "|" + ip).digest("hex").slice(0, 32);
}

// ------------------------------------------------------------------
// Device fingerprint (highest-priority match signal)
// ------------------------------------------------------------------
// This is a header-based stand-in for a real client-side fingerprint.
// The tracking link resolves through this endpoint as a bare 302 — no
// HTML page ever loads in the visitor's browser — so there's no
// opportunity to run a JS fingerprinting library (canvas/audio/WebGL
// hashing, FingerprintJS, etc.) the way "device fingerprint" usually
// implies. Deliberately NOT combined with IP: it's meant to be an
// independent signal from the IP+OS fallback tier below, e.g. so the
// same phone recognized on wifi is still recognized after switching to
// cellular data.
//
// Built from the full raw User-Agent (exact browser + OS + build,
// rather than the parsed-down `browser`/`os` fields used elsewhere) plus
// Accept-Language and, where the browser sends them, Client Hints
// (sec-ch-ua / sec-ch-ua-platform / sec-ch-ua-platform-version /
// sec-ch-ua-mobile) — the most specific signal available without adding
// a page load. It's coarser than a real JS fingerprint: two different
// people on an identical phone model, OS version, browser version, and
// language locale could still collide. That's why it's only ever tier
// one — anything it misses still gets a chance to merge under the
// IP+OS fallback.
function computeFingerprint(req) {
  const ua = req.headers["user-agent"];
  if (!ua) return null; // no UA at all → nothing reliable to hash; fall through to IP+OS tier

  const parts = [
    ua,
    req.headers["accept-language"] || "",
    req.headers["sec-ch-ua"] || "",
    req.headers["sec-ch-ua-platform"] || "",
    req.headers["sec-ch-ua-platform-version"] || "",
    req.headers["sec-ch-ua-mobile"] || ""
  ];

  return createHash("sha256")
    .update(IP_HASH_SALT + "|fp|" + parts.join("|"))
    .digest("hex")
    .slice(0, 32);
}

function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || null;
}

// ------------------------------------------------------------------
// Lightweight User-Agent parsing (no external dependency required)
// ------------------------------------------------------------------
function parseUserAgent(ua) {
  ua = ua || "";

  let os = "Unknown";
  if (/windows nt/i.test(ua)) os = "Windows";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/mac os x/i.test(ua)) os = "macOS";
  else if (/cros/i.test(ua)) os = "ChromeOS";
  else if (/linux/i.test(ua)) os = "Linux";

  let browser = "Unknown";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\/|opera/i.test(ua)) browser = "Opera";
  else if (/crios/i.test(ua)) browser = "Chrome";
  else if (/fxios/i.test(ua)) browser = "Firefox";
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = "Chrome";
  else if (/firefox\//i.test(ua)) browser = "Firefox";
  else if (/safari\//i.test(ua) && /version\//i.test(ua)) browser = "Safari";

  let device = "Desktop";
  if (/ipad|tablet/i.test(ua)) device = "Tablet";
  else if (/mobile|iphone|android/i.test(ua)) device = "Mobile";

  return { os, browser, device };
}

// ------------------------------------------------------------------
// Returning-visitor cookie
// ------------------------------------------------------------------
function getCookie(req, name) {
  const header = req.headers.cookie || "";
  const match = header.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

// Only used if the database RPC call fails outright (see the try/catch
// around it below) — a last-resort ID so the redirect and cookie still
// work even when analytics logging is broken. crypto.randomUUID() (not
// Math.random()) so this fallback path can't itself introduce a visitor
// ID collision.
function genVisitorId() {
  return "v_" + randomUUID().replace(/-/g, "").slice(0, 16);
}

export default async function handler(req, res) {
  try {
    const { id, bc } = req.query;

    if (!id) {
      return res.status(400).send("Missing tracking code");
    }

    // ------------------------------------------------------------------
    // Pass 1: Brave-detection interstitial
    // ------------------------------------------------------------------
    // Brave deliberately sends the exact same User-Agent (and even the
    // same sec-ch-ua Client Hints) as Chrome, specifically so servers
    // can't tell them apart — that's a privacy feature of Brave, not a
    // bug here. The only reliable signal is the client-side
    // `navigator.brave` API, which only exists once a page has loaded
    // JS in the visitor's own browser. So on the very first hit (no
    // `bc` param yet) we serve a near-instant self-redirecting page that
    // runs that check, then immediately re-requests this same endpoint
    // with the result attached (?bc=1 / ?bc=0). Pass 2 below does the
    // real DB lookup, logging, and the actual 302 to the destination.
    // If JS is blocked, the <noscript> refresh still gets the visitor
    // through (just without Brave-specific credit — logged via normal
    // UA parsing instead).
    if (bc === undefined) {
      const safeId = encodeURIComponent(id);
      const chromeUrl = `/api/redirect?id=${safeId}&bc=0`;
      const braveUrl = `/api/redirect?id=${safeId}&bc=1`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Redirecting…</title>
<noscript><meta http-equiv="refresh" content="0;url=${chromeUrl}"></noscript>
</head><body>
<script>
(function () {
  function go(url) { window.location.replace(url); }
  try {
    if (navigator.brave && typeof navigator.brave.isBrave === "function") {
      navigator.brave.isBrave()
        .then(function (isBrave) { go(isBrave ? ${JSON.stringify(braveUrl)} : ${JSON.stringify(chromeUrl)}); })
        .catch(function () { go(${JSON.stringify(chromeUrl)}); });
    } else {
      go(${JSON.stringify(chromeUrl)});
    }
  } catch (e) {
    go(${JSON.stringify(chromeUrl)});
  }
})();
</script>
</body></html>`);
    }

    // ------------------------------------------------------------------
    // Pass 2: real lookup + logging + redirect (bc=0 or bc=1 present)
    // ------------------------------------------------------------------
    const { data, error } = await supabase
      .from("links")
      .select("*")
      .eq("code", id.toLowerCase())
      .single();

    if (error || !data || !data.original || !data.original.trim()) {
      return res.status(404).send("Tracking link not found");
    }

    // ---- Device / browser / OS ----
    const ua = req.headers["user-agent"] || "";
    const { os, browser: parsedBrowser, device } = parseUserAgent(ua);
    // bc=1 means the pass-1 interstitial confirmed navigator.brave client-side;
    // that overrides the UA parse, which would otherwise always say "Chrome"
    // (Brave intentionally mirrors Chrome's UA string).
    const browser = bc === "1" ? "Brave" : parsedBrowser;

    // ---- Geo (Vercel injects these headers automatically at the edge) ----
    const country = req.headers["x-vercel-ip-country"] || null;
    const countryCode = req.headers["x-vercel-ip-country"] || null;
    const city = req.headers["x-vercel-ip-city"]
      ? decodeURIComponent(req.headers["x-vercel-ip-city"])
      : null;

    const clientIp = getClientIp(req);
    const ipHash = hashIp(clientIp);
    const fingerprintHash = computeFingerprint(req);

    // Temporary diagnostic: fingerprint_hash has been showing up NULL in
    // the clicks table. computeFingerprint() only returns null when there's
    // no user-agent header at all, so this line pins down on the next
    // request whether that's actually happening (real browser clicks always
    // send one) or whether fingerprintHash is non-null here but still not
    // making it into the row — which would point at a stale deployment
    // instead. Safe to remove once confirmed.
    if (!fingerprintHash) {
      console.warn("fingerprintHash is null — user-agent header present:", Boolean(ua), "| raw ua:", ua || "(none)");
    }

    // ---- Visitor identity + click logging (one atomic call) ----
    // record_click_and_resolve_visitor() (see
    // atomic_visitor_resolution_migration.sql, updated by
    // fingerprint_and_30min_window_migration.sql) does everything that
    // used to be three separate steps here — check for a matching prior
    // click, insert this click, bump the counter — inside one locked
    // database transaction. That closes a race where rapid/concurrent
    // requests with no cookie yet (a burst of clicks before the first
    // response's Set-Cookie lands) could each see "no match found" at the
    // same time and mint their own visitor_id, splitting one real person
    // into several counted "visitors" even though the click total stayed
    // correct.
    //
    // When there's no cookie, matching runs in two tiers against the last
    // MATCH_WINDOW_MINUTES of clicks on this link: device fingerprint
    // first (highest priority), then IP+device+OS as a fallback if the
    // fingerprint didn't match (or wasn't available).
    //
    // Passing the cookie value straight into the function means: if a
    // cookie is present, it's used as-is (no lookup, no race — the browser
    // already resolved this identity on an earlier request). Only the
    // no-cookie path takes the lock and runs the two-tier match.
    const cookieVisitorId = getCookie(req, "ltv_id");

    const { data: resolvedVisitorId, error: rpcError } = await supabase.rpc(
      "record_click_and_resolve_visitor",
      {
        p_link_code: id.toLowerCase(),
        p_cookie_visitor_id: cookieVisitorId,
        p_fingerprint_hash: fingerprintHash,
        p_ip_hash: ipHash,
        p_device: device,
        p_os: os,
        p_browser: browser,
        p_country: country,
        p_country_code: countryCode,
        p_city: city,
        p_window_minutes: MATCH_WINDOW_MINUTES
      }
    );

    if (rpcError) console.error("Visitor resolution/logging failed:", rpcError);

    // Best-effort fallback so the returning-visitor cookie still gets set
    // even if the database call above failed outright — analytics staying
    // broken should never block the redirect itself.
    const visitorId = resolvedVisitorId || cookieVisitorId || genVisitorId();

    // Cookie is set every time (even when matched by device fallback) so
    // that *this* browser recognizes itself by cookie on the very next
    // visit, rather than needing the fallback lookup again.
    res.setHeader(
      "Set-Cookie",
      `ltv_id=${visitorId}; Max-Age=31536000; Path=/; SameSite=Lax`
    );

    let destination = data.original.trim();
    if (!/^https?:\/\//i.test(destination)) {
      destination = "https://" + destination;
    }

    return res.redirect(302, destination);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Internal server error");
  }
}
