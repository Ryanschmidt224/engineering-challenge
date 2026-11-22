import {readFileSync,readdirSync,existsSync} from "node:fs";
import {resolve,dirname,relative} from "node:path";
import * as prettier from "prettier";

function walk(node,visit){
 if(!node||typeof node!=="object")return;
 visit(node);
 for(const [key,value] of Object.entries(node))if(!["comments","tokens","loc","source","inputs"].includes(key)){
  if(Array.isArray(value))for(const child of value)walk(child,visit);
  else if(value&&typeof value==="object")walk(value,visit);
 }
}
export async function classProducers(root=process.cwd()){
 const classes=new Set(),files=new Set(),pending=[];
 const literals=text=>{
  if(typeof text!=="string")return;
  const bare=text.trim();
  if(/^[\w-]+(?:\s+[\w-]+)*$/.test(bare))for(const token of bare.split(/\s+/))classes.add(token);
  for(const match of text.matchAll(/\bclass\s*=\s*["']([^"']*)["']/g))for(const token of match[1].split(/\s+/))if(token)classes.add(token);
 };
 const dependency=(name,from)=>{
  if(typeof name!=="string"||!name.startsWith(".")&&!name.startsWith("/"))return;
  const file=resolve(name.startsWith("/")?root:dirname(from),name.startsWith("/")?"."+name.split("?")[0]:name.split("?")[0]);
  if(/\.(?:m?js)$/.test(file)&&existsSync(file)&&!files.has(file))pending.push(file);
 };
 const script=async(text,file)=>{
  const {ast}=await prettier.__debug.parse(text,{parser:"babel"});
  walk(ast,node=>{
   if(node.type==="StringLiteral")literals(node.value);
   if(node.type==="TemplateElement")literals(node.value.cooked);
   if(["ImportDeclaration","ExportNamedDeclaration","ExportAllDeclaration"].includes(node.type))dependency(node.source?.value,file);
   if(node.type==="ImportExpression")dependency(node.source?.value,file);
   if(node.type==="CallExpression"&&node.callee?.type==="Import")dependency(node.arguments?.[0]?.value,file);
  });
 };
 for(const name of readdirSync(root).filter(name=>name.endsWith(".html"))){
  const file=resolve(root,name),html=readFileSync(file,"utf8").replace(/<!--[\s\S]*?-->/g, "");literals(html);
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
   const src=match[1].match(/\bsrc=["']([^"']+)["']/)?.[1];
   if(src)dependency(src.startsWith("/")?src:"./"+src,file);
   else if(match[2].trim()&&!/application\/(?:ld\+)?json/.test(match[1]))await script(match[2],file);
  }
 }
 while(pending.length){const file=pending.pop();if(files.has(file))continue;files.add(file);await script(readFileSync(file,"utf8"),file);}
 return {classes,files:[...files].map(file=>relative(root,file))};
}
export async function cssClassUses(root=process.cwd()){
 const uses=new Map();
 for(const name of readdirSync(resolve(root,"assets"),{recursive:true}).filter(name=>name.endsWith(".css"))){
  const file="assets/"+name,{ast}=await prettier.__debug.parse(readFileSync(resolve(root,file),"utf8"),{parser:"css"});
  walk(ast,node=>{if(node.type==="selector-class"){if(!uses.has(node.value))uses.set(node.value,new Set());uses.get(node.value).add(file);}});
 }
 return uses;
}
