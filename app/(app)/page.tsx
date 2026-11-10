import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createChain } from "@/app/actions";
import { input, btnPrimary, card } from "@/lib/ui";

type Chain = {
  id: number;
  name: string;
  description: string | null;
  prompt_chain_steps: { count: number }[];
};

export default async function Home() {
  const supabase = await createClient();
  const { data: chains } = await supabase
    .from("prompt_chains")
    .select("id, name, description, prompt_chain_steps(count)")
    .order("created_at", { ascending: false })
    .returns<Chain[]>();

  return (
    <main className="flex flex-col gap-8">
      <section>
        <h1 className="mb-4 text-2xl font-bold">Prompt Chains</h1>
        <form action={createChain} className={`${card} flex flex-col gap-3`}>
          <input name="name" required placeholder="New chain name" className={input} />
          <textarea name="description" rows={2} placeholder="Description (optional)" className={input} />
          <button className={`${btnPrimary} self-start`}>Create chain</button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        {chains?.length === 0 && <p className="text-zinc-500">No chains yet. Create one above.</p>}
        {chains?.map((c) => (
          <Link key={c.id} href={`/chains/${c.id}`} className={`${card} hover:border-yellow-400`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{c.name}</span>
              <span className="text-xs text-zinc-500">{c.prompt_chain_steps[0]?.count ?? 0} steps</span>
            </div>
            {c.description && <p className="mt-1 text-sm text-zinc-500">{c.description}</p>}
          </Link>
        ))}
      </section>
    </main>
  );
}