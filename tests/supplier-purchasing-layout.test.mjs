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
