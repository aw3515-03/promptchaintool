import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { card } from "@/lib/ui";

type Row = {
  id: number;
  caption_text: string;
  images: { id: number; image_url: string } | null;
};

export default async function MediaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chainId = Number(id);
  if (Number.isNaN(chainId)) notFound();

  const supabase = await createClient();
  const { data: chain } = await supabase.from("prompt_chains").select("name").eq("id", chainId).single();
  if (!chain) notFound();

  const { data: rows } = await supabase
    .from("captions")
    .select("id, caption_text, images(id, image_url)")
    .eq("chain_id", chainId)
    .order("created_at", { ascending: false })
    .returns<Row[]>();

  // Group captions under their image
  const byImage = new Map<number, { url: string; captions: string[] }>();
  for (const r of rows ?? []) {
    if (!r.images) continue;
    const entry = byImage.get(r.images.id) ?? { url: r.images.image_url, captions: [] };
    entry.captions.push(r.caption_text);
    byImage.set(r.images.id, entry);
  }

  return (
    <main className="flex flex-col gap-6">
      <Link href={`/chains/${chainId}`} className="text-sm text-zinc-500 hover:underline">
        ← Back to chain
      </Link>
      <h1 className="text-2xl font-bold">Media from &quot;{chain.name}&quot;</h1>

      {byImage.size === 0 && <p className="text-zinc-500">Nothing generated with this chain yet.</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[...byImage.entries()].map(([imageId, item]) => (
          <div key={imageId} className={`${card} flex flex-col gap-3`}>
            <img src={item.url} alt="" className="h-52 w-full rounded object-cover" />
            <ul className="list-disc pl-5 text-sm">
              {item.captions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}