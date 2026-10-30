import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { setupHousehold } from "@/server/session-actions";
import { userCount } from "@/server/users";

export const dynamic = "force-dynamic";

export default function Welcome() {
  if (userCount() > 0) redirect("/login");
  return (
    <div className="min-h-dvh grid place-items-center px-5 py-12">
      <div className="w-full max-w-[400px] rise">
        <p className="eyebrow">Set up · Step 1</p>
        <h1 className="mt-2 text-[30px] font-semibold tracking-[-0.03em]">Let's set up your home.</h1>
        <p className="mt-1.5 mb-8 text-[14px] text-fg-2">Everything stays on your own hardware. You can invite your partner next.</p>
        <AuthForm action={setupHousehold} submit="Create household" fields={[
          { name: "household", label: "Household name" },
          { name: "name", label: "Your name", autoComplete: "given-name" },
          { name: "email", label: "Email", type: "email", autoComplete: "username" },
          { name: "password", label: "Password (10+ characters)", type: "password", autoComplete: "new-password" },
        ]} />
      </div>
    </div>
  );
}
