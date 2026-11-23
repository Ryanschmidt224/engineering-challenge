import {test} from "node:test";
import assert from "node:assert/strict";
import {createProjectClient} from "../assets/project-client.js";
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
test("late loads cannot replace the current project or overwrite the token of an admitted save",async()=>{
 const original=globalThis.fetch,requests=[];globalThis.fetch=(url,options)=>{const gate=deferred();requests.push({url,options,...gate});return gate.promise;};
 try{
  const client=createProjectClient(),first=client.load("first"),second=client.load("second");requests[1].resolve(Response.json({project:{id:"second",revision:"loaded"}}));await second;requests[0].resolve(Response.json({project:{id:"first",revision:"late"}}));await first;assert.equal(client.state.project.id,"second");
  const late=client.load("second"),save=client.write("second","","PATCH",{name:"Changed"});requests[3].resolve(Response.json({revision:"saved"}));await save;requests[2].resolve(Response.json({project:{id:"second",revision:"outdated"}}));await late;assert.equal(client.state.project.revision,"saved");
 }finally{globalThis.fetch=original;}
});
test("transport retry reuses its body, edited content gets a different operation and conflicts never retry silently",async()=>{
 const original=globalThis.fetch,bodies=[];let mode="network";globalThis.fetch=async(url,options)=>{bodies.push(JSON.parse(options.body));if(mode==="network"){mode="ok";throw Error("Connection lost");}if(mode==="server")return Response.json({error:"Ambiguous gateway failure"},{status:502});if(mode==="conflict")return Response.json({error:"Changed elsewhere"},{status:409});return Response.json({revision:crypto.randomUUID()});};
 try{
  const client=createProjectClient(),projectId=crypto.randomUUID(),revision=crypto.randomUUID();await assert.rejects(client.write(projectId,"/items","POST",{name:"Original"},revision),/Connection lost/);await client.write(projectId,"/items","POST",{name:"Original"},revision);assert.deepEqual(bodies[0],bodies[1]);
  await client.write(projectId,"/items","POST",{name:"Edited"},revision);assert.notEqual(bodies[2].operationId,bodies[1].operationId);mode="conflict";const before=bodies.length;await assert.rejects(client.write(projectId,"/items","POST",{name:"Stale draft"},revision),error=>error.status===409);assert.equal(bodies.length,before+1);
  mode="server";await assert.rejects(client.write(projectId,"/items","POST",{name:"Gateway retry"},revision),error=>error.status===502);const attempted=bodies.at(-1);mode="ok";await client.write(projectId,"/items","POST",{name:"Gateway retry"},revision);assert.deepEqual(bodies.at(-1),attempted);
 }finally{globalThis.fetch=original;}
});
