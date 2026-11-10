"use client";

import { useState } from "react";
import { input, btnPrimary, card } from "@/lib/ui";

type Result = {
  imageUrl: string;
  outputs: { step: number; text: string }[];
  captions: string[];
};

export default function GenerateForm({ chainId }: { chainId: number }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);

    const fd = new FormData();
    fd.append("chainId", String(chainId));
    if (file) fd.append("file", file);
    else fd.append("imageUrl", url);

    try {
      const res = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Generation failed.");
      else setResult(data);
    } catch {
      setError("Network error.");
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className={`${card} flex flex-col gap-3`}>
        <label className="text-sm text-zinc-500">Upload an image</label>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <label className="text-sm text-zinc-500">or paste an image URL</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/image.jpg"
          className={input}
        />
        <button onClick={run} disabled={busy || (!file && !url.trim())} className={`${btnPrimary} self-start disabled:opacity-50`}>
          {busy ? "Running chain..." : "Run chain"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {result && (
        <div className="flex flex-col gap-4">
          <img src={result.imageUrl} alt="Input" className="max-h-72 self-start rounded" />
          {result.outputs.map((o) => (
            <div key={o.step} className={card}>
              <p className="mb-1 text-xs font-semibold text-yellow-500">Step {o.step} output</p>
              <p className="whitespace-pre-wrap text-sm">{o.text}</p>
            </div>
          ))}
          <div>
            <p className="mb-2 font-semibold">Saved captions</p>
            <ul className="list-disc pl-5 text-sm">
              {result.captions.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}