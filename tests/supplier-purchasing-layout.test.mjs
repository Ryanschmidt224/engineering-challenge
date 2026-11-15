import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const source=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const window={};
runInNewContext(source("assets/part-suppliers.js"),{window,URL,encodeURIComponent});
const supplier=window.BSPartSuppliers;

test("supplier links use official domains and codes are not engineering identities",()=>{
 assert.equal(supplier.linkFor({vendor:"amazon",sku:"B0149K4JTY",url:""}),"https://www.amazon.com/dp/B0149K4JTY");
 assert.equal(supplier.linkFor({vendor:"mcmaster",sku:"91290A115",url:""}),"https://www.mcmaster.com/91290A115/");
 assert.match(supplier.linkFor({vendor:"digikey",sku:"KE1102-ND",url:""}),/^https:\/\/www\.digikey\.com\/en\/products\/result\?keywords=/);
 assert.equal(supplier.linkFor({vendor:"digikey",sku:"KE1102-ND",url:"https://www.amazon.com/dp/B0149K4JTY"}),null);
 assert.equal(supplier.safeUrl("digikey","javascript:alert(1)"),null);
 assert.equal(supplier.safeUrl("digikey","https://www.digikey.com.evil.example/order"),null);
 assert.equal(supplier.safeUrl("amazon","https://example.org/product"),null);
 assert.equal(supplier.linkFor({vendor:"other",sku:"ABC",url:""}),null);
});

test("the edit view supports multiple vendor entries and preserves legacy Amazon ASINs",()=>{
 const assembly=source("assets/site-assembly.js"),backend=source("functions/api/components.js"),html=source("index.html");
 assert.match(assembly,/supplierEditor\?\.setOffers\(part\.supplierOffers\|\|\[\]\)/);
 assert.match(assembly,/component\.supplierOffers=supplierEditor\?\.getOffers\(\)\|\|\[\]/);
 assert.match(assembly,/renderLinks\(detailRows,part\)/);
 assert.match(backend,/normalizeSupplierOffers\(input\.supplierOffers\)/);
 assert.match(backend,/if\(supplierOffers!==undefined\)updated\.supplierOffers=supplierOffers/);
 assert.match(html,/\/assets\/part-suppliers\.js\?v=/);
 assert.match(source("assets/part-suppliers.js"),/if\(isAsin\(part\.asin\)\&\&!existingAmazon\)/);
});

test("top-level catalog pages fill the desktop width and shrink responsibly",()=>{
 const css=source("assets/site-controls.css");
 assert.match(css,/width:min\(100%,1840px\)/);
 assert.match(css,/grid-template-columns:clamp\(218px,17vw,278px\)/);
 assert.match(css,/body>main\{flex:1 0 auto/);
 assert.match(css,/@media\(max-width:800px\)/);
 const resources=source("assets/resources.js");
 assert.match(resources,/className|workshop-supplier-search/);
 assert.match(resources,/BSPa(?:rtSuppliers)\?\.searchUrlFor/);
});

test("DigiKey cart handoff includes only explicit codes and buyable quantities, combining repeats",()=>{
 const ctx={window:{}};
 runInNewContext(source("assets/bom-purchasing.js"),ctx);
 const linesFor=ctx.window.BSBomPurchasing.linesFor;
 const sample=[
  {name:"Hall 1",supplierOffers:[{vendor:"digikey",sku:"1234-ND"}],quantity:2,quantityUnit:"pcs",purchaseStatus:"need_to_buy"},
  {name:"Hall 2",supplierOffers:[{vendor:"digikey",sku:"1234-ND"}],quantity:3,quantityUnit:"pcs",purchaseStatus:"need_to_buy"},
  {name:"Owned",supplierOffers:[{vendor:"digikey",sku:"OWN-ND"}],quantity:1,purchaseStatus:"already_have"},
  {name:"Solder",supplierOffers:[{vendor:"digikey",sku:"SOLD-ND"}],quantity:1,assumedOnHand:true},
  {name:"Unmapped",quantity:3},
  {name:"Cut stock",supplierOffers:[{vendor:"digikey",sku:"CUT-ND"}],quantity:2.5},
  {name:"Source doc",itemType:"document",supplierOffers:[{vendor:"digikey",sku:"DOC-ND"}],quantity:1}
 ];
 const result=linesFor(sample);
 assert.equal(result.lines.length,1);
 assert.equal(result.lines[0].sku,"1234-ND");
 assert.equal(result.lines[0].qty,5);
 assert.equal(result.skipped.length,2);
 assert.match(source("assets/bom-purchasing.js"),/classic\/ordering\/fastadd\.aspx/);
 assert.match(source("assets/site-assembly.js"),/BSBomPurchasing\?\.render\(purchasingMount,purchasedParts\)/);
});
