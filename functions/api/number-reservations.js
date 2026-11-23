// Read historical allocations without changing the archived records. A restored
// occurrence may repeat its own number; a different identity may never claim it.
export async function archivedNumberOwners(bucket,project){
 const owners=[];let cursor;
 do{
  const page=await bucket.list({prefix:"assembly-archives/"+project+"/manifests/",limit:500,cursor});
  for(const item of page.objects){
   const object=await bucket.get(item.key);if(!object)throw Error("An archive changed while checking reserved numbers. Retry.");const archive=JSON.parse(await object.text());
   for(const node of archive.nodes||[])if(node.kind!=="part"&&node.partNumber)owners.push([node.partNumber,"assembly:"+node.id]);
   for(const part of [...(archive.parts||[]),...(archive.workshopParts||[])])if(part.partNumber)owners.push([part.partNumber,"part:"+part.id]);
   if(owners.length>10000)throw Error("Too many historical number reservations to check safely");
  }
  if(!page.truncated)break;if(!page.cursor||page.cursor===cursor)throw Error("Historical number checking was incomplete. Retry.");cursor=page.cursor;
 }while(true);
 return owners;
}

export function rememberNumbers(data,entries){
 data.reservedNumbers??={};
 for(const [raw,owner] of entries){
  const number=String(raw||"").trim().toUpperCase();if(!number)continue;
  if(data.reservedNumbers[number]&&data.reservedNumbers[number]!==owner||Object.entries(data.issued).some(([id,value])=>id!==owner&&value===number))throw Error("This part number is already assigned in the project");
  data.reservedNumbers[number]=owner;data.issued[owner]??=number;
  if(number.startsWith(data.prefix)&&/^\d+$/.test(number.slice(data.prefix.length))){
   const sequence=String(Number(number.slice(data.prefix.length)));
   if(data.issuedSequences[sequence]&&data.issuedSequences[sequence]!==owner)throw Error("This part number is already assigned in the project");data.issuedSequences[sequence]=owner;
  }
 }
}
