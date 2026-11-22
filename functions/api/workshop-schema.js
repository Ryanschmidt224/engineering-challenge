// The first clean Workshop schema. Existing R2 Workshop data is not imported.
export const workshopSchema = [
`CREATE TABLE IF NOT EXISTS workshop_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS workshop_categories (
 id TEXT PRIMARY KEY, parent_id TEXT REFERENCES workshop_categories(id) ON DELETE RESTRICT,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100), sort_order INTEGER NOT NULL DEFAULT 0,
 revision INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 CHECK(parent_id IS NULL OR parent_id <> id))`,
`CREATE TABLE IF NOT EXISTS workshop_families (
 id TEXT PRIMARY KEY, category_id TEXT REFERENCES workshop_categories(id) ON DELETE RESTRICT,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 180), kind TEXT NOT NULL DEFAULT 'part' CHECK(kind IN ('part','material','tool')),
 description TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1,
 mutation_id TEXT NOT NULL DEFAULT '', archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)))`,
`CREATE TABLE IF NOT EXISTS workshop_fields (
 id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES workshop_families(id) ON DELETE RESTRICT,
 label TEXT NOT NULL, unit TEXT NOT NULL DEFAULT '', type TEXT NOT NULL CHECK(type IN ('number','text','choice','boolean')),
 choices TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(choices)), sort_order INTEGER NOT NULL DEFAULT 0,
 hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1)), filled_on_use INTEGER NOT NULL DEFAULT 0 CHECK(filled_on_use IN (0,1)))`,
`CREATE TABLE IF NOT EXISTS workshop_products (
 id TEXT PRIMARY KEY, family_id TEXT NOT NULL REFERENCES workshop_families(id) ON DELETE RESTRICT,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 180), manufacturer TEXT NOT NULL DEFAULT '', mpn TEXT NOT NULL DEFAULT '',
 supplier_links TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(supplier_links)), notes TEXT NOT NULL DEFAULT '',
 field_values TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(field_values)), revision INTEGER NOT NULL DEFAULT 1,
 archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)), UNIQUE(id,family_id))`,
`CREATE TABLE IF NOT EXISTS workshop_uses (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL, tree_node_id TEXT, family_id TEXT NOT NULL REFERENCES workshop_families(id) ON DELETE RESTRICT,
 product_id TEXT, purpose TEXT NOT NULL DEFAULT '', quantity REAL CHECK(quantity IS NULL OR quantity >= 0), unit TEXT NOT NULL DEFAULT 'pcs',
 field_values TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(field_values)), notes TEXT NOT NULL DEFAULT '',
 project_state TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(project_state)),
 revision INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 FOREIGN KEY(product_id,family_id) REFERENCES workshop_products(id,family_id) ON DELETE RESTRICT)`,
`CREATE INDEX IF NOT EXISTS workshop_uses_project ON workshop_uses(project_id,archived)`,
`CREATE INDEX IF NOT EXISTS workshop_products_family ON workshop_products(family_id,archived)`,
`CREATE TABLE IF NOT EXISTS workshop_attachments (
 id TEXT PRIMARY KEY, family_id TEXT REFERENCES workshop_families(id) ON DELETE RESTRICT,
 product_id TEXT REFERENCES workshop_products(id) ON DELETE RESTRICT, use_id TEXT REFERENCES workshop_uses(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL DEFAULT 'document', title TEXT NOT NULL, url TEXT, r2_key TEXT, media_type TEXT, size INTEGER,
 revision INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1)),
 CHECK((family_id IS NOT NULL)+(product_id IS NOT NULL)+(use_id IS NOT NULL)=1),
 CHECK((url IS NOT NULL)+(r2_key IS NOT NULL)=1))`,
`CREATE TRIGGER IF NOT EXISTS workshop_category_cycle BEFORE UPDATE OF parent_id ON workshop_categories
 WHEN NEW.parent_id IS NOT NULL BEGIN
 SELECT RAISE(ABORT,'CATEGORY_CYCLE') WHERE NEW.parent_id=NEW.id OR EXISTS(
 WITH RECURSIVE parents(id,parent_id) AS (SELECT id,parent_id FROM workshop_categories WHERE id=NEW.parent_id
 UNION ALL SELECT c.id,c.parent_id FROM workshop_categories c JOIN parents p ON c.id=p.parent_id)
 SELECT 1 FROM parents WHERE id=NEW.id); END`,
`CREATE TRIGGER IF NOT EXISTS workshop_field_contract BEFORE UPDATE OF type,unit ON workshop_fields
 WHEN NEW.type<>OLD.type OR NEW.unit<>OLD.unit BEGIN
 SELECT RAISE(ABORT,'POPULATED_FIELD_CONTRACT') WHERE
 EXISTS(SELECT 1 FROM workshop_products WHERE family_id=OLD.family_id AND json_type(field_values,'$.'||OLD.id) IS NOT NULL AND json_type(field_values,'$.'||OLD.id)<>'null' AND CAST(json_extract(field_values,'$.'||OLD.id) AS TEXT)<>'') OR
 EXISTS(SELECT 1 FROM workshop_uses WHERE family_id=OLD.family_id AND json_type(field_values,'$.'||OLD.id) IS NOT NULL AND json_type(field_values,'$.'||OLD.id)<>'null' AND CAST(json_extract(field_values,'$.'||OLD.id) AS TEXT)<>''); END`,
`CREATE TRIGGER IF NOT EXISTS workshop_field_choices BEFORE UPDATE OF choices ON workshop_fields
 WHEN NEW.type='choice' AND json_array_length(NEW.choices)>0 BEGIN
 SELECT RAISE(ABORT,'POPULATED_FIELD_CHOICES') WHERE
 EXISTS(SELECT 1 FROM workshop_products WHERE family_id=OLD.family_id AND json_type(field_values,'$.'||OLD.id)='text' AND json_extract(field_values,'$.'||OLD.id)<>'' AND json_extract(field_values,'$.'||OLD.id) NOT IN(SELECT value FROM json_each(NEW.choices))) OR
 EXISTS(SELECT 1 FROM workshop_uses WHERE family_id=OLD.family_id AND json_type(field_values,'$.'||OLD.id)='text' AND json_extract(field_values,'$.'||OLD.id)<>'' AND json_extract(field_values,'$.'||OLD.id) NOT IN(SELECT value FROM json_each(NEW.choices))); END`,
`CREATE TRIGGER IF NOT EXISTS workshop_field_family BEFORE UPDATE OF family_id ON workshop_fields
 WHEN NEW.family_id<>OLD.family_id BEGIN SELECT RAISE(ABORT,'FIELD_FAMILY_CHANGE'); END`
];
