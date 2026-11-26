export const deletionJob=(db,projectId)=>db.prepare("SELECT * FROM engine_project_deletions WHERE project_id=?").bind(projectId).first();
export function projectDeletionPrefixes(projectId){
 if(typeof projectId!=="string"||!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(projectId))throw Error("Invalid deletion project ID.");
 return ["project-engine/files/"+projectId+"/","project-engine/restored/"+projectId+"/","project-engine/workshop/"+projectId+"/","automatic-backups/engine/"+projectId+"/"];
}
