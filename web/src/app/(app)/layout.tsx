import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { userCount } from "@/server/users";
import { getSettings } from "@/server/settings";
import { Shell } from "@/components/shell";
import { Pwa } from "@/components/pwa";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (userCount() === 0) redirect("/welcome");
  const user = await requireUser();
  return (
    <>
      <Pwa theme={user.prefs.theme} reduceMotion={user.prefs.reduceMotion} />
      <Shell user={{ name: user.name }} household={getSettings().household_name}>{children}</Shell>
    </>
  );
}
