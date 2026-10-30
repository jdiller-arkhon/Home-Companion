/** Background jobs (Node runtime only): nightly encrypted backup. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.HEARTH_DISABLE_SCHEDULER === "true") return;
  const { runBackup, lastBackup } = await import("./server/backup");
  const { log } = await import("./server/log");
  setInterval(async () => {
    const last = lastBackup();
    const h = new Date().getHours();
    if (h === 3 && (!last || Date.now() - last.createdAt > 20 * 3_600_000)) {
      try { await runBackup("scheduled"); } catch (e) { log.error("backup.failed", { error: String(e) }); }
    }
  }, 10 * 60_000).unref();
}
