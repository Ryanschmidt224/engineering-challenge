import {test} from "node:test";
import assert from "node:assert/strict";
import {componentPhotoIndex} from "../functions/api/component-photos.js";
import {TestR2} from "./helpers/r2.mjs";
test("thumbnail metadata discovers unversioned photos, exact current revisions and inherited Workshop photos",async()=>{
 const bucket=new TestR2(),version=crypto.randomUUID();
 await bucket.put("component-thumbnails/launcher/old",new Uint8Array([1]));
 await bucket.put("component-thumbnails/launcher/changed/"+version,new Uint8Array([2]));
 await bucket.put("component-thumbnails/robot/missing",new Uint8Array([3]));
 await bucket.put("workshop-photo",new Uint8Array([4]));
 const present=await componentPhotoIndex(bucket,"launcher");
 assert.equal(await present({id:"missing"}),false);
 assert.equal(await present({id:"old"}),true);
 assert.equal(await present({id:"changed",photoRevision:version}),true);
 assert.equal(await present({id:"changed",photoRevision:crypto.randomUUID()}),false);
 assert.equal(await present({id:"inherited"},{photoKey:"workshop-photo"}),true);
 assert.equal(await present({id:"inherited",photoRevision:version},{photoKey:"workshop-photo"}),false);
});
test("thumbnail discovery follows every page and refuses an incomplete listing",async()=>{
 let n=0;const bucket={async list({cursor}){n++;return cursor?{objects:[{key:"component-thumbnails/launcher/last"}],truncated:false}:{objects:[],truncated:true,cursor:"next"};}};
 assert.equal(await(await componentPhotoIndex(bucket,"launcher"))({id:"last"}),true);assert.equal(n,2);
 await assert.rejects(componentPhotoIndex({async list(){return {objects:[],truncated:true};}},"launcher"),/incomplete/);
});
