// Supabase "Send SMS hook": Supabase creates the 6-digit code and calls this function,
// and this function sends the code through TelcoMW.
// The TelcoMW key lives only in Supabase secrets, never in the website.

const TELCOMW_URL = "https://telcomw.com/api/v3/sms/send";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Check that the request really came from Supabase (Standard Webhooks signature).
async function signatureIsValid(req: Request, body: string): Promise<boolean> {
  const secret = Deno.env.get("SEND_SMS_HOOK_SECRET");
  const id = req.headers.get("webhook-id");
  const ts = req.headers.get("webhook-timestamp");
  const sig = req.headers.get("webhook-signature");
  if (!secret || !id || !ts || !sig) return false;

  // Refuse requests older than 5 minutes (stops replaying an old request).
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;

  const raw = secret.replace(/^v1,whsec_/, "");
  const keyBytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`)),
  );
  const expected = btoa(String.fromCharCode(...mac));

  // The header can hold several signatures separated by spaces, e.g. "v1,abc= v1,def=".
  return sig.split(" ").some((part) => {
    const [version, value] = part.split(",");
    return version === "v1" && value === expected;
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: { http_code: 405, message: "Method not allowed" } });
  }

  const body = await req.text();
  if (!(await signatureIsValid(req, body))) {
    return json(401, { error: { http_code: 401, message: "Invalid signature" } });
  }

  const payload = JSON.parse(body);
  const phone = String(payload?.user?.phone ?? "").replace(/\D/g, "");
  const otp = String(payload?.sms?.otp ?? "");
  if (!phone || !otp) {
    return json(400, { error: { http_code: 400, message: "Missing phone or code" } });
  }

  const apiKey = Deno.env.get("TELCOMW_API_KEY");
  const senderId = Deno.env.get("TELCOMW_SENDER_ID");
  if (!apiKey || !senderId) {
    return json(500, { error: { http_code: 500, message: "SMS not configured" } });
  }

  // Same phone + same code within one minute = one message only, even if Supabase retries.
  const minute = Math.floor(Date.now() / 60000);

  const res = await fetch(TELCOMW_URL, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
      "X-Duplicate-Guard": `otp-${phone}-${otp}-${minute}`,
    },
    body: JSON.stringify({
      to: phone, // TelcoMW accepts 265999123456
      message: `Your MEA voting code is ${otp}. Do not share it.`,
      sender_id: senderId,
      // message_type left out on purpose: a normal SMS stays on the phone; a flash message disappears.
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    // Log the TelcoMW error code (not the key) so you can see what went wrong in Supabase logs.
    console.error("TelcoMW error", res.status, data?.error?.code, data?.request_id);
    return json(502, { error: { http_code: 502, message: "Could not send the code. Try again." } });
  }

  // Empty object = success for Supabase.
  return json(200, {});
});
