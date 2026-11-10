"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { btnPrimary, card } from "@/lib/ui";

export default function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const error = searchParams.get("error");

  const login = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className={`${card} w-full max-w-sm p-8`}>
        <h1 className="mb-6 text-xl font-bold text-yellow-500">Prompt Chain Studio</h1>
        <button onClick={login} className={`${btnPrimary} w-full py-3`}>
          Log in with Google
        </button>
        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
      </div>
    </main>
  );
}