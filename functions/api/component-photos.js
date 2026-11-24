import {partPhotoKey} from "./workshop-linked-part.js";

// Discover older unversioned thumbnails too. A missing photo is metadata, not
// a failed image request from every part page or picture-BOM tile.
export async function componentPhotoIndex(bucket,project){
 const keys=new Set();let cursor;
 do{
  const page=await bucket.list({prefix:"component-thumbnails/"+project+"/",limit:1000,...(cursor?{cursor}:{})});
  for(const object of page.objects)keys.add(object.key);
  if(!page.truncated)break;
  if(!page.cursor||page.cursor===cursor)throw Error("Part photo listing was incomplete. Retry loading the project.");
  cursor=page.cursor;
 }while(true);
 const hasOwn=part=>keys.has(partPhotoKey(project,part));
 const present=async(part,source)=>hasOwn(part)||!part.photoRevision&&!!source?.photoKey&&!!await bucket.head(source.photoKey);
 present.hasOwn=hasOwn;
 return present;
}
