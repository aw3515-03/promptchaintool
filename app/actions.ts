"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSuperadmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(str(f, k));

async function orderedStepIds(supabase: Supabase, chainId: number) {
  const { data, error } = await supabase
    .from("prompt_chain_steps")
    .select("id")
    .eq("chain_id", chainId)
    .order("step_number");
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => s.id as number);
}

async function setOrder(supabase: Supabase, chainId: number, ids: number[]) {
  const { error } = await supabase.rpc("reorder_prompt_chain_steps", {
    p_chain_id: chainId,
    p_step_ids: ids,
  });
  if (error) throw new Error(error.message);
}

// ---- Chains ----
export async function createChain(formData: FormData) {
  const { supabase } = await requireSuperadmin();
  const name = str(formData, "name");
  if (!name) throw new Error("Name is required.");

  const { data, error } = await supabase
    .from("prompt_chains")
    .insert({ name, description: str(formData, "description") || null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/");
  redirect(`/chains/${data.id}`);
}

export async function updateChain(formData: FormData) {
  const { supabase } = await requireSuperadmin();
  const id = num(formData, "id");
  const { error } = await supabase
    .from("prompt_chains")
    .update({ name: str(formData, "name"), description: str(formData, "description") || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/chains/${id}`);
  revalidatePath("/");
}

export async function deleteChain(formData: FormData) {
  const { supabase } = await requireSuperadmin();
  const { error } = await supabase.from("prompt_chains").delete().eq("id", num(formData, "id"));
  if (error) throw new Error(error.message);
  revalidatePath("/");
  redirect("/");
}

// ---- Steps ----
export async function createStep(formData: FormData) {
  const { supabase } = await requireSuperadmin();
  const chainId = num(formData, "chain_id");
  const ids = await orderedStepIds(supabase, chainId);
  const modelId = str(formData, "llm_model_id");

  const { error } = await supabase.from("prompt_chain_steps").insert({
    chain_id: chainId,
    step_number: ids.length + 1,
    title: str(formData, "title") || null,
    system_prompt: str(formData, "system_prompt") || null,
    user_prompt: str(formData, "user_prompt") || null,
    llm_model_id: modelId ? Number(modelId) : null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/chains/${chainId}`);
}

export async function updateStep(formData: FormData) {
  const { supabase } = await requireSuperadmin();
  const chainId = num(formData, "chain_id");
  const modelId = str(formData, "llm_model_id");

  const { error } = await supabase
    .from("prompt_chain_steps")
    .update({
      title: str(formData, "title") || null,
      system_prompt: str(formData, "system_prompt") || null,
      user_prompt: str(formData, "user_prompt") || null,
      llm_model_id: modelId ? Number(modelId) : null,
    })
    .eq("id", num(formData, "id"));
  if (error) throw new Error(error.message);
  revalidatePath(`/chains/${chainId}`);
}

export async function deleteStep(formData: FormData) {
  const { supabase } = await requireSuperadmin();
  const chainId = num(formData, "chain_id");

  const { error } = await supabase.from("prompt_chain_steps").delete().eq("id", num(formData, "id"));
  if (error) throw new Error(error.message);

  await setOrder(supabase, chainId, await orderedStepIds(supabase, chainId)); // close the gap
  revalidatePath(`/chains/${chainId}`);
}

export async function moveStep(formData: FormData) {
  const { supabase } = await requireSuperadmin();
  const chainId = num(formData, "chain_id");
  const id = num(formData, "id");
  const direction = str(formData, "direction");

  const ids = await orderedStepIds(supabase, chainId);
  const i = ids.indexOf(id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i === -1 || j < 0 || j >= ids.length) return;

  [ids[i], ids[j]] = [ids[j], ids[i]];
  await setOrder(supabase, chainId, ids);
  revalidatePath(`/chains/${chainId}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}