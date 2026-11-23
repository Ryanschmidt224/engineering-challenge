import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.value="";this.classList={remove(){}}}
 querySelector(selector){
  for(const child of this.children){
   if(selector.startsWith(".")&&child.className?.split(" ").includes(selector.slice(1)))return child;
   const match=child.querySelector?.(selector);if(match)return match;
  }
  return null;
 }
 querySelectorAll(selector){
  return this.children.flatMap(child=>[
   ...(selector.startsWith(".")&&child.className?.split(" ").includes(selector.slice(1))?[child]:[]),
   ...(child.querySelectorAll?.(selector)||[])
  ]);
 }
 closest(){return this.parent}
 before(node){this.parent.append(node)}
 prepend(node){this.append(node)}
 append(...children){for(const child of children){child.parent=this;this.children.push(child)}}
 setAttribute(key,value){this.attributes[key]=value}
 addEventListener(){}
 replaceChildren(...children){this.children=children}
 focus(){}
 click(){return this.onclick?.()}
}
const setup=fetch=>{
 const window={};
 const document={createElement:tag=>new Element(tag),createTextNode:text=>({textContent:text})};
 const specificationRow=runInNewContext(readFileSync("assets/part-specifications.js","utf8").replace(/^import .*;\n/,"").replaceAll("export function ","function ")+"\nspecificationRow",{document});
 runInNewContext(readFileSync("assets/product-lookup.js","utf8"),{
  window,document,fetch,URL,AbortController,setTimeout,clearTimeout
 });
 return {...window.BSProductLookup,mountPart:(root,options)=>window.BSProductLookup.mountPart(root,{specificationRow,...options})};
};
test("shared lookup submits both identity fields and displays cost before returning a draft",async()=>{
 const requests=[],results=[];
 const service=setup(async(path,request)=>{
  requests.push({path,body:JSON.parse(request.body)});
  return {ok:true,json:async()=>({draft:{name:"Resistor"},lookupUsage:{estimatedUsd:.01,searches:1}})};
 });
 const widget=service.create({identity:true,onResult:result=>results.push(result)});
 widget.setIdentity({partNumber:"ABC",featureTreeDescription:"Resistor",searchHint:"Supplier"});
 await widget.button.click();
 assert.deepEqual(requests[0],{path:"/api/workshop-lookup",body:{partNumber:"ABC",featureTreeDescription:"Resistor",searchHint:"Supplier"}});
 assert.equal(results[0].draft.name,"Resistor");
 assert.match(widget.cost.textContent,/\$0.01/);
 assert.equal(widget.button.disabled,false);
 widget.setIdentity({featureTreeDescription:"Resistor"});
 await widget.button.click();
 assert.equal(requests[1].body.partNumber,"");
});
test("stale and failed requests never apply suggestions and allow retry",async()=>{
 let release,applied=0;
 const service=setup(()=>new Promise(resolve=>{release=resolve}));
 const widget=service.create({identity:true,onResult:()=>applied++});
 widget.setIdentity({partNumber:"ABC"});
 const pending=widget.button.click();
 widget.inputs.partNumber.value="DEF";
 release({ok:true,json:async()=>({draft:{name:"Old result"}})});
 await pending;
 assert.equal(applied,0);
 assert.match(widget.message.textContent,/fields changed/);
 assert.equal(widget.button.disabled,false);
 const failed=setup(async()=>({ok:false,status:422,json:async()=>({error:"Exact part not found",lookupUsage:{estimatedUsd:.02,searches:1}})}));
 const errorWidget=failed.create({identity:true});
 errorWidget.setIdentity({partNumber:"ABC"});
 await errorWidget.button.click();
 assert.equal(errorWidget.message.textContent,"Exact part not found");
 assert.equal(errorWidget.cost.hidden,false);
 assert.equal(errorWidget.button.disabled,false);
});


test("part editor loads shared AI suggestions into its draft without saving a component",async()=>{
 const requests=[];
 const service=setup(async(path,request)=>{
  requests.push(path);
  return {ok:true,json:async()=>({draft:{name:"New resistor",partNumber:"ABC",featureTreeDescription:"Resistor",subtitle:"A resistor"},research:{specs:[{name:"Resistance",value:"10",unit:"kΩ"}]}})};
 });
 const root=new Element("section");
 const field=(name,value="")=>{const node=new Element("input");node.className=name;node.value=value;root.append(node);return node};
 const label=new Element("label"),description=new Element("textarea");
 description.className="component-description";label.append(description);root.append(label);
 const extract=field("component-extract");
 const name=field("component-name","Original"),model=field("component-model"),supplier=field("component-supplier");
 const tree=field("part-project-featureTreeName"),details=field("part-description-input");
 const specs=field("component-specs"),review=field("component-review");
 model.value="ABC";
 const widget=service.mountPart(root,{getPartName:()=>name.value});
 await widget.button.click();
 assert.deepEqual(requests,["/api/workshop-lookup"]);
 assert.equal(name.value,"Original");
 assert.equal(model.value,"ABC");
 assert.equal(tree.value,"");
 assert.equal(details.value,"");
 assert.equal(specs.children.length,0,"Lookup must wait for explicit review");
 await root.querySelector(".product-ai-apply").click();
 assert.equal(specs.children[0].children[1].value,"10 kΩ");
 assert.equal(extract.hidden,true);
 assert.equal(label.hidden,true);
 assert.equal(service.mountPart(root),widget);
});
