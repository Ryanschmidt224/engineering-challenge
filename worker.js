import {handleTree} from "./functions/api/tree.js";
import {handleWires,handleHarness} from "./functions/api/wires.js";
import {handleWorkspace} from "./functions/api/workspace.js";
import {auth} from "./functions/api/auth.js";
import {handleComponents,handleExtract,handleComponentPhoto} from "./functions/api/components.js";
import {onRequestGet as listPhotos,onRequestPost as uploadPhoto,onRequestDelete as deletePhoto} from "./functions/api/photos.js";
import {onRequestGet as getPhoto} from "./functions/api/photo.js";
export default {
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname;
    try{
      if(path==="/api/tree")return handleTree(request,env);
      if(path==="/api/wires")return handleWires(request,env);
      if(path==="/api/harness")return handleHarness(request,env);
      if(path==="/api/workspace")return handleWorkspace(request,env);
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
  }
};
