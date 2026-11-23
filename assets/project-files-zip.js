// Streaming, uncompressed ZIP (UTF-8 names, data descriptors, no ZIP64).
// Callers bound entry count/total bytes before starting the response.
const encode=new TextEncoder();
const bytes=(size,write)=>{const value=new Uint8Array(size);write(new DataView(value.buffer));return value;};
function crcUpdate(crc,chunk,table){for(const byte of chunk)crc=crc>>>8^table[(crc^byte)&255];return crc>>>0;}
export function zipStore(entries,open){
 const table=Uint32Array.from({length:256},(_,index)=>{let crc=index;for(let bit=0;bit<8;bit++)crc=crc>>>1^(crc&1?0xedb88320:0);return crc>>>0;});
 async function* generate(){
  const directory=[];let offset=0;
  for(const entry of entries){
   const name=encode.encode(entry.path),start=offset;
   const header=bytes(30,view=>{view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x0808,true);view.setUint16(12,0x21,true);view.setUint16(26,name.length,true);});
   yield header;yield name;offset+=header.length+name.length;
   let crc=0xffffffff,size=0;
   const object=await open(entry);if(!object?.body)throw Error("A selected project file is no longer available. Refresh files and try again.");
   const reader=object.body.getReader();
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>entry.size)throw Error("A selected project file changed during download.");crc=crcUpdate(crc,value,table);yield value;offset+=value.byteLength;}}
   finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   if(size!==entry.size)throw Error("A selected project file changed during download.");
   crc=(crc^0xffffffff)>>>0;
   const descriptor=bytes(16,view=>{view.setUint32(0,0x08074b50,true);view.setUint32(4,crc,true);view.setUint32(8,size,true);view.setUint32(12,size,true);});yield descriptor;offset+=16;
   const central=bytes(46,view=>{view.setUint32(0,0x02014b50,true);view.setUint16(4,20,true);view.setUint16(6,20,true);view.setUint16(8,0x0808,true);view.setUint16(14,0x21,true);view.setUint32(16,crc,true);view.setUint32(20,size,true);view.setUint32(24,size,true);view.setUint16(28,name.length,true);view.setUint32(42,start,true);});directory.push(central,name);
  }
  const start=offset;for(const chunk of directory){yield chunk;offset+=chunk.length;}
  yield bytes(22,view=>{view.setUint32(0,0x06054b50,true);view.setUint16(8,entries.length,true);view.setUint16(10,entries.length,true);view.setUint32(12,offset-start,true);view.setUint32(16,start,true);});
 }
 const iterator=generate();return new ReadableStream({async pull(controller){try{const next=await iterator.next();next.done?controller.close():controller.enqueue(next.value);}catch(error){controller.error(error);}},async cancel(){await iterator.return?.();}});
}
