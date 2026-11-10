import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/auth";

export const maxDuration = 60;

type StepRow = {
  id: number;
  step_number: number;
  system_prompt: string | null;
  user_prompt: string | null;
  llm_model_id: number | null;
  llm_models: { model_identifier: string } | null;
};

const DEFAULT_MODEL = "gemini-3.8-flash";

async function callGemini(opts: {
  model: string;
  system?: string | null;
  text: string;
  image?: { mime: string; data: string };
}): Promise<string> {
  const parts: unknown[] = [{ text: opts.text }];
  if (opts.image) parts.push({ inline_data: { mime_type: opts.image.mime, data: opts.image.data } });

  const body: Record<string, unknown> = { contents: [{ role: "user", parts }] };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };

  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    console.log("Gemini request start", { model: opts.model, attempt: attempt + 1, textLength: opts.text.length });

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );
      const data = await res.json();
      console.log("Gemini response payload", { status: res.status, data });

      if (res.ok) {
        const out = (data?.candidates?.[0]?.content?.parts ?? [])
          .map((p: { text?: string }) => p.text ?? "")
          .join("")
          .trim();
        if (out) return out;
        throw new Error("Gemini returned no text (it may have been blocked by safety filters).");
      }

      const busy = res.status === 503 || res.status === 429;
      if (busy && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw new Error(data?.error?.message ?? `Gemini request failed (${res.status}).`);
    } catch (err) {
      console.error("Gemini request error", { model: opts.model, attempt: attempt + 1, err });
      if (err instanceof Error && err.name === "AbortError") {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw new Error("Gemini request timed out. Please try again.");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Gemini request failed.");
}

function buildPrompt(template: string | null, previous: string | null) {
  const base = template ?? "";
  if (previous === null) return base;
  return base.includes("{{previous}}") ? base.replaceAll("{{previous}}", previous) : `${base}\n\n${previous}`.trim();
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireSuperadmin();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
  const { supabase, user } = ctx;

  const form = await request.formData();
  const chainId = Number(form.get("chainId"));
  const file = form.get("file") as File | null;
  const linkUrl = String(form.get("imageUrl") ?? "").trim();

  const { data: steps } = await supabase
    .from("prompt_chain_steps")
    .select("id, step_number, system_prompt, user_prompt, llm_model_id, llm_models(model_identifier)")
    .eq("chain_id", chainId)
    .order("step_number")
    .returns<StepRow[]>();
  if (!steps?.length) return NextResponse.json({ error: "This chain has no steps." }, { status: 400 });

  // 1. Get the image URL (upload or link)
  let imageUrl: string;
  if (file && file.size > 0) {
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("images").upload(path, file);
    if (error) return NextResponse.json({ error: `Upload failed: ${error.message}` }, { status: 500 });
    imageUrl = supabase.storage.from("images").getPublicUrl(path).data.publicUrl;
  } else if (linkUrl) {
    imageUrl = linkUrl;
  } else {
    return NextResponse.json({ error: "Provide an image file or URL." }, { status: 400 });
  }

  // 2. Fetch image bytes once, for step 1
  console.log("Fetching uploaded image", { imageUrl });
  const imageController = new AbortController();
  const imageTimer = setTimeout(() => imageController.abort(), 20000);
  let image: { mime: string; data: string };
  try {
    const imgRes = await fetch(imageUrl, { signal: imageController.signal });
    if (!imgRes.ok) return NextResponse.json({ error: "Could not fetch that image." }, { status: 400 });
    image = {
      mime: imgRes.headers.get("content-type")?.split(";")[0] || "image/jpeg",
      data: Buffer.from(await imgRes.arrayBuffer()).toString("base64"),
    };
    console.log("Image fetch ok", { mime: image.mime, size: image.data.length });
  } catch (err) {
    console.error("Image fetch failed", { imageUrl, err });
    throw err;
  } finally {
    clearTimeout(imageTimer);
  }

  // 3. Log the image and the request
  const { data: imageRow, error: imageErr } = await supabase
    .from("images")
    .insert({ user_id: user.id, image_url: imageUrl })
    .select("id")
    .single();
  if (imageErr) return NextResponse.json({ error: imageErr.message }, { status: 500 });

  const { data: reqRow, error: reqErr } = await supabase
    .from("generation_requests")
    .insert({ user_id: user.id, image_id: imageRow.id, chain_id: chainId, status: "running" })
    .select("id")
    .single();
  if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });

  // 4. Run the chain
  const outputs: { step: number; text: string }[] = [];
  let previous: string | null = null;
  let lastPrompt = "";

  for (const [i, step] of steps.entries()) {
    const userPrompt = buildPrompt(step.user_prompt, previous);
    const started = Date.now();
    try {
      const text = await callGemini({
        model: step.llm_models?.model_identifier ?? DEFAULT_MODEL,
        system: step.system_prompt,
        text: userPrompt || "Continue.",
        image: i === 0 ? image : undefined,
      });

      await supabase.from("llm_responses").insert({
        request_id: reqRow.id,
        step_id: step.id,
        model_id: step.llm_model_id,
        system_prompt: step.system_prompt,
        user_prompt: userPrompt,
        response_text: text,
        processing_ms: Date.now() - started,
      });

      outputs.push({ step: i + 1, text });
      previous = text;
      lastPrompt = userPrompt;
    } catch (e) {
      await supabase.from("generation_requests").update({ status: "failed" }).eq("id", reqRow.id);
      return NextResponse.json({ error: `Step ${i + 1} failed: ${(e as Error).message}` }, { status: 500 });
    }
  }

  // 5. Save the final output as captions (one per line, numbering stripped)
  const captions = (previous ?? "")
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/^["“]|["”]$/g, "").trim())
    .filter(Boolean)
    .slice(0, 10);

  const { error: capErr } = await supabase.from("captions").insert(
    captions.map((caption_text) => ({
      image_id: imageRow.id,
      chain_id: chainId,
      caption_text,
      prompt_used: lastPrompt,
    }))
  );
  if (capErr) return NextResponse.json({ error: capErr.message }, { status: 500 });

  await supabase.from("generation_requests").update({ status: "completed" }).eq("id", reqRow.id);

  return NextResponse.json({ imageUrl, outputs, captions });
}