// =========================================================
// Edge Function: vote
// Actions:
//   status   - which categories this device has voted in
//   set_pin  - after a phone code is confirmed, save the voter's 4-digit PIN
//   vote     - cast a vote with phone number + PIN (no SMS needed)
//
// Voting window (enforced here on the server, Malawi time UTC+02:00):
//   opens  20 Nov 2026, 12:00 noon
//   closes 10 Dec 2026, 11:59:59 PM
// The settings row voting_open must also be "true" (master switch).
//
// Secrets: VOTE_SALT (already set). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatic.
// =========================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // later: your real domain only
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_VOTES_PER_IP_PER_CATEGORY_PER_DAY = 25;
const MAX_VOTES_PER_FINGERPRINT_PER_CATEGORY = 5;
const MAX_WRONG_PINS = 5;      // after 5 wrong PINs the number is locked...
const LOCK_MINUTES = 15;       // ...for 15 minutes

// ----- Voting window (change these two lines if the dates change) -----
const OPEN_AT = Date.parse("2026-11-20T12:00:00+02:00");
const CLOSE_AT = Date.parse("2026-12-10T23:59:59+02:00");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PIN = /^\d{4}$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Turns 0999123456, 265999123456 or +265999123456 into 265999123456. Returns "" if invalid.
function cleanPhone(input: unknown): string {
  let d = String(input ?? "").replace(/\D/g, "");
  if (d.startsWith("265")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return d.length === 9 ? "265" + d : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const salt = Deno.env.get("VOTE_SALT") ?? "change-me";

  // ---------- SET PIN: the voter has just confirmed their phone with the SMS code ----------
  if (body.action === "set_pin") {
    const pin = String(body.pin ?? "");
    if (!PIN.test(pin)) return json({ error: "bad_pin" }, 400);

    // The login token proves the phone number was confirmed by SMS
    const { data: userData, error: userErr } = await supabase.auth.getUser(String(body.access_token ?? ""));
    const phone = cleanPhone(userData?.user?.phone);
    if (userErr || !phone) return json({ error: "no_session" }, 401);

    const phoneHash = await sha256(`${salt}|phone|${phone}`);
    const pinHash = await sha256(`${salt}|pin|${phoneHash}|${pin}`);

    const { error } = await supabase.from("voters").upsert({
      phone_hash: phoneHash,
      pin_hash: pinHash,
      failed_attempts: 0,
      locked_until: null,
    });
    if (error) {
      console.error(error);
      return json({ error: "server_error" }, 500);
    }
    return json({ ok: true });
  }

  const deviceId = String(body.device_id ?? "");
  if (!UUID.test(deviceId)) return json({ error: "bad_device" }, 400);

  const { data: setting } = await supabase
    .from("settings").select("value").eq("key", "voting_open").maybeSingle();

  const now = Date.now();
  const switchOn = setting?.value === "true";
  // Told to the page: open until the closing time (the page shows its own countdown before opening)
  const votingOpen = switchOn && now < CLOSE_AT;
  // Enforced when someone votes: only between opening time and closing time
  const canVote = switchOn && now >= OPEN_AT && now < CLOSE_AT;

  // ---------- STATUS: which categories has this device already voted in? ----------
  if (body.action === "status") {
    const { data } = await supabase
      .from("votes").select("category_id, artist_id").eq("device_id", deviceId);
    const voted: Record<string, string> = {};
    (data ?? []).forEach((v) => { voted[v.category_id] = v.artist_id; });
    return json({ voting_open: votingOpen, voted });
  }

  // ---------- VOTE ----------
  if (body.action === "vote") {
    if (!canVote) return json({ error: "voting_closed" }, 403);

    const categoryId = String(body.category_id ?? "");
    const artistId = String(body.artist_id ?? "");
    if (!UUID.test(categoryId) || !UUID.test(artistId)) {
      return json({ error: "bad_request" }, 400);
    }

    // ----- Check the voter's phone and PIN -----
    const phone = cleanPhone(body.phone);
    const pin = String(body.pin ?? "");
    if (!phone || !PIN.test(pin)) return json({ error: "bad_request" }, 400);

    const phoneHash = await sha256(`${salt}|phone|${phone}`);
    const { data: voter } = await supabase
      .from("voters").select("pin_hash, failed_attempts, locked_until")
      .eq("phone_hash", phoneHash).maybeSingle();

    if (!voter) return json({ error: "not_registered" }, 403);

    if (voter.locked_until && new Date(voter.locked_until) > new Date()) {
      return json({ error: "locked" }, 429);
    }

    const pinHash = await sha256(`${salt}|pin|${phoneHash}|${pin}`);
    if (pinHash !== voter.pin_hash) {
      const fails = voter.failed_attempts + 1;
      const lockUntil = fails >= MAX_WRONG_PINS
        ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString()
        : null;
      await supabase.from("voters")
        .update({ failed_attempts: lockUntil ? 0 : fails, locked_until: lockUntil })
        .eq("phone_hash", phoneHash);
      return lockUntil ? json({ error: "locked" }, 429) : json({ error: "wrong_pin" }, 403);
    }

    // Correct PIN: clear the failed-attempt count
    await supabase.from("voters")
      .update({ failed_attempts: 0, locked_until: null })
      .eq("phone_hash", phoneHash);

    // The artist must really belong to that category
    const { data: artist } = await supabase
      .from("artists").select("id")
      .eq("id", artistId).eq("category_id", categoryId).eq("is_active", true)
      .maybeSingle();
    if (!artist) return json({ error: "invalid_artist" }, 400);

    // Hash IP and fingerprint (we never store them in plain text)
    const ip = (req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    const ipHash = await sha256(`${salt}|ip|${ip}`);
    const fp = body.fingerprint ? String(body.fingerprint).slice(0, 300) : "";
    const fpHash = fp ? await sha256(`${salt}|fp|${fp}`) : null;

    // Bot check 1: too many votes from one network today
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: ipCount } = await supabase
      .from("votes").select("id", { count: "exact", head: true })
      .eq("category_id", categoryId).eq("ip_hash", ipHash).gte("created_at", since);
    if ((ipCount ?? 0) >= MAX_VOTES_PER_IP_PER_CATEGORY_PER_DAY) {
      return json({ error: "too_many" }, 429);
    }

    // Bot check 2: too many votes from the "same-looking" browser
    if (fpHash) {
      const { count: fpCount } = await supabase
        .from("votes").select("id", { count: "exact", head: true })
        .eq("category_id", categoryId).eq("fingerprint_hash", fpHash);
      if ((fpCount ?? 0) >= MAX_VOTES_PER_FINGERPRINT_PER_CATEGORY) {
        return json({ error: "too_many" }, 429);
      }
    }

    // Save. The database's UNIQUE rules are the real locks:
    // one vote per device per category, and one vote per phone per category.
    const { error } = await supabase.from("votes").insert({
      category_id: categoryId,
      artist_id: artistId,
      device_id: deviceId,
      phone_hash: phoneHash,
      fingerprint_hash: fpHash,
      ip_hash: ipHash,
    });

    if (error) {
      if (error.code === "23505") return json({ error: "already_voted" }, 409);
      console.error(error);
      return json({ error: "server_error" }, 500);
    }
    return json({ ok: true });
  }

  return json({ error: "bad_action" }, 400);
});