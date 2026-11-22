import {DatabaseSync} from "node:sqlite";

// Exercise the actual SQL, triggers, JSON functions, constraints and rollback.
// Cloudflare binding/permissions are verified separately after deployment.
export class TestD1 {
 constructor(connection) {this.sqlite=connection||new DatabaseSync(":memory:");this.sqlite.exec("PRAGMA foreign_keys=ON");}
 prepare(sql) {
  const db=this;
  function prepared(values=[]) {
   const execute=()=>{
    const statement=db.sqlite.prepare(sql);
    if(statement.columns().length)return {results:statement.all(...values),meta:{changes:0},success:true};
    const result=statement.run(...values);return {results:[],meta:{changes:Number(result.changes)},success:true};
   };
   return {bind:(...next)=>{if(next.length>100)throw Error("D1 bound parameter limit exceeded: "+next.length);return prepared(next)},run:async()=>execute(),all:async()=>execute(),first:async()=>execute().results[0]||null,execute};
  }
  return prepared();
 }
 async batch(statements) {
  this.sqlite.exec("BEGIN");
  try{const results=statements.map(statement=>statement.execute());this.sqlite.exec("COMMIT");return results;}
  catch(error){this.sqlite.exec("ROLLBACK");throw error;}
 }
 close(){this.sqlite.close();}
}
