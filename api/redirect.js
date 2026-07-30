import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const supabase = createClient(
  "https://jctdtavzpcxnvpebpyqx.supabase.co",
  "sb_publishable_QUrKq5DUY3pwmHv4HEjKCQ_bGFZi4VQ"
);

// How long a device fingerprint (IP + device type + OS) stays eligible to
// be matched back to an earlier visitor when there's no cookie to go on
// (private/incognito windows, or a different browser on the same
// machine). Kept short-ish on purpose: it's a heuristic, not an identity
// system, and a shorter window limits how often two different people on
// the same shared IP (office wifi, campus network, carrier NAT) could
// get merged into one "visitor".
const DEVICE_MATCH_WINDOW_HOURS = 12;

// Salt so ip_hash isn't a trivial lookup table of hashed IPs. Override
// with an IP_HASH_SALT environment variable in Vercel for a private
// value; this constant is just a safe-by-default fallback.
const IP_HASH_SALT = process.env.IP_HASH_SALT || "link-tracker-v1";

function hashIp(ip) {
  if (!ip) return null;
  return createHash("sha256").update(IP_HASH_SALT + "|" + ip).digest("hex").slice(0, 32);
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

function genVisitorId() {
  return "v_" + (Math.random().toString(16).slice(2, 8) + Math.random().toString(16).slice(2, 4)).padEnd(8, "0");
}

export default async function handler(req, res) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).send("Missing tracking code");
    }

    const { data, error } = await supabase
      .from("links")
      .select("*")
      .eq("code", id.toLowerCase())
      .single();

    if (error || !data) {
      return res.status(404).send("Tracking link not found");
    }

    // ---- Device / browser / OS ----
    const ua = req.headers["user-agent"] || "";
    const { os, browser, device } = parseUserAgent(ua);

    // ---- Geo (Vercel injects these headers automatically at the edge) ----
    const country = req.headers["x-vercel-ip-country"] || null;
    const countryCode = req.headers["x-vercel-ip-country"] || null;
    const city = req.headers["x-vercel-ip-city"]
      ? decodeURIComponent(req.headers["x-vercel-ip-city"])
      : null;

    const clientIp = getClientIp(req);
    const ipHash = hashIp(clientIp);

    // ---- Visitor identity ----
    // 1. Cookie, if present — this is the strongest signal (same browser,
    //    same profile, not incognito) and is checked first.
    // 2. Otherwise, this looks like a first-ever request from this browser
    //    (fresh install, cleared cookies, or a private/incognito window).
    //    Before minting a brand-new visitor, check whether the same
    //    physical device — same IP + same device type + same OS — was
    //    already seen for this link recently. If so, reuse that visitor's
    //    ID instead of a new one, so a second browser or a fresh
    //    incognito window on the same machine doesn't get double-counted
    //    or show up as a separate person on the Users page.
    // 3. Otherwise, this really is a new visitor — mint a fresh ID.
    let visitorId = getCookie(req, "ltv_id");

    if (!visitorId) {
      if (ipHash) {
        const since = new Date(Date.now() - DEVICE_MATCH_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
        const { data: deviceMatch, error: deviceMatchErr } = await supabase
          .from("clicks")
          .select("visitor_id")
          .eq("link_code", id.toLowerCase())
          .eq("ip_hash", ipHash)
          .eq("device", device)
          .eq("os", os)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (deviceMatchErr) console.error("Device-match lookup failed:", deviceMatchErr);
        if (deviceMatch?.visitor_id) {
          visitorId = deviceMatch.visitor_id;
        }
      }
      if (!visitorId) visitorId = genVisitorId();
    }

    // Cookie is set every time (even when matched by device fallback) so
    // that *this* browser recognizes itself by cookie on the very next
    // visit, rather than needing the fallback lookup again.
    res.setHeader(
      "Set-Cookie",
      `ltv_id=${visitorId}; Max-Age=31536000; Path=/; SameSite=Lax`
    );

    // ---- Log this visit and bump the raw click counter ----
    // "clicks" on the link is a raw hit count: every visit increments it,
    // including repeat visits from the same visitor (Click = one visit).
    // Uniqueness lives entirely in the "clicks" table's visitor_id column —
    // the dashboard derives Users/Visitors by deduping that table, never by
    // gating this counter. Conflating the two here is what let the
    // link-level counter silently become a unique-visitor count instead of
    // a click count.
    //
    // IMPORTANT: both writes are awaited (in parallel) BEFORE the redirect
    // is sent. On Vercel, a serverless function's execution is frozen the
    // instant the response is sent — any un-awaited ("fire-and-forget")
    // promise started after that point is not guaranteed to finish, which
    // is why the "clicks" table was staying empty. Using Promise.all here
    // keeps things fast (both requests run concurrently) while guaranteeing
    // the insert actually completes.
    const tasks = [
      supabase.from("clicks").insert([
        {
          link_code: id.toLowerCase(),
          visitor_id: visitorId,
          country,
          country_code: countryCode,
          city,
          device,
          browser,
          os,
          ip_hash: ipHash
        }
      ]),
      supabase
        .from("links")
        .update({ clicks: data.clicks + 1 })
        .eq("code", id.toLowerCase())
    ];

    const results = await Promise.all(tasks);
    const clickErr = results[0].error;

    if (clickErr) console.error("Visitor log insert failed:", clickErr);

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
