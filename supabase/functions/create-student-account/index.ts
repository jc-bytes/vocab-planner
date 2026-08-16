import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STUDENT_EMAIL_DOMAIN = "@aid.edu.pa";

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

const normalizeText = (value: unknown) => String(value || "").trim();
const normalizeEmail = (value: unknown) => normalizeText(value).toLowerCase();
const normalizeSection = (value: unknown) => normalizeText(value).toUpperCase();

const validateStudentPayload = (body: Record<string, unknown>) => {
  const firstName = normalizeText(body.firstName);
  const lastName = normalizeText(body.lastName);
  const email = normalizeEmail(body.email);
  const grade = normalizeText(body.grade);
  const section = normalizeSection(body.section);
  const password = String(body.password || "");

  if (!firstName || !lastName || !email || !grade || !section || !password) {
    return { error: "Complete every student field." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid school email address." };
  }

  if (!email.endsWith(STUDENT_EMAIL_DOMAIN)) {
    return { error: `Use the ${STUDENT_EMAIL_DOMAIN} school email domain.` };
  }

  if (!/^[6-9]$/.test(grade)) {
    return { error: "Choose grade 6, 7, 8, or 9." };
  }

  if (!/^[A-Z]$/.test(section)) {
    return { error: "Section must be one letter." };
  }

  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return { error: "Password must be at least 10 characters and include a letter and number." };
  }

  return {
    firstName,
    lastName,
    email,
    gradeLevel: Number.parseInt(grade, 10),
    section,
    password,
  };
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const payload = validateStudentPayload(body);
  if ("error" in payload) {
    return jsonResponse({ error: payload.error }, 400);
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
      { error: "Only teachers can create student accounts." },
      403,
    );
  }

  const fullName = `${payload.firstName} ${payload.lastName}`.trim();
  const provisioningToken = crypto.randomUUID();
  const { error: ticketError } = await adminClient.rpc(
    "issue_auth_user_provisioning_ticket",
    {
      p_email: payload.email,
      p_token: provisioningToken,
    },
  );
  if (ticketError) {
    return jsonResponse({ error: "Could not authorize account provisioning." }, 500);
  }

  const { data: createData, error: createError } = await adminClient.auth.admin
    .createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        first_name: payload.firstName,
        last_name: payload.lastName,
        full_name: fullName,
        provisioning_token: provisioningToken,
      },
    });

  if (createError || !createData.user) {
    return jsonResponse({
      error: createError?.message || "Could not create the student account.",
    }, 400);
  }

  const studentId = createData.user.id;
  await adminClient.auth.admin.updateUserById(studentId, {
    user_metadata: {
      first_name: payload.firstName,
      last_name: payload.lastName,
      full_name: fullName,
    },
  });
  const profileRow = {
    user_id: studentId,
    role: "student",
    first_name: payload.firstName,
    last_name: payload.lastName,
    email: payload.email,
    grade_level: payload.gradeLevel,
    section_letter: payload.section,
    must_change_password: false,
  };
  const studentProfile = {
    firstName: payload.firstName,
    lastName: payload.lastName,
    name: fullName,
    email: payload.email,
    grade: String(payload.gradeLevel),
    group: payload.section,
  };

  const { error: profileError } = await adminClient
    .from("profiles")
    .upsert(profileRow, { onConflict: "user_id" });

  if (profileError) {
    await adminClient.auth.admin.deleteUser(studentId);
    return jsonResponse({ error: "Could not save the student profile." }, 500);
  }

  const { error: progressError } = await adminClient.rpc(
    "provision_student_progress_for_account",
    {
      p_student_id: studentId,
      p_student_profile: studentProfile,
    },
  );

  if (progressError) {
    await adminClient.auth.admin.deleteUser(studentId);
    return jsonResponse({
      error: "Could not initialize the student progress record.",
    }, 500);
  }

  return jsonResponse({
    student: {
      userId: studentId,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      grade: String(payload.gradeLevel),
      group: payload.section,
      mustChangePassword: false,
    },
  });
});
