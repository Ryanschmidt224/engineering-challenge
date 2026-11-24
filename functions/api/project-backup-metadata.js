const size=value=>new TextEncoder().encode(JSON.stringify(value)).length;
export const MAX_METADATA_LINE=4*1024*1024,MAX_METADATA_BYTES=16*1024*1024;

// Small backups retain their original single-manifest representation. Larger
// metadata is split into bounded rows; file chunks and completion stay unchanged.
export function backupMetadata(manifest){
 const first={type:"manifest",manifest};if(size(first)<=MAX_METADATA_LINE)return [first];
 const header={type:"manifest",manifest:{format:manifest.format,version:2,project:manifest.project,tableNames:Object.keys(manifest.tables)}},entries=[header];let total=size(header);
 for(const [table,rows]of Object.entries(manifest.tables))for(const row of rows){
  const entry={type:"row",table,row},bytes=size(entry);if(bytes>MAX_METADATA_LINE)throw Error("One backup row exceeds the supported size.");total+=bytes;
  if(total>MAX_METADATA_BYTES)throw Error("Backup metadata exceeds the supported 16 MB limit.");entries.push(entry);
 }
 entries.push({type:"metadata_complete"});return entries;
}

export async function readBackupManifest(iterator,first,tableNames){
 const header=first?.manifest;if(first?.type!=="manifest"||!header)throw Error("Backup is missing its manifest.");
 if(header.version!==2)return header;
 if(header.format!=="building-schmidt-project"||!Array.isArray(header.tableNames)||new Set(header.tableNames).size!==header.tableNames.length||header.tableNames.some(name=>!tableNames.includes(name)))throw Error("Unsupported streamed backup metadata.");
 const manifest={format:header.format,version:1,project:header.project,tables:Object.fromEntries(header.tableNames.map(name=>[name,[]]))};let total=size(first),count=0;
 for(;;){
  const next=await iterator.next();if(next.done)throw Error("Backup metadata is incomplete.");const entry=next.value;
  if(entry.type==="metadata_complete")return manifest;
  if(entry.type!=="row"||!Object.hasOwn(manifest.tables,entry.table))throw Error("Invalid backup metadata row.");
  total+=size(entry);if(total>MAX_METADATA_BYTES)throw Error("Backup metadata exceeds the supported 16 MB limit.");if(++count>10000)throw Error("This preview restore accepts at most 10,000 rows.");manifest.tables[entry.table].push(entry.row);
 }
}
