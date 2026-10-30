import { requireUser } from "@/server/auth";
import { PageHeader } from "@/components/ui";

const STEPS = [
  "Open the Shortcuts app → + → Add Action → search “Dictate Text” (or “Ask for Input” for typing).",
  "Add “Get Contents of URL”. URL: your Hearth address + /api/shortcuts. Method: POST.",
  "Headers: Authorization = Bearer <your key> (create one in Settings → Siri & Shortcuts).",
  "Request Body: JSON, key “text”, value: the Dictated Text variable.",
  "Add “Speak Text” with the Contents of URL (and “Show Result” if you like reading it).",
  "Name the shortcut “Hearth”. Now say “Hey Siri, Hearth” and speak your request.",
];

const EXAMPLES = [
  ["Add milk and eggs to the grocery list", "Adds both instantly"],
  ["We're out of dish soap", "Adds it to groceries"],
  ["Remind me to call the plumber", "Creates a task"],
  ["I took out the trash", "Marks the chore done and schedules the next one"],
  ["What's my day look like?", "Reads your briefing"],
  ["Goodnight", "Runs your Goodnight routine"],
  ["When does the passport expire?", "Asks the assistant (searches the vault)"],
];

export default async function Shortcuts() {
  await requireUser();
  return (
    <div className="mx-auto max-w-[760px] px-5 md:px-10 pt-10 md:pt-14 pb-12">
      <PageHeader title="Siri & Shortcuts" subtitle="Talk to Hearth from Siri, CarPlay, Apple Watch or the Action button." />
      <section className="card rise mt-8 p-6">
        <h2 className="text-[15px] font-semibold tracking-tight">One-time setup on each iPhone</h2>
        <ol className="mt-4 list-decimal space-y-2.5 pl-5 text-[14px] text-fg-2">{STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
        <p className="mt-4 text-[12px] text-fg-3">Tip: make a second shortcut called “Goodnight” with the text fixed to “Goodnight”, so “Hey Siri, Goodnight” runs it in one step. Away from home, this works over Tailscale.</p>
      </section>
      <section className="card rise mt-4 p-6">
        <h2 className="text-[15px] font-semibold tracking-tight">Things you can say</h2>
        <ul className="mt-3 divide-y divide-line">{EXAMPLES.map(([say, does]) => (
          <li key={say} className="flex gap-4 py-2.5 text-[14px]"><span className="flex-1">“{say}”</span><span className="text-fg-3 text-[13px]">{does}</span></li>
        ))}</ul>
        <p className="mt-4 text-[12px] text-fg-3">Voice can't unlock doors or delete anything. Requests like that are queued for you to approve in the app with your PIN.</p>
      </section>
    </div>
  );
}
