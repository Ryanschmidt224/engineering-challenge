import assert from "node:assert/strict";
// Read the standard central directory rather than searching payload bytes for
// signatures. Used only to inspect exported, uncompressed test ZIPs.
export function readStoredZip(input){
 const data=Buffer.from(input),end=data.length-22;assert.equal(data.readUInt32LE(end),0x06054b50);assert.equal(data.readUInt16LE(end+20),0);
 const count=data.readUInt16LE(end+10),files=[];let offset=data.readUInt32LE(end+16);
 for(let index=0;index<count;index++){
  assert.equal(data.readUInt32LE(offset),0x02014b50);assert.equal(data.readUInt16LE(offset+10),0);const size=data.readUInt32LE(offset+24),nameSize=data.readUInt16LE(offset+28),extra=data.readUInt16LE(offset+30),comment=data.readUInt16LE(offset+32),local=data.readUInt32LE(offset+42),name=data.subarray(offset+46,offset+46+nameSize).toString("utf8"),crc=data.readUInt32LE(offset+16);
  assert.equal(data.readUInt32LE(local),0x04034b50);assert.equal(data.readUInt16LE(local+6),0x0808);const start=local+30+data.readUInt16LE(local+26)+data.readUInt16LE(local+28);assert.equal(data.readUInt32LE(start+size),0x08074b50);assert.equal(data.readUInt32LE(start+size+4),crc);assert.equal(data.readUInt32LE(start+size+8),size);
  files.push({name,crc,bytes:data.subarray(start,start+size)});offset+=46+nameSize+extra+comment;
 }
 assert.equal(offset,end);return files;
}
