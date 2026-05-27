import { supabase } from "@/integrations/supabase/client";

export async function checkIsAdmin(userId: string) {
  if (!supabase) return { isAdmin: false, error: null };

  const roleQuery = await supabase
    .schema("private")
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleQuery.error) {
    return { isAdmin: Boolean(roleQuery.data), error: null };
  }

  const rpcQuery = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (rpcQuery.error) {
    return { isAdmin: false, error: roleQuery.error };
  }

  return { isAdmin: Boolean(rpcQuery.data), error: null };
}

export async function getUserRolesForDebug(userId: string) {
  if (!supabase) return { data: null, error: null };

  return supabase
    .schema("private")
    .from("user_roles")
    .select("user_id, role")
    .eq("user_id", userId);
}
