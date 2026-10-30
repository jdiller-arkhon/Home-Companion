import Link from "next/link";
import clsx from "clsx";
import { requireUser } from "@/server/auth";
import { listConversations, getConversation, messages } from "@/server/assistant/conversations";
import { pendingActions } from "@/server/assistant/tools";
import { memoriesFor } from "@/server/assistant/memory";
import { Assistant, NewChatLink } from "@/components/assistant";
import { Memories } from "@/components/memories";
import { Live } from "@/components/live";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ c?: string; new?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const convs = listConversations(user.id);
  const active = sp.new ? null : sp.c ? getConversation(user.id, sp.c) : null;
  const initial = active ? messages(active.id).map((m) => ({ role: m.role, content: m.content })) : [];
  const actions = pendingActions(user.id).filter((a) => !active || a.conversation_id === active.id).map((a) => ({ id: a.id, summary: a.summary, level: a.level }));
  return (
    <div className="mx-auto grid max-w-[1180px] gap-8 px-5 md:px-10 lg:grid-cols-[1fr_260px]">
      <Live />
      <div className="mx-auto w-full max-w-[720px] pt-8 md:pt-12">
        <Assistant name={getSettings().assistant_name} key={active?.id ?? "new"} conversationId={active?.id} initial={initial} actions={actions}
          suggestions={["What's my day look like?", "Add oat milk and eggs to the grocery list", "What maintenance is coming up?", "Turn off all the lights", "When does the car registration expire?"]} />
      </div>
      <aside className="hidden lg:block sticky top-0 h-dvh overflow-y-auto border-l border-line py-12 pl-6">
        <div className="flex items-center"><h2 className="eyebrow">Conversations</h2><span className="ml-auto"><NewChatLink /></span></div>
        <ul className="mt-3 space-y-0.5">{convs.map((c) => (
          <li key={c.id}><Link href={`/assistant?c=${c.id}`} className={clsx("block truncate rounded-lg px-2.5 py-1.5 text-[13px]", c.id === active?.id ? "bg-fill text-fg" : "text-fg-2 hover:bg-fill")}>{c.title}</Link></li>
        ))}</ul>
        {convs.length === 0 && <p className="mt-2 text-[12px] text-fg-3">No conversations yet.</p>}
        <h2 className="eyebrow mt-10">Memory</h2>
        <div className="mt-3"><Memories items={memoriesFor(user.id).map((m) => ({ id: m.id, content: m.content, household: m.user_id === null }))} /></div>
        <Link href="/system" className="mt-10 block text-[12px] text-fg-3 hover:text-fg">Every action is logged — view audit log →</Link>
      </aside>
    </div>
  );
}
