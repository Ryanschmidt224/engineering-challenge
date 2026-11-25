import {PROJECT_ENGINE_SCHEMA_VERSION} from "./project-engine-migrations.js";
export const CURRENT_ENGINE_SCHEMA_SQL="(SELECT MAX(version) FROM project_engine_migrations)="+PROJECT_ENGINE_SCHEMA_VERSION;
export function openRestoreOperation(alias="j"){
 if(!/^[a-z]+$/.test(alias))throw Error("Use an internal restore alias.");
 return `${alias}.cleanup_token IS NULL AND NOT EXISTS(SELECT 1 FROM engine_restore_jobs closed WHERE closed.project_id=${alias}.project_id AND closed.actor_id=${alias}.actor_id AND closed.operation_id=${alias}.operation_id AND closed.cleanup_token IS NOT NULL)`;
}
