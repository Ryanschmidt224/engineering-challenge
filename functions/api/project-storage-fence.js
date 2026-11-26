import {statement} from "./project-state.js";
import {CommandConflict} from "./project-command.js";
import {CURRENT_ENGINE_SCHEMA_SQL} from "./project-restore-guards.js";
import {deletionJob} from "./project-delete-status.js";

// D1 triggers are the final metadata admission fence, including for old writers.
// Check around R2 puts too: a put already in flight can leave unlinked bytes,
// but it must never return success or become a newly referenced file afterward.
export async function assertStorageKeyWritable(db,key){
 const project=key.match(/^project-engine\/(?:files|restored|workshop)\/([a-f\d-]{36})\//i)?.[1];
 if(project&&await deletionJob(db,project))throw new CommandConflict("This project is being permanently deleted.");
 const result=await statement(db,`SELECT (${CURRENT_ENGINE_SCHEMA_SQL}) AS compatible,EXISTS(SELECT 1 FROM engine_retired_file_keys WHERE r2_key=?) AS retired`,key).first();
 if(!result?.compatible||result.retired)throw new CommandConflict("This storage key was retired or requires a newer engine. Keep your file and start a new upload or recovered copy.");
}
