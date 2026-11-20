// File picker filters and storage metadata must agree on supported extensions.
globalThis.BSAttachmentTypes = (() => {
 const types = Object.freeze({
  jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",
  gif:"image/gif",heic:"image/heic",heif:"image/heif",
  pdf:"application/pdf",dwg:"application/octet-stream",dxf:"application/octet-stream",
  sldprt:"application/octet-stream",sldasm:"application/octet-stream",
  step:"application/octet-stream",stp:"application/octet-stream",stl:"application/octet-stream",
  igs:"application/octet-stream",iges:"application/octet-stream",
  x_t:"application/octet-stream",x_b:"application/octet-stream",
  obj:"application/octet-stream","3mf":"application/octet-stream",
  doc:"application/octet-stream",docx:"application/octet-stream",
  xls:"application/octet-stream",xlsx:"application/octet-stream",
  txt:"text/plain",csv:"text/plain",zip:"application/octet-stream",
  py:"text/plain",js:"text/plain",ts:"text/plain",ino:"text/plain",c:"text/plain",cpp:"text/plain",
  h:"text/plain",hpp:"text/plain",json:"text/plain",md:"text/plain",
  kicad_sch:"application/octet-stream",kicad_pcb:"application/octet-stream",kicad_pro:"application/octet-stream"
 });
 const accepts = extension => Object.hasOwn(types, extension);
 const isImage = extension => accepts(extension) && types[extension].startsWith("image/");
 const accept = Object.keys(types).map(extension => "." + extension).join(",");
 return Object.freeze({types, accepts, isImage, accept});
})();
