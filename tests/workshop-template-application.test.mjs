import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
// Minimal rendering host. Assertions exercise the production builder's state,
// including successive applications; no duplicate implementation of merge rules.
class Element{
 constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};this.value='';}
 append(...children){this.children.push(...children)}
 replaceChildren(...children){this.children=children}
 setAttribute(key,value){this.attributes[key]=value}
 addEventListener(){}
}
function create(item={}){
 const window={};
 runInNewContext(readFileSync('assets/workshop-product-builder.js','utf8'),{
  window,document:{createElement:tag=>new Element(tag)},crypto,URL,location:{origin:'https://example.test'}});
 return window.BSWorkshopProductBuilder.create({item,readOnly:false});
}
const section=(id,fieldId,value='',scope='workshop')=>({id,title:id,fields:[{id:fieldId,label:fieldId,type:'text',scope,value,unit:'',options:[]}]});
const output=builder=>JSON.parse(JSON.stringify(builder.getSections()));
const find=(node,predicate)=>predicate(node)?node:node.children?.map(c=>find(c,predicate)).find(Boolean);

test('applying successive layouts replaces empty imported fields and preserves authored/populated fields',()=>{
 const builder=create({productSections:[section('own','authored','Keep')]});
 assert.equal(builder.setSections([section('a','a-field','Must never copy')]),true);
 assert.equal(output(builder)[0].fields[0].value,'');
 assert.equal(output(builder)[1].fields[0].value,'Keep');
 builder.setSections([section('b','b-field')]);
 assert.deepEqual(output(builder).map(s=>s.id),['b','own']);
 const input=find(builder.element,node=>node.attributes?.['aria-label']==='b-field'&&node.tagName==='input');
 input.value='User entered';input.oninput();
 builder.setSections([section('c','c-field')]);
 assert.deepEqual(output(builder).map(s=>s.id),['c','b','own']);
 assert.equal(output(builder)[1].fields[0].value,'User entered');
});

test('matching IDs retain values even when a template changes field scope; blank master opens independently',()=>{
 const builder=create({productSections:[section('a','stable','Retain')]});
 builder.setSections([section('a','stable','Source','project')]);
 assert.equal(output(builder)[0].fields[0].value,'Retain');
 assert.equal(output(builder)[0].fields[0].scope,'workshop');
 builder.setSections([],{preserveExisting:false});assert.deepEqual(output(builder),[]);
 builder.setSections([section('a','stable','Never copied')],{preserveExisting:false});
 assert.equal(output(builder)[0].fields[0].value,'');
});

test('oversized template merge fails without changing state; preview is non-mutating',()=>{
 const builder=create({productSections:Array.from({length:16},(_,i)=>section('s'+i,'f'+i,'Keep'))});
 const before=output(builder);
 assert.equal(builder.setSections([section('new','new-field')],{preview:true}),false);
 assert.equal(builder.setSections([section('new','new-field')]),false);
 assert.deepEqual(output(builder),before);
 assert.equal(builder.setSections([section('s0','f0')],{preview:true}),true);
 assert.deepEqual(output(builder),before);
});
