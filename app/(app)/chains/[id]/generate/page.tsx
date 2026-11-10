import Link from "next/link";
import GenerateForm from "@/components/GenerateForm";

export default async function GeneratePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="flex flex-col gap-6">
      <Link href={`/chains/${id}`} className="text-sm text-zinc-500 hover:underline">
        ← Back to chain
      </Link>
      <h1 className="text-2xl font-bold">Generate</h1>
      <GenerateForm chainId={Number(id)} />
    </main>
  );
}