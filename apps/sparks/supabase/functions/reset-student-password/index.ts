import "@supabase/functions-js/edge-runtime.d.ts";

// Retired global administrator endpoint. No account lookup or Auth mutation occurs.
// School invitations are authorized by membership-aware database RPCs.
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
Deno.serve((request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers });
  return new Response(JSON.stringify({ error: "Password recovery belongs to the account holder. Use the verified account recovery flow; school administrators cannot reset a shared account password.", code: "SCHOOL_ACCOUNT_RECOVERY_REQUIRED" }), { status: 410, headers });
});
