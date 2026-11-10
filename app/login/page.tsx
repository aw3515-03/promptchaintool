import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<p className="p-8">Loading...</p>}>
      <LoginForm />
    </Suspense>
  );
}