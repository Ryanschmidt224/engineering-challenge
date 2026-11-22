// Local-only synthetic Workshop environment for visual QA. Never connects to R2.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {fixture,request} from './workshop-fixture.mjs';
import {onRequest as templates} from '../../functions/api/workshop-templates.js';
import {onRequest as references} from '../../functions/api/workshop-reference.js';
const f=await fixture();
const root=fileURLToPath(new URL('../../',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){
   const handler=url.pathname==='/api/workshop-templates'?templates:url.pathname==='/api/workshop-reference'?references:null;
   if(handler){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const text=Buffer.concat(chunks).toString();
    const response=await handler({request:request(req.url,req.method,text?JSON.parse(text):undefined,f.session),env:f.env});
    res.writeHead(response.status,{'content-type':'application/json','cache-control':'no-store'});res.end(await response.text());return;
   }
   const data=url.pathname==='/api/accounts'?{user:f.user}:url.pathname==='/api/auth'?{authenticated:false}:
    url.pathname==='/api/personal-workshop'?{items:[]}:url.pathname==='/api/tree'?{nodes:[],revision:'fixture'}:
    url.pathname==='/api/components'?{components:[]}:url.pathname==='/api/workspace'?{workspace:{recipe:[],resources:[]},revision:'fixture'}:
    url.pathname==='/api/photos'?{photos:[]}:url.pathname==='/api/drawings'?{drawings:[]}:{};
   res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));return;
  }
  const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!path.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403);res.end();return;}
  res.writeHead(200,{'content-type':types[extname(path)]||'application/octet-stream','cache-control':'no-store'});res.end(await readFile(path));
 }catch(error){if(!res.headersSent)res.writeHead(404);res.end(String(error));}
});
server.listen(Number(process.env.PORT||4173),'0.0.0.0',()=>console.log('Workshop fixture listening on '+server.address().port));
