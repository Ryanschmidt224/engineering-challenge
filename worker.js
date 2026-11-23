import {onRequest as numberingApi} from "./functions/api/numbering.js";
import {onRequest as projectsApi,projectAllowed,canEditProject} from "./functions/api/projects.js";
import {onRequest as unstructuredNotesApi} from "./functions/api/unstructured-notes.js";
import {handleAccounts} from "./functions/api/accounts.js";
import {handleTree} from "./functions/api/tree.js";
import {handleWires,handleHarness} from "./functions/api/wires.js";
import {onRequest as workshopLookupApi} from "./functions/api/workshop-lookup.js";
import {handlePartFiles} from "./functions/api/part-files.js";
import {handleProjectFiles} from "./functions/api/project-files.js";
import {handlePartPages} from "./functions/api/part-pages.js";
import {handleWorkspace} from "./functions/api/workspace.js";
import {handleInvestigations} from "./functions/api/investigations.js";
import {handleAssemblyArchive} from "./functions/api/assembly-archive.js";
import {handleProjectMilestones} from "./functions/api/project-milestones.js";
import {handleRecipeFiles} from "./functions/api/recipe-files.js";
import {handleProjectArchive} from "./functions/api/project-archive.js";
import {handleArchiveStaging} from "./functions/api/archive-staging.js";
import {backupAllProjects,handleAutomaticBackups} from "./functions/api/automatic-backups.js";
import {handleDrawings} from "./functions/api/drawings.js";
import {auth} from "./functions/api/auth.js";
import {handleComponents,handleExtract,handleComponentPhoto} from "./functions/api/components.js";
import {onRequestGet as listPhotos,onRequestPost as uploadPhoto,onRequestDelete as deletePhoto} from "./functions/api/photos.js";
import {onRequestGet as getPhoto} from "./functions/api/photo.js";
import {handlePhotoAnnotations} from "./functions/api/photo-annotations.js";
import {handlePartCode} from "./functions/api/part-code.js";
import {guardPrivateApi} from "./functions/api/private-access.js";
import {handleFamilyWorkshop} from "./functions/api/workshop-db.js";
import {handleFamilyWorkshopFile,handleWorkshopExport} from "./functions/api/family-workshop-files.js";
import {handleKnowledge} from "./functions/api/knowledge.js";
export default {
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname;
    try{
      const denied=await guardPrivateApi(request,env);
      if(denied)return denied;
      if(path==="/api/accounts")return await handleAccounts(request,env);
      if(path==="/api/workshop")return handleFamilyWorkshop(request,env);
      if(path==="/api/workshop/file")return handleFamilyWorkshopFile(request,env);
      if(path==="/api/workshop/export")return handleWorkshopExport(request,env);
      if(path==="/api/knowledge")return handleKnowledge(request,env);
      if(["/api/commonparts","/api/purchased-parts","/api/personal-workshop","/api/workshop-photo","/api/workshop-reference","/api/workshop-templates","/api/workshop-image-import"].includes(path))return Response.json({error:"This Workshop has been replaced by families and products.",code:"WORKSHOP_RETIRED"},{status:410,headers:{"cache-control":"no-store"}});
      if(path==="/api/projects")return projectsApi({request,env,ctx});
      if(path==="/api/numbering")return numberingApi({request,env,ctx});
      // A private project must not be readable by guessing an API or asset URL.
      const u=new URL(request.url);
      let scoped=u.searchParams.get("project");
      if(path==="/api/photo"||path==="/api/photos"&&request.method==="DELETE"){
       const photoKey=u.searchParams.get("id")||"";
       scoped=photoKey.split("/")[0]||scoped;
      }
      if(path==="/api/photos"&&request.method==="POST")scoped=request.headers.get("x-photo-project");
      if(scoped&&path.startsWith("/api/")&&
         !await projectAllowed(env,scoped,request))
        return new Response(JSON.stringify({error:"Project not found or private"}),{status:404,headers:{"content-type":"application/json","cache-control":"no-store"}});
      if(scoped&&path==="/api/photo"&&request.method!=="GET"&&!await canEditProject(request,env,scoped))
       return new Response("Forbidden",{status:403});
      if(path==="/api/tree")return handleTree(request,env);
      if(path==="/api/wires")return handleWires(request,env);
      if(path==="/api/workshop-lookup")return workshopLookupApi({request,env,ctx});
      if(path==="/api/part-files")return handlePartFiles(request,env);
      if(path==="/api/project-files")return handleProjectFiles(request,env);
      if(path==="/api/part-pages")return handlePartPages(request,env);
      if(path==="/api/harness")return handleHarness(request,env);
      if(path==="/api/workspace")return handleWorkspace(request,env);
      if(path==="/api/unstructured-notes")return unstructuredNotesApi({request,env,ctx});
      if(path==="/api/investigations")return handleInvestigations(request,env);
      if(path==="/api/assembly-archive")return handleAssemblyArchive(request,env);
      if(path==="/api/project-milestones")return handleProjectMilestones(request,env);
      if(path==="/api/recipe-files")return handleRecipeFiles(request,env);
      if(path==="/api/photo-annotations")return handlePhotoAnnotations(request,env);
      if(path==="/api/part-code")return handlePartCode(request,env);
      if(path==="/api/project/archive")return handleProjectArchive(request,env);
      if(path==="/api/project/staging")return handleArchiveStaging(request,env);
      if(path==="/api/project/backups")return handleAutomaticBackups(request,env);
      if(path==="/api/drawings")return handleDrawings(request,env);
      if(path==="/api/auth")return auth(request,env);
      if(path==="/api/components")return handleComponents(request,env);
      if(path==="/api/components/photo")return handleComponentPhoto(request,env);
      if(path==="/api/components/extract")return handleExtract(request,env);
      if(path==="/api/photos"){
        const args={request,env,ctx};
        if(request.method==="GET")return listPhotos(args);
        if(request.method==="POST")return uploadPhoto(args);
        if(request.method==="DELETE")return deletePhoto(args);
        return new Response("Method not allowed",{status:405,headers:{Allow:"GET, POST, DELETE"}});
      }
      if(path==="/api/photo"){
        if(request.method==="GET")return getPhoto({request,env,ctx});
        return new Response("Method not allowed",{status:405,headers:{Allow:"GET"}});
      }
      if(path.startsWith("/api/"))return Response.json({error:"API route not found"},{status:404,headers:{"cache-control":"no-store"}});
      return env.ASSETS.fetch(request);
    }catch(error){
      // Return a structured, non-sensitive error for account failures.
      const diagnosticId=crypto.randomUUID();
      console.error("Request failed",diagnosticId,path,error);
      if(path==="/api/accounts")return new Response(JSON.stringify({
       error:"The account service encountered an unexpected error. Contact the site administrator with this reference if it persists.",
       code:"ACCOUNT_UNEXPECTED_ERROR",reference:diagnosticId
      }),{status:500,headers:{"content-type":"application/json","cache-control":"no-store"}});
      return new Response("Internal server error",{status:500});
    }
  },
  async scheduled(event,env,ctx){
    ctx.waitUntil(backupAllProjects(env,new Date(event.scheduledTime)).then(result=>{
     console.log("Building Schmidt scheduled backup result",JSON.stringify(result));
     if(result.some(item=>item.status==="failed"))throw Error("One or more scheduled project backups failed");
    }));
  }
};
