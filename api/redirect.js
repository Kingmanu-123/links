import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  "https://jctdtavzpcxnvpebpyqx.supabase.co",
  "sb_publishable_QUrKq5DUY3pwmHv4HEjKCQ_bGFZi4VQ"
);

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

    // Update click count
    await supabase
      .from("links")
      .update({ clicks: data.clicks + 1 })
      .eq("code", id.toLowerCase());

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
