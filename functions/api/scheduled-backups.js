import { automaticSiteBackup } from "./site-auto-backups.js";
import { runScheduledProjectBackups } from "./automatic-backup-status.js";
export async function runNightlyBackups(env, date) {
  const results = [],
    failures = [];
  // Whole-site coverage runs first. Project-only checks still run if it fails.
  for (const [scope, work] of [
    ["whole-site", automaticSiteBackup],
    ["projects", runScheduledProjectBackups],
  ]) {
    try {
      results.push({ scope, ...(await work(env, date)) });
    } catch (error) {
      console.error("Nightly backup scope failed", scope, error);
      failures.push(error);
    }
  }
  console.log(
    "Building Schmidt scheduled backup result",
    JSON.stringify(results),
  );
  if (failures.length)
    throw new AggregateError(
      failures,
      "One or more nightly backup scopes failed.",
    );
  return results;
}
