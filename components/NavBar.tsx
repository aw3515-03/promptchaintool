import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { signOut } from "@/app/actions";
import { btn } from "@/lib/ui";

export default function NavBar() {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
      <Link href="/" className="text-lg font-bold text-yellow-500">
        Prompt Chain Studio
      </Link>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <form action={signOut}>
          <button className={btn}>Sign out</button>
        </form>
      </div>
    </header>
  );
}