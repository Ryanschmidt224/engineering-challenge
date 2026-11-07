import {onRequestGet as listPhotos,onRequestPost as uploadPhoto,onRequestDelete as deletePhoto} from "./functions/api/photos.js";
import {onRequestGet as getPhoto} from "./functions/api/photo.js";
export default {
  async fetch(request,env,ctx){
    const path=new URL(request.url).pathname;
    try{
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
