// Studio Green theme contract: colors are centralized, reusable and legible.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('project.html','utf8');
const theme=readFileSync('assets/theme.css','utf8');
const stylesheets=['ui-kit.css','components.css','project-workspace.css'];
const site=stylesheets.map(name=>readFileSync('assets/'+name,'utf8')).join('\n');

const definitions=new Map([...theme.matchAll(/(--color-[a-z-]+)\s*:\s*(#[a-f0-9]{6})\s*;/gi)]
  .map(([,name,value])=>[name,value]));

function luminance(hex){
 const channels=hex.slice(1).match(/.{2}/g).map(part=>parseInt(part,16)/255)
  .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return .2126*channels[0]+.7152*channels[1]+.0722*channels[2];
}
function contrast(a,b){
 const x=luminance(definitions.get('--color-'+a));
 const y=luminance(definitions.get('--color-'+b));
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
test('current pages load the shared theme without retired overrides',()=>{
 for(const page of ['project.html','workshop.html','knowledge.html','website-settings.html']){
  const html=readFileSync(page,'utf8');assert.match(html,/assets\/theme.css/);assert.doesNotMatch(html,/assets\/site(?:-polish|-controls|-workspaces)?\.css/);
 }
});

test('every semantic color used by components exists in the palette',()=>{
 const used=[...site.matchAll(/var\((--color-[a-z-]+)\b/g)].map(m=>m[1]);
 assert.ok(used.length>20,'component CSS should use reusable colors');
 for(const name of new Set(used))assert.ok(definitions.has(name),name+' is undefined');
});
test('component stylesheet has no hardcoded hex or rgb color values',()=>{
 assert.doesNotMatch(site,/#[0-9a-f]{3,8}\b/i);
 assert.doesNotMatch(site,/rgba?\s*\(/i);
 assert.doesNotMatch(site,/\b(?:color|background|border-color)\s*:\s*(?:white|black)\b/i);
});
test('Studio Green text and important controls meet minimum contrast',()=>{
 for(const [foreground,background] of [
  ['text','surface'],['text','page'],['text','sidebar'],
  ['text-muted','surface'],['text-muted','page'],
  ['on-accent','accent']
 ])assert.ok(contrast(foreground,background)>=4.5,
  foreground+' on '+background+' contrast is below 4.5:1');
});
