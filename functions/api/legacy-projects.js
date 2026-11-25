// Switch legacy projects to read-only in the same deployment that enables the
// engine. Keep authorization separate: old files, history and exports still read.
export const legacyProjectsReadOnly=env=>env.NEW_PROJECT_ENGINE==="1";
const routes=new Set([
 "/api/projects","/api/numbering","/api/tree","/api/wires","/api/harness",
 "/api/workspace","/api/components","/api/components/photo","/api/components/extract",
 "/api/part-files","/api/project-files","/api/part-pages","/api/part-code",
 "/api/unstructured-notes","/api/investigations","/api/assembly-archive",
 "/api/project-milestones","/api/recipe-files","/api/photo-annotations",
 "/api/project/archive","/api/project/staging","/api/project/backups",
 "/api/drawings","/api/photos","/api/photo"
]);
export const legacyReadOnlyResponse=()=>Response.json({
 error:"Legacy projects are read-only. Use the new Projects page for new work.",
 code:"LEGACY_READ_ONLY"
},{status:409,headers:{"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
export function guardLegacyProjectWrite(request,env){
 return legacyProjectsReadOnly(env)&&!["GET","HEAD"].includes(request.method)&&routes.has(new URL(request.url).pathname)
  ?legacyReadOnlyResponse():null;
}
