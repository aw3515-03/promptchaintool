import NavBar from "@/components/NavBar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <div className="mx-auto max-w-4xl p-6">{children}</div>
    </>
  );
}