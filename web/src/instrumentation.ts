/** Background jobs (Node runtime only): routines each minute, reminders every 5 min, nightly backup. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.HEARTH_DISABLE_SCHEDULER === "true") return;
  const { runBackup, lastBackup } = await import("./server/backup");
  const { log } = await import("./server/log");
  const { sweepReminders } = await import("./server/reminders");
  const { tickRoutines } = await import("./server/routines");
  const { syncExternal } = await import("./server/calendar");
  void syncExternal().catch(() => {});
  setInterval(() => void syncExternal().catch((e) => log.error("calendar.sync", { error: String(e) })), 30 * 60_000).unref();
  setInterval(async () => {
    try { await tickRoutines(); } catch (e) { log.error("routines.failed", { error: String(e) }); }
  }, 60_000).unref();
  setInterval(async () => {
    try { await sweepReminders(); } catch (e) { log.error("reminders.failed", { error: String(e) }); }
  }, 5 * 60_000).unref();
  setInterval(async () => {
    const last = lastBackup();
    const h = new Date().getHours();
    if (h === 3 && (!last || Date.now() - last.createdAt > 20 * 3_600_000)) {
      try { await runBackup("scheduled"); } catch (e) { log.error("backup.failed", { error: String(e) }); }
    }
  }, 10 * 60_000).unref();
}
