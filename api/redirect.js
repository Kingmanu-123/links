import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://jctdtavzpcxnvpebpyqx.supabase.co",
  "sb_publishable_QUrKq5DUY3pwmHv4HEjKCQ_bGFZi4VQ"
);

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

    // ---- Visitor fingerprint (cookie-based, persists across visits) ----
    let visitorId = getCookie(req, "ltv_id");
    if (!visitorId) {
      visitorId = genVisitorId();
    }
    res.setHeader(
      "Set-Cookie",
      `ltv_id=${visitorId}; Max-Age=31536000; Path=/; SameSite=Lax`
    );

    // ---- Device / browser / OS ----
    const ua = req.headers["user-agent"] || "";
    const { os, browser, device } = parseUserAgent(ua);

    // ---- Geo (Vercel injects these headers automatically at the edge) ----
    const country = req.headers["x-vercel-ip-country"] || null;
    const countryCode = req.headers["x-vercel-ip-country"] || null;
    const city = req.headers["x-vercel-ip-city"]
      ? decodeURIComponent(req.headers["x-vercel-ip-city"])
      : null;

    // IMPORTANT: both writes are awaited (in parallel) BEFORE the redirect
    // is sent. On Vercel, a serverless function's execution is frozen the
    // instant the response is sent — any un-awaited ("fire-and-forget")
    // promise started after that point is not guaranteed to finish, which
    // is why the "clicks" table was staying empty. Using Promise.all here
    // keeps things fast (both requests run concurrently) while guaranteeing
    // the insert actually completes.
    const [, { error: clickErr }] = await Promise.all([
      supabase
        .from("links")
        .update({ clicks: data.clicks + 1 })
        .eq("code", id.toLowerCase()),
      supabase.from("clicks").insert([
        {
          link_code: id.toLowerCase(),
          visitor_id: visitorId,
          country,
          country_code: countryCode,
          city,
          device,
          browser,
          os
        }
      ])
    ]);

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
