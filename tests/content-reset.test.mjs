import {test} from "node:test";
import assert from "node:assert/strict";
import {planContentReset,executeContentReset,isContentKey} from "../scripts/content-reset.mjs";
class Bucket{
 constructor(keys){this.keys=new Set(keys);this.deleted=[]}
 async list({prefix,cursor,limit=1000}){
  const all=[...this.keys].filter(key=>key.startsWith(prefix)).sort();
  const start=cursor?Number(cursor):0;
  const rows=all.slice(start,start+limit);
  return {objects:rows.map(key=>({key})),truncated:start+limit<all.length,cursor:String(start+limit)};
 }
 async head(key){return this.keys.has(key)?{key}:null}
 async delete(key){this.deleted.push(key);this.keys.delete(key)}
}
test("cleanup plans include only allowlisted content and protect accounts and backups",async()=>{
 const bucket=new Bucket(["project-catalog/v1.json","components/launcher.json","user-workshop/u1/inventory.json",
 "workshop-reference-overrides/v1.json","accounts/u1.json","account-admin-claim/v1.json",
 "automatic-backups/launcher/checkpoint.bsproject","libraries/common-parts.json","unrecognized/other"]);
 const plan=await planContentReset(bucket);
 assert.deepEqual(plan,["components/launcher.json","libraries/common-parts.json","project-catalog/v1.json",
 "user-workshop/u1/inventory.json","workshop-reference-overrides/v1.json"]);
 assert.equal(isContentKey("accounts/u1.json"),false);
 assert.equal(isContentKey("automatic-backups/launcher/checkpoint.bsproject"),false);
});
test("destructive cleanup requires explicit consent and independently verified offsite backup",async()=>{
 const bucket=new Bucket(["project-catalog/v1.json","accounts/u1.json"]);
 const keys=await planContentReset(bucket);
 await assert.rejects(()=>executeContentReset(bucket,{keys,confirmation:"DELETE PROJECTS KNOWLEDGE WORKSHOP",expectedCount:1}),/offsite backup/);
 await assert.rejects(()=>executeContentReset(bucket,{keys,offsiteBackupVerified:true,confirmation:"delete everything",expectedCount:1}),/confirmation/);
 assert.deepEqual(bucket.deleted,[]);
 const result=await executeContentReset(bucket,{keys,offsiteBackupVerified:true,
  confirmation:"DELETE PROJECTS KNOWLEDGE WORKSHOP",expectedCount:1});
 assert.equal(result.deleted,1);
 assert.deepEqual(bucket.deleted,["project-catalog/v1.json"]);
 assert.equal(bucket.keys.has("accounts/u1.json"),true);
});
test("cleanup refuses stale plans or unknown keys",async()=>{
 const bucket=new Bucket(["project-catalog/v1.json"]);
 const keys=await planContentReset(bucket);
 bucket.keys.add("components/linear.json");
 await assert.rejects(()=>executeContentReset(bucket,{keys,offsiteBackupVerified:true,
  confirmation:"DELETE PROJECTS KNOWLEDGE WORKSHOP",expectedCount:keys.length}),/changed/);
 await assert.rejects(()=>executeContentReset(bucket,{keys:["accounts/u1"],offsiteBackupVerified:true,
  confirmation:"DELETE PROJECTS KNOWLEDGE WORKSHOP",expectedCount:1}),/protected/);
 assert.deepEqual(bucket.deleted,[]);
});
