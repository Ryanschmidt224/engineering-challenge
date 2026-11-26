import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {TestD1} from "./helpers/d1.mjs";
import {migrations,migrateWorkshop} from "../functions/api/workshop-migrations.js";
import {electronicsTemplates} from "../functions/api/workshop-electronics-templates.js";
import {electronicsTemplateStatements} from "../functions/api/workshop-electronics-migration.js";
import {starterCategories,starterFamilies} from "../functions/api/workshop-seed.js";
import {workshopSnapshot,saveFamily} from "../functions/api/workshop-db.js";
import {validateFamilyFields} from "../assets/family-model.js";
import {restoreCatalog} from "../scripts/workshop-backup.mjs";
async function baseline(t){const db=new TestD1();t.after(()=>db.close());await migrateWorkshop(db,migrations.slice(0,2));return db;}
const rows=(db,table)=>db.sqlite.prepare("SELECT * FROM workshop_"+table+" ORDER BY id").all();
test("all 22 Electronics templates are covered; fields retain valid identities and explicit units",async t=>{
 const scope=new Set(["c-electronics"]);for(const category of starterCategories)if(scope.has(category.parent_id))scope.add(category.id);
 assert.deepEqual(electronicsTemplates.map(row=>row.family.id).sort(),starterFamilies.filter(row=>scope.has(row.category_id)).map(row=>row.id).sort());
 const db=await baseline(t);await migrateWorkshop(db);assert.equal(rows(db,"fields").length,432);
 for(const template of electronicsTemplates){const fields=rows(db,"fields").filter(row=>row.family_id===template.family.id).map(row=>({...row,choices:JSON.parse(row.choices)}));validateFamilyFields(fields);assert.ok(fields.filter(row=>!row.hidden).length>=9);assert.match(template.source,/^https:\/\/forum\.digikey\.com\//);}
 assert.ok(Math.max(...electronicsTemplateStatements.map(sql=>Buffer.byteLength(sql)))<100000);
 const mosfet=rows(db,"fields").filter(row=>row.family_id==='f-n-channel-mosfet'&&!row.hidden);assert.ok(!mosfet.some(row=>['th','on'].includes(row.unit)));assert.ok(mosfet.some(row=>row.label==='Rds On (Max) @ Id, Vgs'&&row.type==='text'&&row.unit===''));
});
test("populated legacy ratings (including zero/false), uses and owner edits are preserved exactly",async t=>{
 const db=await baseline(t),values={'f-n-channel-mosfet-vgs':0,'f-n-channel-mosfet-rds':5,'f-n-channel-mosfet-logic-level':false};
 db.sqlite.prepare("INSERT INTO workshop_products(id,family_id,name,field_values) VALUES('real-product','f-n-channel-mosfet','Saved MOSFET',?)").run(JSON.stringify(values));
 db.sqlite.prepare("INSERT INTO workshop_uses(id,project_id,family_id,product_id,field_values) VALUES('real-use','project','f-n-channel-mosfet','real-product',?)").run(JSON.stringify(values));
 db.sqlite.exec("UPDATE workshop_fields SET label='Owner voltage label' WHERE id='f-n-channel-mosfet-vds-max'; UPDATE workshop_families SET notes='Owner notes',description='Owner description',revision=7 WHERE id='f-n-channel-mosfet'");
 const products=rows(db,'products'),uses=rows(db,'uses');await migrateWorkshop(db);assert.deepEqual(rows(db,'products'),products);assert.deepEqual(rows(db,'uses'),uses);
 for(const id of Object.keys(values)){const field=rows(db,'fields').find(row=>row.id===id);assert.equal(field.hidden,0);assert.match(field.label,/Legacy/);}
 assert.equal(rows(db,'fields').find(row=>row.id==='f-n-channel-mosfet-vds-max').label,'Owner voltage label');
 const family=rows(db,'families').find(row=>row.id==='f-n-channel-mosfet');assert.equal(family.notes,'Owner notes');assert.equal(family.description,'Owner description');assert.equal(family.revision,8);
});
test("renamed/archived/full templates, deleted definitions and equivalent custom fields are respected",async t=>{
 const db=await baseline(t);db.sqlite.exec("UPDATE workshop_families SET name='My custom resistor' WHERE id='f-resistor'; UPDATE workshop_families SET archived=1 WHERE id='f-capacitor'; DELETE FROM workshop_fields WHERE id='f-led-color'");
 const initial=rows(db,'fields');for(let i=initial.filter(row=>row.family_id==='f-inductor').length;i<80;i++)db.sqlite.prepare("INSERT INTO workshop_fields(id,family_id,label,type) VALUES(?,'f-inductor',?,'text')").run('owner-'+i,'Owner field '+i);
 db.sqlite.exec("INSERT INTO workshop_fields(id,family_id,label,unit,type) VALUES('owner-dcr','f-potentiometer','Number of Turns','','number')");
 const before=rows(db,'fields');await migrateWorkshop(db);
 for(const id of ['f-resistor','f-capacitor','f-inductor'])assert.deepEqual(rows(db,'fields').filter(row=>row.family_id===id),before.filter(row=>row.family_id===id));
 assert.equal(rows(db,'fields').find(row=>row.id==='f-led-color'),undefined);
 assert.equal(rows(db,'fields').filter(row=>row.family_id==='f-potentiometer'&&row.label==='Number of Turns').length,1);
});
test("catalog migration rolls back completely on failure and retries; version gate prevents replay",async t=>{
 const db=await baseline(t),before=await workshopSnapshot(db),batch=db.batch.bind(db);db.batch=async statements=>batch([...statements.slice(0,20),db.prepare('SELECT missing_column FROM missing_table'),...statements.slice(20)]);
 await assert.rejects(migrateWorkshop(db));db.batch=batch;assert.deepEqual(await workshopSnapshot(db),before);assert.equal(db.sqlite.prepare("SELECT value FROM workshop_meta WHERE key='schema'").get().value,'2');
 db.batch=batch;await migrateWorkshop(db);const after=await workshopSnapshot(db);await db.batch(electronicsTemplateStatements.map(sql=>db.prepare(sql)));await migrateWorkshop(db);assert.deepEqual(await workshopSnapshot(db),after);
 await migrateWorkshop(db,migrations.slice(0,2));assert.deepEqual(await workshopSnapshot(db),after);
});
test("old editor tokens cannot overwrite upgraded templates; restoring older backups stays exact",async t=>{
 const db=await baseline(t),before=await workshopSnapshot(db),family=before.families.find(row=>row.id==='f-resistor'),draft={...family,name:'Stale overwrite',fields:before.fields.filter(row=>row.family_id===family.id)};await migrateWorkshop(db);assert.equal(await saveFamily(db,draft,family.revision),null);
 const target=new DatabaseSync(':memory:');t.after(()=>target.close());restoreCatalog({...before,knowledge_tiles:[],knowledge_links:[]},target);for(const name of ['families','fields','products','uses','attachments'])assert.deepEqual(JSON.parse(JSON.stringify(target.prepare('SELECT * FROM workshop_'+name+' ORDER BY id').all())),rowsFromSnapshot(before[name]));
});
function rowsFromSnapshot(rows){return rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,['choices','field_values','supplier_links','project_state'].includes(key)?JSON.stringify(value):value]))).sort((a,b)=>a.id.localeCompare(b.id));}
