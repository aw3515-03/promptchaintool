"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function apply(theme: Theme) {
  const dark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      setTheme((localStorage.getItem("theme") as Theme) || "system");
    } catch {}
  }, []);

  // In system mode, follow OS changes live
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const choose = (t: Theme) => {
    setTheme(t);
    try {
      localStorage.setItem("theme", t);
    } catch {}
    apply(t);
  };

  return (
    <div className="flex overflow-hidden rounded border border-zinc-300 text-xs dark:border-zinc-700">
      {(["light", "dark", "system"] as Theme[]).map((t) => (
        <button
          key={t}
          onClick={() => choose(t)}
          className={`px-2.5 py-1 capitalize ${
            theme === t ? "bg-yellow-400 text-black" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}