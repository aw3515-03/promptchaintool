import { createClient } from "@/lib/supabase/server";

export async function requireSuperadmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_superadmin) throw new Error("Superadmin access required.");

  return { supabase, user };
}