// Data-only migration. Never alters product/use values, files or project history.
// Every statement is version-gated inside the migration's atomic D1 batch.
import {electronicsTemplates} from "./workshop-electronics-templates.js";
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
const json=value=>quote(JSON.stringify(value));
const keys=["id","family_id","label","unit","type","choices","sort_order","hidden","filled_on_use"];
const filled=id=>`EXISTS(SELECT 1 FROM workshop_products p WHERE p.family_id=workshop_fields.family_id AND json_extract(p.field_values,'$.'||${id}) IS NOT NULL AND CAST(json_extract(p.field_values,'$.'||${id}) AS TEXT)<>'') OR EXISTS(SELECT 1 FROM workshop_uses u WHERE u.family_id=workshop_fields.family_id AND json_extract(u.field_values,'$.'||${id}) IS NOT NULL AND CAST(json_extract(u.field_values,'$.'||${id}) AS TEXT)<>'')`;
const absent=`NOT EXISTS(SELECT 1 FROM workshop_fields present WHERE present.id=json_extract(extra.value,'$.id') OR (present.family_id=json_extract(extra.value,'$.family_id') AND lower(trim(present.label))=lower(trim(json_extract(extra.value,'$.label'))) AND present.unit=json_extract(extra.value,'$.unit')))`;
function statements(template){
 const {family,baseline,fields,description,notes}=template,added=fields.filter(row=>!baseline.some(old=>old.id===row.id));
 const guard=`NOT EXISTS(SELECT 1 FROM workshop_meta WHERE key='schema' AND CAST(value AS INTEGER)>=3) AND EXISTS(SELECT 1 FROM workshop_families family WHERE family.id=${quote(family.id)} AND family.name=${quote(family.name)} AND family.category_id=${quote(family.category_id)} AND family.archived=0 AND (SELECT count(*) FROM workshop_fields WHERE family_id=family.id)+(SELECT count(*) FROM json_each(${json(added)}) extra WHERE ${absent})<=80 AND NOT EXISTS(SELECT 1 FROM json_each(${json(added)}) extra JOIN workshop_fields collision ON collision.id=json_extract(extra.value,'$.id') WHERE collision.family_id<>family.id))`;
 const matches=["label","unit","type","sort_order","hidden","filled_on_use"].map(key=>`workshop_fields.${key}=json_extract(original.value,'$.${key}')`).join(" AND ");
 const values=keys.filter(key=>!["id","family_id"].includes(key)).map(key=>key==="hidden"?`hidden=CASE WHEN json_extract(target.value,'$.hidden')=1 AND (${filled("workshop_fields.id")}) THEN workshop_fields.hidden ELSE json_extract(target.value,'$.hidden') END`:`${key}=json_extract(target.value,'$.${key}')`).join(",");
 return [
  `UPDATE workshop_fields SET ${values} FROM json_each(${json(fields)}) target JOIN json_each(${json(baseline)}) original ON json_extract(original.value,'$.id')=json_extract(target.value,'$.id') WHERE workshop_fields.id=json_extract(target.value,'$.id') AND workshop_fields.family_id=${quote(family.id)} AND ${matches} AND json(workshop_fields.choices)=json(json_extract(original.value,'$.choices')) AND ${guard}`,
  `INSERT OR IGNORE INTO workshop_fields (${keys.join(",")}) SELECT ${keys.map(key=>`json_extract(extra.value,'$.${key}')`).join(",")} FROM json_each(${json(added)}) extra WHERE ${absent} AND ${guard}`,
  `UPDATE workshop_families SET description=CASE WHEN description='' THEN ${quote(description)} ELSE description END,notes=CASE WHEN notes='' THEN ${quote(notes)} ELSE notes END,revision=revision+1 WHERE id=${quote(family.id)} AND ${guard}`
 ];
}
export const electronicsTemplateStatements=electronicsTemplates.flatMap(statements);
