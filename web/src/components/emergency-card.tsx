import { EMERGENCY_FIELDS } from "@/server/emergency";

/** Read-only rendering shared by the in-app page and the house-sitter link. */
export function EmergencyCard({ values, wifi }: { values: Record<string, string>; wifi: string | null }) {
  const groups = [...new Set(EMERGENCY_FIELDS.map((f) => f.group))];
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const fields = EMERGENCY_FIELDS.filter((f) => f.group === g && values[f.name]);
        const showWifi = g === "Home" && wifi;
        if (!fields.length && !showWifi) return null;
        return (
          <section key={g} className="card p-5">
            <p className="eyebrow">{g}</p>
            <dl className="mt-3 divide-y divide-line">
              {fields.map((f) => (
                <div key={f.name} className="grid gap-1 py-2.5 sm:grid-cols-[200px_1fr]"><dt className="text-[13px] text-fg-3">{f.label}</dt><dd className="whitespace-pre-wrap text-[15px]">{values[f.name]}</dd></div>
              ))}
              {showWifi && <div className="grid gap-1 py-2.5 sm:grid-cols-[200px_1fr]"><dt className="text-[13px] text-fg-3">Wi-Fi password</dt><dd className="font-mono text-[15px]">{wifi}</dd></div>}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
