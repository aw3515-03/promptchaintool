import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateChain, deleteChain, createStep, updateStep, deleteStep, moveStep } from "@/app/actions";
import { input, btn, btnPrimary, btnDanger, card } from "@/lib/ui";

type Chain = { id: number; name: string; description: string | null };
type Step = {
  id: number;
  step_number: number;
  title: string | null;
  system_prompt: string | null;
  user_prompt: string | null;
  llm_model_id: number | null;
};
type Model = { id: number; name: string; model_identifier: string };

export default async function ChainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chainId = Number(id);
  if (Number.isNaN(chainId)) notFound();

  const supabase = await createClient();
  const { data: chain } = await supabase
    .from("prompt_chains")
    .select("id, name, description")
    .eq("id", chainId)
    .single<Chain>();
  if (!chain) notFound();

  const { data: steps } = await supabase
    .from("prompt_chain_steps")
    .select("id, step_number, title, system_prompt, user_prompt, llm_model_id")
    .eq("chain_id", chainId)
    .order("step_number")
    .returns<Step[]>();

  const { data: models } = await supabase
    .from("llm_models")
    .select("id, name, model_identifier")
    .order("name")
    .returns<Model[]>();

  const modelSelect = (name: string, value: number | null) => (
    <select name={name} defaultValue={value ?? ""} className={input}>
      <option value="">Default (gemini-3.8-flash)</option>
      {models?.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name} ({m.model_identifier})
        </option>
      ))}
    </select>
  );

  return (
    <main className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← All chains
        </Link>
        <div className="flex gap-2">
          <Link href={`/chains/${chainId}/generate`} className={btnPrimary}>
            Generate
          </Link>
          <Link href={`/chains/${chainId}/media`} className={btn}>
            View media
          </Link>
        </div>
      </div>

      <form action={updateChain} className={`${card} flex flex-col gap-3`}>
        <input type="hidden" name="id" value={chain.id} />
        <input name="name" required defaultValue={chain.name} className={`${input} text-lg font-semibold`} />
        <textarea name="description" rows={2} defaultValue={chain.description ?? ""} className={input} />
        <button className={`${btnPrimary} self-start`}>Save chain</button>
      </form>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">Steps</h2>
        <p className="text-sm text-zinc-500">
          Step 1 receives the image. Each later step receives the previous step&apos;s output: put{" "}
          <code>{"{{previous}}"}</code> in the user prompt to place it, otherwise it&apos;s appended.
        </p>

        {steps?.length === 0 && <p className="text-zinc-500">No steps yet. Add the first one below.</p>}

        {steps?.map((s, i) => (
          <form key={s.id} className={`${card} flex flex-col gap-3`}>
            <input type="hidden" name="id" value={s.id} />
            <input type="hidden" name="chain_id" value={chainId} />
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-yellow-500">Step {i + 1}</h3>
              <div className="flex gap-2">
                <button formAction={moveStep} name="direction" value="up" disabled={i === 0} className={btn}>
                  ↑ Up
                </button>
                <button
                  formAction={moveStep}
                  name="direction"
                  value="down"
                  disabled={i === (steps?.length ?? 0) - 1}
                  className={btn}
                >
                  ↓ Down
                </button>
              </div>
            </div>
            <input name="title" defaultValue={s.title ?? ""} placeholder="Step title" className={input} />
            <textarea
              name="system_prompt"
              rows={2}
              defaultValue={s.system_prompt ?? ""}
              placeholder="System prompt"
              className={input}
            />
            <textarea
              name="user_prompt"
              rows={3}
              defaultValue={s.user_prompt ?? ""}
              placeholder="User prompt"
              className={input}
            />
            {modelSelect("llm_model_id", s.llm_model_id)}
            <div className="flex gap-2">
              <button formAction={updateStep} className={btnPrimary}>
                Save step
              </button>
              <button formAction={deleteStep} className={btnDanger}>
                Delete step
              </button>
            </div>
          </form>
        ))}

        <form action={createStep} className={`${card} flex flex-col gap-3 border-dashed`}>
          <input type="hidden" name="chain_id" value={chainId} />
          <h3 className="font-semibold">Add a step</h3>
          <input name="title" placeholder="Step title" className={input} />
          <textarea name="system_prompt" rows={2} placeholder="System prompt" className={input} />
          <textarea name="user_prompt" rows={3} required placeholder="User prompt" className={input} />
          {modelSelect("llm_model_id", null)}
          <button className={`${btnPrimary} self-start`}>Add step</button>
        </form>
      </section>

      <details className="text-sm">
        <summary className="cursor-pointer text-red-500">Danger zone</summary>
        <form action={deleteChain} className="mt-3">
          <input type="hidden" name="id" value={chain.id} />
          <button className={btnDanger}>Delete this chain and all its steps</button>
        </form>
      </details>
    </main>
  );
}