import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestResult} from '../assets/request-result.js';
test('unreadable and invalid successful writes stay unconfirmed; failure statuses retain recovery guidance',async()=>{
 for(const response of [new Response('{',{status:200}),Response.json(null),Response.json([])])
  await assert.rejects(requestResult('/fixture',{method:'POST'},{fetcher:async()=>response}),error=>error.uncertain===true&&/unconfirmed/.test(error.message));
 for(const status of [401,409,413,429,503]){
  await assert.rejects(requestResult('/fixture',{method:'POST'},{fetcher:async()=>Response.json({error:'Fixture failure'},{status})}),error=>error.status===status&&error.uncertain===(status>=500)&&/draft|unconfirmed/.test(error.message));
 }
 let calls=0;
 await assert.rejects(requestResult('/fixture',{method:'POST'},{fetcher:async()=>{calls++;throw Error('Connection lost');}}),error=>error.uncertain&&/retry the same action/.test(error.message));
 assert.equal(calls,1);
 await assert.rejects(requestResult('/fixture',{}, {fetcher:async()=>{throw Error('offline');}}),error=>!error.uncertain&&/Could not load/.test(error.message));
});
test('upload response must confirm the requested identity',async()=>{
 await assert.rejects(requestResult('/fixture',{method:'POST'},{fetcher:async()=>Response.json({id:'wrong'}),valid:value=>value?.id==='expected'}),error=>error.uncertain);
 assert.deepEqual(await requestResult('/fixture',{method:'POST'},{fetcher:async()=>Response.json({id:'expected'}),valid:value=>value?.id==='expected'}),{id:'expected'});
});
