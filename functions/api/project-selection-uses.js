import {initializeProjectEngine} from "./project-engine-migrations.js";
import {accountUser} from "./accounts.js";
// New uses are read from project-owned selections. Never dual-write workshop_uses.
export async function projectSelectionUses(request,env){
 if(env.NEW_PROJECT_ENGINE!=="1")return [];
 const owner=await accountUser(request,env);if(!owner)return [];
 await initializeProjectEngine(env.WORKSHOP_DB);
 return (await env.WORKSHOP_DB.prepare(`SELECT o.id AS occurrence_id,i.id AS item_id,i.name,i.part_number,s.family_id,s.product_id,p.id AS project_id,p.name AS project_name,o.quantity,o.unit,o.removed_at,
 CASE WHEN o.removed_at IS NULL THEN 0 ELSE 1 END AS archived FROM engine_selections s JOIN engine_items i ON i.project_id=s.project_id AND i.id=s.id JOIN engine_projects p ON p.id=i.project_id JOIN engine_occurrences o ON o.project_id=i.project_id AND o.item_id=i.id WHERE p.owner_id=? AND p.restore_job_id IS NULL ORDER BY p.name,i.name,o.id LIMIT 1001`).bind(owner.id).all()).results;
}
