import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { signIn } from "@/server/session-actions";
import { userCount } from "@/server/users";

export const dynamic = "force-dynamic";

export default function Login() {
  if (userCount() === 0) redirect("/welcome");
  return (
    <div className="min-h-dvh grid place-items-center px-5">
      <div className="w-full max-w-[360px] rise">
        <div className="size-9 rounded-[10px] bg-fg grid place-items-center mb-8"><div className="size-3 rounded-full bg-bg" /></div>
        <h1 className="text-[28px] font-semibold tracking-[-0.03em]">Welcome home.</h1>
        <p className="mt-1.5 mb-8 text-[14px] text-fg-2">Sign in to continue.</p>
        <AuthForm action={signIn} submit="Sign in" fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "username" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]} />
      </div>
    </div>
  );
}
