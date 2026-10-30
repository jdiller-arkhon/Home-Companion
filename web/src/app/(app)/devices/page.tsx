import Link from "next/link";
import { requireUser } from "@/server/auth";
import { haConfigured, listDevices, type Device } from "@/server/integrations/homeassistant";
import { summarizeHome } from "@/server/briefing";
import { DeviceGrid } from "@/components/devices";
import { PageHeader, Pill } from "@/components/ui";
import { Live } from "@/components/live";

export const dynamic = "force-dynamic";

export default async function Devices() {
  await requireUser();
  let devices: Device[] | null = null;
  let error: string | null = null;
  if (haConfigured()) {
    try { devices = await listDevices(); } catch (e) { error = e instanceof Error ? e.message : String(e); }
  }
  const sum = devices ? summarizeHome(devices) : null;
  return (
    <div className="mx-auto max-w-[1180px] px-5 md:px-10 pt-10 md:pt-14 pb-12">
      <Live />
      <PageHeader title="Home" subtitle={sum ? `${sum.total} devices · ${sum.lightsOn.length} lights on` : "Lights, locks, climate and sensors."}>
        {sum && (sum.unlocked.length || sum.open.length ? <Pill tone="warn">Attention needed</Pill> : <Pill tone="ok">Secure</Pill>)}
      </PageHeader>
      <div className="mt-8">
        {!haConfigured() ? (
          <div className="card rise mx-auto max-w-[520px] p-8 text-center">
            <h2 className="text-[17px] font-semibold tracking-tight">Connect Home Assistant</h2>
            <p className="mt-2 text-[14px] text-fg-2">Hearth controls your devices through Home Assistant running on your own network — no Apple Home or cloud account needed.</p>
            <Link href="/settings" className="press mt-5 inline-block rounded-[10px] bg-fg px-4 py-2 text-[13px] font-medium text-bg">Open Settings</Link>
          </div>
        ) : error ? (
          <div className="card p-6 text-[14px]"><p className="font-medium text-bad">Home Assistant is unavailable</p><p className="mt-1 text-fg-2">{error}</p></div>
        ) : devices!.length === 0 ? (
          <p className="text-[14px] text-fg-3">Home Assistant is connected but reports no supported devices yet.</p>
        ) : <DeviceGrid devices={devices!} />}
      </div>
    </div>
  );
}
