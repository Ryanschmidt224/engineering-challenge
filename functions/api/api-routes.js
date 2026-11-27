// Exact API dispatch is declared once, independent of source formatting.
import { handleAutomaticSiteBackups } from "./automatic-site-backups.js";
import { handleAutomaticBackupStatus } from "./automatic-backup-status.js";
import { handleSiteDataBackup } from "./site-data-backup.js";
import { handleAccounts } from "./accounts.js";
import { onRequest as workshopLookupApi } from "./workshop-lookup.js";
import { handleFamilyWorkshop } from "./workshop-db.js";
import {
  handleFamilyWorkshopFile,
  handleWorkshopExport,
} from "./family-workshop-files.js";
import { handleLessons, handleLessonPhoto } from "./lessons-learned.js";
import { auth } from "./auth.js";

export const apiRoutes = [
  ["/api/automatic-site-backups", handleAutomaticSiteBackups],
  ["/api/backup-status", handleAutomaticBackupStatus],
  ["/api/site-data-backup", handleSiteDataBackup],
  ["/api/accounts", handleAccounts],
  ["/api/workshop", handleFamilyWorkshop],
  ["/api/workshop/file", handleFamilyWorkshopFile],
  ["/api/workshop/export", handleWorkshopExport],
  [
    "/api/workshop-lookup",
    (request, env, ctx) => workshopLookupApi({ request, env, ctx }),
  ],
  ["/api/lessons-learned", handleLessons],
  ["/api/lessons-learned/photo", handleLessonPhoto],
  ["/api/auth", auth],
];
export function createApiDispatch(routes) {
  const dispatch = new Map();
  for (const [path, handler] of routes) {
    if (!path.startsWith("/api/") || typeof handler !== "function")
      throw Error("Invalid API route: " + path);
    if (dispatch.has(path)) throw Error("Duplicate API route: " + path);
    dispatch.set(path, handler);
  }
  return dispatch;
}
export const apiDispatch = createApiDispatch(apiRoutes);
