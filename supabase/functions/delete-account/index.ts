import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isMissingTable = (error: { code?: string }) =>
  error.code === "PGRST205" || error.code === "42P01";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "Método no permitido." }, 405);

  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reply({ error: "Inicia sesión para eliminar tu cuenta." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("La función de eliminación no tiene configuradas sus variables de entorno.");
    return reply({ error: "La eliminación de cuentas no está configurada todavía." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return reply({ error: "La sesión no es válida. Inicia sesión de nuevo." }, 401);

  const { error: foundReportsError } = await admin
    .from("paw_found_reports")
    .delete()
    .or(`reporter_id.eq.${user.id},owner_id.eq.${user.id}`);
  if (foundReportsError && !isMissingTable(foundReportsError)) {
    console.error("No se pudieron eliminar los reportes de mascotas encontradas.", foundReportsError);
    return reply({ error: "No se pudieron eliminar los reportes de Paw Alert. Inténtalo de nuevo." }, 500);
  }
  if (foundReportsError) console.warn("La tabla de reportes encontrados no existe; no hay registros que eliminar.");

  const { error: lostReportsError } = await admin
    .from("paw_alerts")
    .delete()
    .eq("owner_id", user.id);
  if (lostReportsError && !isMissingTable(lostReportsError)) {
    console.error("No se pudieron eliminar las alertas de mascotas perdidas.", lostReportsError);
    return reply({ error: "No se pudieron eliminar los reportes de Paw Alert. Inténtalo de nuevo." }, 500);
  }
  if (lostReportsError) console.warn("La tabla de alertas perdidas no existe; no hay registros que eliminar.");

  const { error: profileError } = await admin
    .from("profiles")
    .delete()
    .eq("id", user.id);
  if (profileError) {
    console.error("No se pudo eliminar el perfil de la cuenta.", profileError);
    return reply({ error: "No se pudieron eliminar tus datos de perfil. Inténtalo de nuevo." }, 500);
  }

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    console.error("No se pudo eliminar la cuenta de autenticación.", deleteUserError);
    return reply({ error: "No se pudo eliminar la cuenta de acceso. Inténtalo de nuevo." }, 500);
  }

  return reply({ ok: true });
});
