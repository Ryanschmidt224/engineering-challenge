/* Operator-only content cleanup helpers.
 * Not imported by the deployed Worker. Do not add an HTTP route for this code.
 * Never run without an independently verified offsite R2 backup.
 */
export const CONTENT_PREFIXES=Object.freeze([
 "project-catalog/","trees/","components/","workspaces/","part-workspaces/",
 "assembly-pages/","harnesses/","drawings/","component-thumbnails/",
 "part-files/","part-pages/","recipe-files/","part-revisions/","part-code/",
 "investigations/","proposals/","photos/","user-workshop/",
 "workshop-reference-overrides/","workshop-reference-photos/"
]);
export const CONTENT_EXACT_KEYS=Object.freeze([
 "libraries/common-parts.json","libraries/wires.json"
]);
export const PROTECTED_PREFIXES=Object.freeze([
 "accounts/","account-admin-claim/","automatic-backups/","archives/"
]);
export function isContentKey(key){
 if(typeof key!=="string")return false;
 if(PROTECTED_PREFIXES.some(prefix=>key.startsWith(prefix)))return false;
 return CONTENT_EXACT_KEYS.includes(key)||CONTENT_PREFIXES.some(prefix=>key.startsWith(prefix));
}
export async function planContentReset(bucket){
 if(!bucket?.list)throw Error("Cloudflare R2 bucket binding required");
 const keys=new Set();
 for(const prefix of CONTENT_PREFIXES){
  let cursor;
  do{
   const listing=await bucket.list({prefix,limit:1000,...(cursor?{cursor}:{})});
   for(const object of listing.objects||[]){
    if(isContentKey(object.key))keys.add(object.key);
   }
   if(!listing.truncated)break;
   if(!listing.cursor||listing.cursor===cursor)throw Error("Incomplete R2 listing for "+prefix);
   cursor=listing.cursor;
  }while(true);
 }
 for(const key of CONTENT_EXACT_KEYS){
  if(await bucket.head(key))keys.add(key);
 }
 return [...keys].sort();
}
export async function executeContentReset(bucket,{
 keys,confirmation,offsiteBackupVerified=false,expectedCount
}={}){
 if(confirmation!=="DELETE PROJECTS KNOWLEDGE WORKSHOP"||!offsiteBackupVerified)
  throw Error("Cleanup requires exact confirmation and independently verified offsite backup");
 if(!Array.isArray(keys)||!Number.isInteger(expectedCount)||keys.length!==expectedCount)
  throw Error("Explicit key list and expectedCount required");
 if(keys.some(key=>!isContentKey(key)))throw Error("Refusing to delete protected or unknown keys");
 // Re-enumerate: a changed dataset requires a fresh plan and operator review.
 const current=await planContentReset(bucket);
 if(current.length!==keys.length||current.some((key,index)=>key!==keys[index]))
  throw Error("R2 contents changed since review; re-plan before deletion");
 let deleted=0;
 for(const key of keys){
  await bucket.delete(key);
  deleted++;
 }
 return {deleted,protectedPrefixes:PROTECTED_PREFIXES};
}
