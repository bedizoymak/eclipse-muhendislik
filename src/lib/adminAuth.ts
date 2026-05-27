import { supabase } from "@/integrations/supabase/client";

export async function checkIsAdmin(userId: string) {
  if (!supabase) return { isAdmin: false, error: null };

  const publicRoleQuery = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1);

  if (!publicRoleQuery.error && publicRoleQuery.data?.length) {
    return { isAdmin: true, error: null };
  }

  const privateRoleQuery = await supabase
    .schema("private")
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1);

  if (!privateRoleQuery.error && privateRoleQuery.data?.length) {
    return { isAdmin: true, error: null };
  }

  const rpcQuery = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (rpcQuery.error) {
    return { isAdmin: false, error: publicRoleQuery.error ?? privateRoleQuery.error ?? rpcQuery.error };
  }

  return { isAdmin: Boolean(rpcQuery.data), error: null };
}

export async function getUserRolesForDebug(userId: string) {
  if (!supabase) return { data: null, error: null };

  return supabase
    .from("user_roles")
    .select("user_id, role")
    .eq("user_id", userId);
}
