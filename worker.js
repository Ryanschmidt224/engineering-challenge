import {onRequest as numberingApi} from "./functions/api/numbering.js";
import {handleProposals} from "./functions/api/proposals.js";
import {onRequest as projectsApi,projectAllowed,canEditProject} from "./functions/api/projects.js";
import {handleAccounts} from "./functions/api/accounts.js";
import {onRequest as myBuildApi} from "./functions/api/my-build.js";
import {onRequest as buildConfusionApi} from "./functions/api/build-confusion.js";
import {onRequest as projectTasksApi} from "./functions/api/project-tasks.js";
import {handleTree} from "./functions/api/tree.js";
import {handleWires,handleHarness} from "./functions/api/wires.js";
import {handleCommonParts} from "./functions/api/commonparts.js";
import {handlePurchasedParts} from "./functions/api/purchased-parts.js";
import {handlePartFiles} from "./functions/api/part-files.js";
import {handlePartPages} from "./functions/api/part-pages.js";
import {handleWorkspace} from "./functions/api/workspace.js";
import {handleInvestigations} from "./functions/api/investigations.js";
import {handleRecipeFiles} from "./functions/api/recipe-files.js";
import {handleProjectArchive} from "./functions/api/project-archive.js";
import {handleArchiveStaging} from "./functions/api/archive-staging.js";
import {backupAllProjects,handleAutomaticBackups} from "./functions/api/automatic-backups.js";
import {handleDrawings} from "./functions/api/drawings.js";
import {auth} from "./functions/api/auth.js";
import {handleComponents,handleExtract,handleComponentPhoto} from "./functions/api/components.js";
import {onRequestGet as listPhotos,onRequestPost as uploadPhoto,onRequestDelete as deletePhoto} from "./functions/api/photos.js";
import {onRequestGet as getPhoto} from "./functions/api/photo.js";
export default {
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname;
    try{
      if(path==="/api/accounts")return handleAccounts(request,env);
      if(path==="/api/projects")return projectsApi({request,env,ctx});
      if(path==="/api/numbering")return numberingApi({request,env,ctx});
      if(path==="/api/proposals")return handleProposals(request,env);
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
      if(path==="/api/my-build")return myBuildApi({request,env,ctx});
      if(path==="/api/build-confusion")return buildConfusionApi({request,env,ctx});
      if(path==="/api/project-tasks")return projectTasksApi({request,env,ctx});
      if(path==="/api/tree")return handleTree(request,env);
      if(path==="/api/wires")return handleWires(request,env);
      if(path==="/api/commonparts")return handleCommonParts(request,env);
      if(path==="/api/purchased-parts")return handlePurchasedParts(request,env);
      if(path==="/api/part-files")return handlePartFiles(request,env);
      if(path==="/api/part-pages")return handlePartPages(request,env);
      if(path==="/api/harness")return handleHarness(request,env);
      if(path==="/api/workspace")return handleWorkspace(request,env);
      if(path==="/api/investigations")return handleInvestigations(request,env);
      if(path==="/api/recipe-files")return handleRecipeFiles(request,env);
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
      return env.ASSETS.fetch(request);
    }catch(error){
      console.error("Request failed",error);
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
