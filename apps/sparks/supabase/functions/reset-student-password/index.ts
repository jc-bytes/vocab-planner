import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const getPublishableKey = () => {
  const directKey = Deno.env.get("SUPABASE_ANON_KEY") ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (directKey) return directKey;

  const keyDictionary = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!keyDictionary) return "";

  try {
    const parsed = JSON.parse(keyDictionary);
    const firstKey = Object.values(parsed).find((value) =>
      typeof value === "string"
    );
    return typeof firstKey === "string" ? firstKey : "";
  } catch (_error) {
    return "";
  }
};

const generateTemporaryPassword = () => {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%";
  const alphabet = `${letters}${digits}${symbols}`;
  const randomCharacter = (source: string) => {
    const bytes = new Uint8Array(1);
    crypto.getRandomValues(bytes);
    return source[bytes[0] % source.length];
  };
  const characters = [randomCharacter(letters), randomCharacter(digits)];
  while (characters.length < 16) characters.push(randomCharacter(alphabet));
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const bytes = new Uint8Array(1);
    crypto.getRandomValues(bytes);
    const swapIndex = bytes[0] % (index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }
  return characters.join("");
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = getPublishableKey();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SECRET_KEY") || "";

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return jsonResponse({
      error: "Supabase function secrets are not configured.",
    }, 500);
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return jsonResponse(
      { error: "Missing authenticated teacher session." },
      401,
    );
  }

  let userId = "";
  try {
    const body = await req.json();
    userId = String(body?.userId || "");
  } catch (_error) {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(userId)
  ) {
    return jsonResponse({ error: "A valid student user ID is required." }, 400);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: authorization },
    },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: "Invalid or expired teacher session." }, 401);
  }

  const { data: teacherProfile, error: teacherError } = await adminClient
    .from("profiles")
    .select("role,email")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (teacherError) {
    return jsonResponse({ error: "Could not verify teacher access." }, 500);
  }

  if (teacherProfile?.role !== "teacher") {
    return jsonResponse(
      { error: "Only teachers can reset student passwords." },
      403,
    );
  }

  const { data: studentProfile, error: studentError } = await adminClient
    .from("profiles")
    .select("role,email")
    .eq("user_id", userId)
    .maybeSingle();

  if (studentError) {
    return jsonResponse({ error: "Could not load the student profile." }, 500);
  }

  if (studentProfile?.role !== "student") {
    return jsonResponse({
      error: "Password resets are limited to student accounts.",
    }, 400);
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error: updateUserError } = await adminClient.auth.admin
    .updateUserById(userId, {
      password: temporaryPassword,
    });

  if (updateUserError) {
    return jsonResponse(
      { error: "Could not update the student password." },
      500,
    );
  }

  const { error: profileUpdateError } = await adminClient
    .from("profiles")
    .update({ must_change_password: true })
    .eq("user_id", userId);

  if (profileUpdateError) {
    console.error("Password changed but the profile flag update failed", {
      userId,
      message: profileUpdateError.message,
    });
    return jsonResponse({
      temporaryPassword,
      studentEmail: studentProfile.email,
      passwordChanged: true,
      profileFlagUpdated: false,
      warning:
        "The password was changed, but the required-change flag could not be saved. Give the student this temporary password and try the reset again later.",
    });
  }

  return jsonResponse({
    temporaryPassword,
    studentEmail: studentProfile.email,
    passwordChanged: true,
    profileFlagUpdated: true,
  });
});
