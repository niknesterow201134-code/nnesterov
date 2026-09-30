// Supabase Edge Function: robokassa-webhook
// RoboKassa calls this URL (ResultURL) after successful payment.
// We verify the signature, create a Supabase account for the buyer,
// and send them an invite email with a "Set your password" link.
//
// Deploy:
//   npx supabase functions deploy robokassa-webhook --project-ref wmcrshretrerwvcjxper
//
// Set secrets:
//   npx supabase secrets set ROBOKASSA_PASSWORD2=<твой_пароль2> --project-ref wmcrshretrerwvcjxper
//   npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role_key> --project-ref wmcrshretrerwvcjxper

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://wmcrshretrerwvcjxper.supabase.co";
const SITE_URL = "https://niknesterow201134-code.github.io/nnesterov/";

// Verify RoboKassa MD5 signature
// Format: MD5(OutSum:InvId:Password2[:shp_params_sorted])
async function verifyRobokassaSignature(
  outSum: string,
  invId: string,
  signatureFromRobokassa: string,
  password2: string,
  extraParams: Record<string, string>
): Promise<boolean> {
  // Build shp_* params string (sorted alphabetically, case-insensitive)
  const shpParts = Object.entries(extraParams)
    .filter(([k]) => k.toLowerCase().startsWith("shp_"))
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(([k, v]) => `${k}=${v}`)
    .join(":");

  const raw = shpParts.length > 0
    ? `${outSum}:${invId}:${password2}:${shpParts}`
    : `${outSum}:${invId}:${password2}`;

  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computed = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").toLowerCase();

  return computed === signatureFromRobokassa.toLowerCase();
}

Deno.serve(async (req: Request) => {
  // RoboKassa sends POST with application/x-www-form-urlencoded
  let params: URLSearchParams;
  try {
    const text = await req.text();
    params = new URLSearchParams(text);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const outSum = params.get("OutSum") || "";
  const invId = params.get("InvId") || "";
  const signatureValue = params.get("SignatureValue") || "";
  const buyerEmail = params.get("shp_email") || params.get("Email") || "";

  const password2 = Deno.env.get("ROBOKASSA_PASSWORD2") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!password2 || !serviceRoleKey) {
    console.error("Missing env vars: ROBOKASSA_PASSWORD2 or SUPABASE_SERVICE_ROLE_KEY");
    return new Response("Server configuration error", { status: 500 });
  }

  // Collect all extra params for signature verification
  const extraParams: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    if (!["OutSum", "InvId", "SignatureValue"].includes(k)) {
      extraParams[k] = v;
    }
  }

  // Verify signature
  const isValid = await verifyRobokassaSignature(outSum, invId, signatureValue, password2, extraParams);
  if (!isValid) {
    console.error("Invalid RoboKassa signature", { outSum, invId, signatureValue });
    return new Response("Invalid signature", { status: 403 });
  }

  if (!buyerEmail) {
    console.error("No buyer email in RoboKassa params. Pass shp_email=... in payment URL.");
    // Still return OK to RoboKassa so they don't retry forever
    return new Response(`OK${invId}`, { status: 200 });
  }

  // Create Supabase admin client (service_role bypasses RLS and email confirmation)
  const adminClient = createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Check if user already exists
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const alreadyExists = existingUsers?.users?.some((u) => u.email === buyerEmail);

  if (alreadyExists) {
    console.log(`User ${buyerEmail} already has an account. Payment invId=${invId} processed.`);
    return new Response(`OK${invId}`, { status: 200 });
  }

  // Create account and send "Set your password" invite email
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    buyerEmail,
    {
      redirectTo: SITE_URL,
      data: {
        robokassa_inv_id: invId,
        robokassa_amount: outSum,
      }
    }
  );

  if (inviteError) {
    console.error("Failed to invite user:", inviteError);
    // Don't return error to RoboKassa — log and acknowledge
  } else {
    console.log(`Invited user ${buyerEmail} (invId=${invId}, amount=${outSum})`);
  }

  // RoboKassa requires exactly "OK{InvId}" in the response body to confirm receipt
  return new Response(`OK${invId}`, { status: 200 });
});
