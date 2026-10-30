import { requireUser } from "@/server/auth";
import { getSettings, hasSecret } from "@/server/settings";
import { listUsers } from "@/server/users";
import { saveHousehold, saveHomeAssistant, saveAI, saveProfile, changeSecrets, invitePartner } from "@/server/settings-actions";
import { signOut } from "@/server/session-actions";
import { SettingsForm } from "@/components/settings-form";
import { PageHeader, Pill } from "@/components/ui";

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="rise grid gap-6 border-t border-line py-8 md:grid-cols-[240px_1fr]">
      <div><h2 className="text-[15px] font-semibold tracking-tight">{title}</h2><p className="mt-1 text-[13px] text-fg-3">{desc}</p></div>
      <div>{children}</div>
    </section>
  );
}

export default async function Settings() {
  const user = await requireUser();
  const s = getSettings();
  const admin = user.role === "admin";
  const users = listUsers();
  const p = user.prefs;
  return (
    <div className="mx-auto max-w-[980px] px-5 md:px-10 pt-10 md:pt-14 pb-12">
      <PageHeader title="Settings" subtitle="Every change here is saved and takes effect immediately.">
        <form action={signOut}><button className="press rounded-[10px] border border-line px-3.5 py-2 text-[13px] hover:bg-fill">Sign out</button></form>
      </PageHeader>
      <div className="mt-8">
        <Section title="Your profile" desc="Appearance, notifications and assistant behaviour for you only.">
          <SettingsForm action={saveProfile} fields={[
            { name: "name", label: "Name", value: user.name },
            { name: "theme", label: "Appearance", value: p.theme ?? "system", options: [["system", "Match device"], ["light", "Light"], ["dark", "Dark"]] },
            { name: "reduceMotion", label: "Reduce motion", type: "checkbox", value: p.reduceMotion },
            { name: "proactive", label: "Let the assistant suggest things proactively", type: "checkbox", value: p.proactive ?? true },
            { name: "n_bills", label: "Notify me about upcoming bills", type: "checkbox", value: p.notify?.bills ?? true },
            { name: "n_packages", label: "Notify me about deliveries", type: "checkbox", value: p.notify?.packages ?? true },
            { name: "n_maintenance", label: "Notify me about maintenance & warranties", type: "checkbox", value: p.notify?.maintenance ?? true },
            { name: "n_reminders", label: "Notify me about tasks, chores & occasions", type: "checkbox", value: p.notify?.reminders ?? true },
            { name: "n_security", label: "Notify me about doors, locks & device problems", type: "checkbox", value: p.notify?.security ?? true },
          ]} />
        </Section>
        <Section title="Password & PIN" desc="Your PIN confirms sensitive actions (unlocking doors, deleting records) and switches profiles quickly on the iPad.">
          <SettingsForm action={changeSecrets} submit="Update" fields={[
            { name: "current", label: "Current password", type: "password" },
            { name: "password", label: "New password (optional)", type: "password" },
            { name: "pin", label: user.has_pin ? "New PIN (optional)" : "Set a PIN (4–8 digits)", type: "password", hint: user.has_pin ? "A PIN is set." : "No PIN set yet." },
            ...(user.has_pin ? [{ name: "clear_pin", label: "Remove my PIN", type: "checkbox" }] : []),
          ]} />
        </Section>
        {admin && <>
          <Section title="Household" desc="Name, location for weather, time zone and currency.">
            <SettingsForm action={saveHousehold} fields={[
              { name: "household_name", label: "Household name", value: s.household_name },
              { name: "location_label", label: "Location label", value: s.location_label, placeholder: "Portland, OR" },
              { name: "latitude", label: "Latitude", value: s.latitude, placeholder: "45.52" },
              { name: "longitude", label: "Longitude", value: s.longitude, placeholder: "-122.68" },
              { name: "timezone", label: "Time zone", value: s.timezone, placeholder: "America/Los_Angeles" },
              { name: "currency", label: "Currency", value: s.currency },
              { name: "temperature_unit", label: "Temperature", value: s.temperature_unit, options: [["fahrenheit", "Fahrenheit"], ["celsius", "Celsius"]] },
            ]} />
          </Section>
          <Section title="People" desc="Two profiles, one household. Private items stay private.">
            <ul className="mb-5 space-y-2">{users.map((u) => <li key={u.id} className="flex items-center gap-2 text-[14px]">{u.name}<span className="text-fg-3">{u.email}</span>{u.role === "admin" && <Pill>Admin</Pill>}</li>)}</ul>
            <SettingsForm action={invitePartner} submit="Create profile" fields={[
              { name: "name", label: "Name" }, { name: "email", label: "Email", type: "email" },
              { name: "password", label: "Temporary password", type: "password", hint: "They can change it in Settings." },
              { name: "admin", label: "Administrator", type: "checkbox", value: true },
            ]} />
          </Section>
          <Section title="Home Assistant" desc="Hearth uses Home Assistant on your network as its smart-home engine. Create a long-lived access token in your HA profile.">
            <div className="mb-4">{s.ha_url && hasSecret("ha_token") ? <Pill tone="ok">Configured</Pill> : <Pill>Not connected</Pill>}</div>
            <SettingsForm action={saveHomeAssistant} submit="Save & test" fields={[
              { name: "ha_url", label: "Address", value: s.ha_url, placeholder: "http://homeassistant.local:8123" },
              { name: "ha_token", label: "Long-lived access token", type: "password", placeholder: hasSecret("ha_token") ? "•••••• (stored encrypted)" : "" },
            ]} />
          </Section>
          <Section title="AI models" desc="Local models via Ollama. Optionally point to a stronger GPU computer on your network; Hearth falls back to the Pi when it's off.">
            <SettingsForm action={saveAI} fields={[
              { name: "ai_endpoint", label: "Local model server", value: s.ai_endpoint },
              { name: "ai_model", label: "Model", value: s.ai_model, hint: "qwen2.5:3b runs well on a Pi 5 (8 GB)." },
              { name: "ai_remote_endpoint", label: "GPU computer (optional)", value: s.ai_remote_endpoint, placeholder: "http://gaming-pc.local:11434" },
              { name: "morning_briefing_hour", label: "Morning briefing hour", type: "number", value: s.morning_briefing_hour },
              { name: "ai_prefer_remote", label: "Prefer the GPU computer when available", type: "checkbox", value: s.ai_prefer_remote },
              { name: "evening_recap", label: "Send an evening recap", type: "checkbox", value: s.evening_recap },
            ]} />
          </Section>
        </>}
      </div>
    </div>
  );
}
